import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { NUMBER_KIND, opKey, type Registry } from "../kind/registry";
import type { Node, NodeId } from "../parse/ast";
import { walk } from "../parse/ast";
import type { Program } from "../parse/program";
import type { Candidate, KindId, Span } from "../types";

const CONTEXT_BONUS = 30;

/**
 * One (op, left, right) the solver enumerated and found no signature for.
 *
 * The knowledge already existed and was thrown away: `solve` knew it had tried
 * `mass / length` for "10 kg / 2 m" and reported *mass and duration*, because
 * the old report re-walked the tree for two operand kinds instead of asking
 * the walk that had actually failed. Keeping the rejections is what lets
 * `DimensionMismatchError.tried` name every pair and `Explanation.rejections`
 * list them with the text each one came from.
 *
 * `spans` is `[left, right]` and indexes the caller's string, not the
 * normalized one — `solve` maps them on the way into the sink, so nothing
 * downstream has to remember which of the two coordinate systems it holds.
 * For a `convert` the pair is the operand and the target word; the keyword
 * between them is the gap, which is how `DimensionMismatchError` gets its
 * three-span `[left, operator, right]` without a token stream in hand.
 */
export interface Rejection {
  node: NodeId;
  /** An `OpSymbol` or `"in"`. Never the literal "operation". */
  op: string;
  left: KindId;
  right: KindId;
  spans: [Span, Span];
}

export interface Resolution {
  /**
   * Keyed by NodeId, never by node object. Keying by identity made a
   * resolution meaningless without the exact tree that produced it.
   */
  readonly choices: Readonly<Record<NodeId, Candidate>>;
  readonly kind: KindId;
  readonly score: number;
  /** The part of `score` that came from context agreement, so explain() can list it. */
  readonly contextBonus: number;
  /** The part of `score` that came from op signatures, so explain() can list it. */
  readonly signatureWeight: number;
  /**
   * The part of `score` contributed by cue words near this reading — `scan`'s
   * term, and the mirror of `contextBonus` and `signatureWeight` above.
   *
   * Added once per resolution and against the resolution's *result* kind, which
   * is what a cue actually claims: "away" says this quantity is a distance, and
   * for `5 km + 3 km` the quantity is the sum. Pricing it per reading instead
   * would make it louder the longer the expression is.
   */
  readonly cueBonus: number;
  readonly confidence: number;
}

interface Slot {
  node: Node;
  candidates: Candidate[];
}

/**
 * The operand kinds a DimensionMismatchError should name, in source order.
 *
 * Deliberately not `collectSlots`: a bare numeric literal has no slot (there
 * is nothing to choose), so "2 / 20 C" used to report `temperature and
 * unknown` — naming the one operand it could see and inventing the other,
 * in the wrong order. It is a `number`, and saying so is the whole job here.
 *
 * For a quantity the source position is the quantity itself; for a convert
 * the reported candidates are the *target* unit's, so the target token's own
 * span is what source order means, not the span of the whole conversion
 * expression (which starts at the operand, before the target).
 */
/**
 * The two per-call narrowings a caller can put on the readings a slot may
 * choose from, as one predicate so `collectSlots` and `reportedOperands`
 * cannot drift apart on what "in scope" means.
 *
 * `locales` filters by the language that listed the spelling, which is what
 * `Candidate.locale` records — narrower than "the languages I read", because a
 * spelling both languages list is tagged with only the first of them. `"*"`
 * survives every list: it is the language-neutral unit-key floor (ruling R6),
 * so there is no language whose absence could exclude it, and dropping it
 * would make `{ locales: ["uk"] }` unable to read `true`.
 */
function inScope(
  kinds: KindId[] | undefined,
  locales: string[] | undefined,
): (c: Candidate) => boolean {
  return (c) =>
    (kinds === undefined || kinds.includes(c.kind)) &&
    (locales === undefined || c.locale === "*" || locales.includes(c.locale));
}

function reportedOperands(
  root: Node,
  kinds: KindId[] | undefined,
  locales: string[] | undefined,
): KindId[] {
  const refs: Array<{ start: number; kind: KindId }> = [];
  const keep = inScope(kinds, locales);
  const pick = (candidates: Candidate[]): KindId =>
    candidates.filter(keep)[0]?.kind ?? "unknown";

  walk(root, (node) => {
    if (node.type === "quantity") {
      refs.push({ start: node.span.start, kind: pick(node.candidates) });
    } else if (node.type === "literal") {
      refs.push({ start: node.span.start, kind: pick(node.candidates) });
    } else if (node.type === "convert") {
      refs.push({ start: node.targetSpan.start, kind: pick(node.target) });
    } else if (node.type === "number") {
      refs.push({ start: node.span.start, kind: NUMBER_KIND });
    }
  });

  return refs.sort((a, b) => a.start - b.start).map((r) => r.kind);
}

/**
 * Every kind the subtree rooted at `node` could come back as, without
 * enumerating a single assignment.
 *
 * Exact rather than "the kinds of the leaves underneath": for `100 km / 2 h`
 * the leaves are a length and a duration and the answer is a speed, and a
 * caller that read the leaves would prune the one target that does apply. Every
 * branch resolves through the same `registry.ops` lookup `typeOf` uses, so the
 * two cannot disagree about what an operator produces.
 *
 * The sets are tiny — one kind per leaf reading — so the cross product a binary
 * takes is a handful of map lookups, paid once per convert node at slot time
 * rather than once per assignment.
 */
function possibleKinds(
  node: Node,
  keep: (c: Candidate) => boolean,
  registry: Registry,
): Set<KindId> {
  const out = new Set<KindId>();
  switch (node.type) {
    case "number":
      out.add(NUMBER_KIND);
      break;
    case "quantity":
    case "literal":
      for (const c of node.candidates.filter(keep)) out.add(c.kind);
      break;
    case "unary":
      return possibleKinds(node.operand, keep, registry);
    case "convert":
      for (const l of possibleKinds(node.operand, keep, registry)) {
        for (const t of node.target.filter(keep)) {
          const sig = registry.ops.get(opKey("in", l, t.kind));
          if (sig !== undefined) out.add(sig.result);
        }
      }
      break;
    case "binary":
      for (const l of possibleKinds(node.left, keep, registry)) {
        for (const r of possibleKinds(node.right, keep, registry)) {
          const sig = registry.ops.get(opKey(node.op, l, r));
          if (sig !== undefined) out.add(sig.result);
        }
      }
      break;
  }
  return out;
}

function collectSlots(
  root: Node,
  kinds: KindId[] | undefined,
  locales: string[] | undefined,
  registry: Registry,
): Slot[] {
  const slots: Slot[] = [];
  const keep = inScope(kinds, locales);
  walk(root, (node) => {
    if (node.type === "quantity" || node.type === "literal") {
      slots.push({ node, candidates: node.candidates.filter(keep) });
    } else if (node.type === "convert") {
      // "10 km in m + 5" reported *length and duration* because the solver
      // enumerated `m` as minutes at the target and only found out at the very
      // end, after the pair that really has no signature — `+ | length |
      // number` — had already been recorded second. A target no `in` signature
      // can reach from anything the operand could be is not a reading, and
      // dropping it here is the same result set with a better error and fewer
      // paths to walk.
      //
      // Ruling: an error-quality change, never a semantic one. When the prune
      // would empty the slot it is abandoned and every target is kept, so
      // "10 km in kg" still reports *length in mass* rather than falling
      // through to the operand-naming fallback with no rejection to quote.
      const reachable = possibleKinds(node.operand, keep, registry);
      const all = node.target.filter(keep);
      const pruned = all.filter((c) =>
        [...reachable].some((k) => registry.ops.has(opKey("in", k, c.kind))),
      );
      slots.push({ node, candidates: pruned.length > 0 ? pruned : all });
    }
  });
  return slots;
}

/**
 * Returns the kind of `node` under `choices`, or null when no op signature
 * applies.
 *
 * `reject` is optional and every caller that only wants the kind — the two
 * scoring walks below — passes none and pays nothing. `solve` passes one from
 * exactly one place, the terminal call on a *complete* assignment, so a pair is
 * recorded once per assignment rather than once per partial walk.
 */
function typeOf(
  node: Node,
  choices: Readonly<Record<NodeId, Candidate>>,
  registry: Registry,
  reject?: (r: Rejection) => void,
): KindId | null {
  switch (node.type) {
    case "number":
      return NUMBER_KIND;
    case "quantity":
      return choices[node.id]?.kind ?? null;
    case "literal":
      return choices[node.id]?.kind ?? null;
    case "unary":
      return typeOf(node.operand, choices, registry, reject);
    case "convert": {
      const operand = typeOf(node.operand, choices, registry, reject);
      const target = choices[node.id];
      if (operand === null || target === undefined) return null;
      // Take the result from the signature rather than assuming it is the
      // target's own kind: the signature is already in hand, and a declared
      // cross-kind `in` need not be an identity on kind.
      const sig = registry.ops.get(opKey("in", operand, target.kind));
      if (sig === undefined) {
        reject?.({
          node: node.id,
          op: "in",
          left: operand,
          right: target.kind,
          spans: [node.operand.span, node.targetSpan],
        });
        return null;
      }
      return sig.result;
    }
    case "binary": {
      const left = typeOf(node.left, choices, registry, reject);
      const right = typeOf(node.right, choices, registry, reject);
      if (left === null || right === null) return null;
      const sig = registry.ops.get(opKey(node.op, left, right));
      if (sig === undefined) {
        reject?.({
          node: node.id,
          op: node.op,
          left,
          right,
          spans: [node.left.span, node.right.span],
        });
        return null;
      }
      return sig.result;
    }
  }
}

function contextBonus(
  node: Node,
  choices: Readonly<Record<NodeId, Candidate>>,
  registry: Registry,
): number {
  let bonus = 0;
  walk(node, (n) => {
    if (n.type !== "binary") return;
    const left = typeOf(n.left, choices, registry);
    const right = typeOf(n.right, choices, registry);
    if (left !== null && left === right && left !== NUMBER_KIND) bonus += CONTEXT_BONUS;
  });
  return bonus;
}

/**
 * The signature half of a candidate's score, and the mirror of `contextBonus`
 * above: same walk, same `typeOf` resolution, a different term.
 *
 * It exists because every other weight layer prices a *reading* and this one
 * prices the *operation* — see `OpSignature.weight`. A signature that declares
 * no weight contributes 0, which is why adding this moved no corpus row.
 *
 * The `convert` branch resolves its signature exactly as `typeOf` does, down to
 * looking the target's kind up in `choices` rather than assuming `in` is an
 * identity on kind: a declared cross-kind `in` is as entitled to a weight as
 * any binary is.
 */
function signatureWeight(
  node: Node,
  choices: Readonly<Record<NodeId, Candidate>>,
  registry: Registry,
): number {
  let total = 0;
  walk(node, (n) => {
    if (n.type === "binary") {
      const left = typeOf(n.left, choices, registry);
      const right = typeOf(n.right, choices, registry);
      if (left === null || right === null) return;
      total += registry.ops.get(opKey(n.op, left, right))?.weight ?? 0;
    } else if (n.type === "convert") {
      const operand = typeOf(n.operand, choices, registry);
      const target = choices[n.id];
      if (operand === null || target === undefined) return;
      total += registry.ops.get(opKey("in", operand, target.kind))?.weight ?? 0;
    }
  });
  return total;
}

function softmax(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

export function solve(
  program: Program,
  registry: Registry,
  opts: {
    maxCandidates: number;
    kinds?: KindId[];
    locales?: string[];
    input: string;
    /**
     * Kind -> summed cue weight. NOT clamped here: `scan` applies
     * `CUE_CEILING`, and a caller passing this through `EvalOptions.cues`
     * directly is trusted with it exactly as they are trusted with `weights`.
     */
    cues?: Readonly<Record<KindId, number>>;
    /**
     * Told about every pair this solve found no signature for, deduplicated,
     * in enumeration order. `explain` supplies one; `evaluate` does not, and
     * the rejections are still collected either way because the throw below
     * needs them — the sink only decides whether anyone else hears.
     */
    onReject?: (r: Rejection) => void;
  },
): Resolution[] {
  const root = program.root;
  const slots = collectSlots(root, opts.kinds, opts.locales, registry);

  const space = slots.reduce((n, s) => n * Math.max(s.candidates.length, 1), 1);
  if (space > opts.maxCandidates) {
    throw new TooAmbiguousError(opts.input, space, opts.maxCandidates);
  }

  const viable: Array<{
    choices: Record<NodeId, Candidate>;
    kind: KindId;
    score: number;
    contextBonus: number;
    signatureWeight: number;
    cueBonus: number;
  }> = [];

  // Keyed by node, op and the two kinds: the same pair reached from two
  // assignments that differ somewhere else is one rejection, and the map's
  // insertion order is enumeration order, which is what makes "the first one"
  // below a stable choice rather than an arbitrary one.
  const rejected = new Map<string, Rejection>();
  const sink = (r: Rejection): void => {
    const key = `${r.node}|${r.op}|${r.left}|${r.right}`;
    if (rejected.has(key)) return;
    // Mapped here rather than at either end: a `Rejection` that sometimes
    // indexes the normalized text and sometimes the caller's is a span bug
    // waiting for the first input normalization changes the length of.
    const mapped: Rejection = {
      ...r,
      spans: [program.input.mapSpan(r.spans[0]), program.input.mapSpan(r.spans[1])],
    };
    rejected.set(key, mapped);
    opts.onReject?.(mapped);
  };

  const enumerate = (
    index: number,
    choices: Record<NodeId, Candidate>,
    weight: number,
  ): void => {
    if (index === slots.length) {
      const kind = typeOf(root, choices, registry, sink);
      if (kind === null) return;
      const bonus = contextBonus(root, choices, registry);
      const signature = signatureWeight(root, choices, registry);
      const cue = opts.cues?.[kind] ?? 0;
      viable.push({
        choices: { ...choices },
        kind,
        score: weight + bonus + signature + cue,
        contextBonus: bonus,
        signatureWeight: signature,
        cueBonus: cue,
      });
      return;
    }
    const slot = slots[index];
    if (slot === undefined) return;
    for (const candidate of slot.candidates) {
      choices[slot.node.id] = candidate;
      enumerate(index + 1, choices, weight + candidate.weight);
      delete choices[slot.node.id];
    }
  };

  enumerate(0, {}, 0);

  if (viable.length === 0) {
    const all = [...rejected.values()];
    const first = all[0];
    if (first !== undefined) {
      // The operator's own span is the gap between the two operands. Both ends
      // are already source-relative, so the gap is too — deriving it here is
      // what lets the error quote `10 kg`, `/` and `2 m` without the solver
      // ever holding a token.
      throw new DimensionMismatchError(
        opts.input,
        first.op,
        first.left,
        first.right,
        all.map((r) => [r.left, r.right] as const),
        [
          first.spans[0],
          { start: first.spans[0].end, end: first.spans[1].start },
          first.spans[1],
        ],
      );
    }
    // No rejection recorded means no assignment ever reached an operator: a
    // slot was emptied by `kinds`/`locales` before enumeration could type
    // anything. That is the case `reportedOperands` was written for, and it
    // stays — there is no failing pair to name, only the operands that would
    // have been read.
    const operands = reportedOperands(root, opts.kinds, opts.locales);
    const left = operands[0] ?? "unknown";
    const right = operands[1] ?? "unknown";
    throw new DimensionMismatchError(
      opts.input,
      "in",
      left,
      right,
      [[left, right]],
      [program.input.mapSpan(root.span)],
    );
  }

  viable.sort(
    (a, b) =>
      b.score - a.score ||
      a.kind.localeCompare(b.kind) ||
      Object.values(a.choices)
        .map((c) => c.unit)
        .join()
        .localeCompare(
          Object.values(b.choices)
            .map((c) => c.unit)
            .join(),
        ),
  );

  const confidences = softmax(viable.map((v) => v.score));
  // Every `Resolution` and its `choices` are frozen individually below; the
  // outer `Object.freeze` is the container, the sibling fix to the
  // tokenizer's `stream.tokens[0].text = "HACK"` bug. `as Resolution[]` keeps
  // the declared (mutable) return type — a runtime guarantee, not a new
  // compile-time one, the same as `ast.ts`'s `Candidate[]`-typed fields.
  return Object.freeze(
    viable.map((v, i) =>
      Object.freeze({
        ...v,
        choices: Object.freeze(v.choices),
        confidence: confidences[i] ?? 0,
      }),
    ),
  ) as Resolution[];
}
