import { Decimal } from "../decimal";
import { NoCandidateError, UnitParseError } from "../errors";
import { NUMBER_KIND } from "../kind/ratio-ops";
import type { Candidate, LiteralReading, OpSymbol, Span, Value } from "../types";
import type { Node, NodeId } from "./ast";
import type { Resolver } from "./candidates";
import type { Token, WordToken } from "./lex";

/**
 * What the ordinary number under a claimed span scores, and the only weight in
 * this file that is not a matcher's or an analyzer's.
 *
 * A number is in nobody's alias index, so unlike the word fallback it has no
 * weight of its own to be scored by — and a claim that names no weight has to
 * keep beating it, or every matcher that starts claiming a bare number would
 * turn a formerly decided input into an `AmbiguityError` for saying nothing.
 * So the ordinary reading sits just below "claimed, unweighted", and a matcher
 * that means to *lose* to it says so: spec §6.2's `90210` is a number because
 * the postal claim weighs less than this, not because the fold hid it.
 *
 * The magnitude only has to clear `ambiguityEpsilon`, which compares softmax
 * confidences: 0.5 apart is 0.62 against 0.38, well outside the 0.05 default.
 */
export const NUMBER_FALLBACK_WEIGHT = -0.5;

/**
 * What a unit word with no number in front of it is worth. One, and frozen at
 * module level because every such atom is the same number.
 */
const IMPLIED_COUNT = new Decimal(1);

/** Every `BinaryNode.op` value. Exported so a reader outside this file (the
 * printer) can name the same type `bindingOf` takes, rather than restating
 * `Exclude<OpSymbol, "in">` as an unrelated-looking local alias. */
export type BinaryOp = Exclude<OpSymbol, "in">;

const BINDING: Record<BinaryOp, number> = {
  "+": 10,
  "-": 10,
  // Between + and *: "50 + 20% of 100" is 50 + (20% of 100). "of" arrives as
  // a *keyword* token, not an op token, so parseExpr reads this binding from
  // its own branch below rather than from the `token.op` lookup.
  of: 15,
  // The same binding, because "off" is "of" with different arithmetic and the
  // two have to group identically or "10 + 20% off 50" and "10 + 20% of 50"
  // would disagree about which addition happens first. Equal bindings are
  // fine here: the branches below recurse at `binding + 1`, so a chain stays
  // left-associative.
  off: 15,
  "*": 20,
  "/": 20,
};

/**
 * The parser's own precedence for `op`, exported so `print/print.ts` reads
 * this number directly instead of restating it. A second, hand-copied table
 * can drift silently from this one — `Record<BinaryOp, number>` only catches
 * a *new* operator the copy hasn't priced in (the object literal stops
 * compiling); it does nothing for an *existing* operator's number changing
 * here, which is exactly the drift a shared accessor closes off. `BINDING`
 * itself stays unexported — a `const` object is mutable from the outside,
 * and nothing beyond this file needs more than to ask "how tightly does this
 * bind".
 */
export function bindingOf(op: BinaryOp): number {
  return BINDING[op];
}

/**
 * Precedence `in`/`to`/`as` binds at — looser than every real operator, so
 * `1 kg in g + 500 g` reads as `(1 kg in g) + 500 g`. Exported for the same
 * reason `bindingOf` is: `print/print.ts` needs the parser's own number.
 */
export const CONVERT_BINDING = 5;

export function parse(
  tokens: Token[],
  resolver: Resolver,
  input: string,
  /**
   * Maps a normalized-relative span to one indexing `input`. Defaults to the
   * identity: every direct caller of `parse` today (this file's own tests,
   * `program.test.ts`) hands it an already-raw string with no normalization
   * step of its own, so nothing to map. `Parser.run` is the one caller that
   * has a real `NormalizedInput` and threads its `mapSpan` through — see
   * `program.ts` — which is what keeps a `NoCandidateError` thrown from the
   * engine's pipeline pointing at the caller's string rather than the
   * normalized one.
   */
  mapSpan: (span: Span) => Span = (span) => span,
): Node {
  let pos = 0;

  // Depth-first, matching `walk`'s order, so a reader can predict an id from
  // the source position rather than having to look it up.
  let nextId = 0;
  const id = () => nextId++;

  // Every id in `node`'s subtree, shifted by `delta`. A demoted `left` is not
  // always a leaf — a chain like "1 + 2 + 3" demotes the binary node that
  // "1 + 2" already became — so giving only the subtree's root a fresh id
  // would leave that root sorting after its own children: unique and dense
  // still, since nothing outside this subtree changes, but wrong relative to
  // its own contents, which is exactly the silent failure the id scheme
  // exists to catch elsewhere. Recursing through every child-bearing variant
  // keeps the whole subtree internally consistent after the shift.
  const shiftIds = (node: Node, delta: number): Node => {
    const shifted = { ...node, id: node.id + delta };
    switch (shifted.type) {
      case "binary":
        return {
          ...shifted,
          left: shiftIds(shifted.left, delta),
          right: shiftIds(shifted.right, delta),
        };
      case "unary":
        return { ...shifted, operand: shiftIds(shifted.operand, delta) };
      case "convert":
        return { ...shifted, operand: shiftIds(shifted.operand, delta) };
      default:
        return shifted;
    }
  };

  // A binary or convert node wraps an already-parsed `left`, which already
  // has an id of its own — unlike a leaf or a freshly-parsed operand, there is
  // no "just call id()" for the wrap itself. The wrap takes over `left`'s id,
  // and `left`'s whole subtree is shifted up by one to make room: at every
  // wrap site, `left` occupies the contiguous range `[left.id, nextId - 1]`
  // with `left.id` minimal (true for leaves, for `unary`, which draws its id
  // before its operand, for the paren branch, which forwards its inner
  // result untouched, and restored here by the shift), so shifting the whole
  // range by one and having `id()` account for the id that shift consumes
  // keeps every id unique and dense while giving the wrap the smallest id in
  // its own new range — parent-before-children, matching `walk`.
  const demote = (node: Node): { nodeId: NodeId; demoted: Node } => {
    const nodeId = node.id;
    id(); // consumed by the shift below, not handed out directly
    return { nodeId, demoted: shiftIds(node, 1) };
  };

  const peek = (): Token | undefined => tokens[pos];
  const span = (a: Span, b: Span): Span => ({ start: a.start, end: b.end });

  const claimedValue = (r: LiteralReading): Value =>
    Object.freeze({
      kind: r.kind,
      canonical: r.canonical,
      unit: r.unit,
      ...(r.meta ? { meta: r.meta } : {}),
    });

  const candidateFor = (r: LiteralReading, surface: string): Candidate =>
    resolver.literal({ kind: r.kind, unit: r.unit, surface, weight: r.weight });

  /**
   * The word a claimed token can still be read as a *unit* by — which is only
   * ever the one underneath a single-token claim, since a claim is a value and a
   * value is not a unit. "3pm in tokyo" needs it: geo claims the city, datetime
   * registers the zone, and both readings have to reach the solver for §6.3's
   * "neither needs a tiebreak" to be true of anything.
   */
  const unitWordOf = (token: Token): WordToken | undefined => {
    if (token.type === "word") return token;
    if (token.type === "literal" && token.fallback?.type === "word")
      return token.fallback;
    return undefined;
  };

  function parseAtom(): Node {
    const token = peek();
    if (token === undefined) throw new UnitParseError(input);

    if (token.type === "lparen") {
      pos += 1;
      const inner = parseExpr(0);
      const close = peek();
      if (close === undefined || close.type !== "rparen") throw new UnitParseError(input);
      pos += 1;
      return inner;
    }

    if (token.type === "literal") {
      pos += 1;
      const candidates: Candidate[] = [];
      const values = new Map<Candidate, Value>();

      for (const reading of token.readings) {
        const candidate = candidateFor(reading, token.text);
        candidates.push(candidate);
        values.set(candidate, claimedValue(reading));
      }

      // The number under the claim, which is a value in its own right and so
      // belongs here beside them. A word is not: it is a unit label, and a unit
      // label alone has never been a legal atom — `unitWordOf` reaches it from
      // the two positions where one is.
      const under = token.fallback;
      if (under?.type === "number") {
        const candidate = resolver.literal({
          kind: NUMBER_KIND,
          unit: "one",
          surface: token.text,
          weight: NUMBER_FALLBACK_WEIGHT,
        });
        candidates.push(candidate);
        values.set(
          candidate,
          Object.freeze({ kind: NUMBER_KIND, canonical: under.value, unit: "one" }),
        );
      }

      return {
        id: id(),
        type: "literal",
        candidates,
        values,
        span: { start: token.start, end: token.end },
      };
    }

    if (token.type === "op" && token.op === "-") {
      pos += 1;
      // Taken before the operand is parsed, so ids run parent-then-child.
      const nodeId = id();
      const operand = parseExpr(30);
      return {
        id: nodeId,
        type: "unary",
        op: "-",
        operand,
        span: span(token, operand.span),
      };
    }

    if (token.type === "number") {
      pos += 1;
      const next = peek();
      const word = next === undefined ? undefined : unitWordOf(next);
      if (next !== undefined && word !== undefined) {
        const candidates = resolver.resolve(word.text);
        // A claimed token whose word resolves to no unit is left as the claim it
        // is, and the expression fails on the leftover exactly as it did before
        // the fallback existed. Reporting a missing unit here would name a token
        // nothing ever tried to read as one — "5 nice" is a number beside a
        // city, not a number beside a bad unit.
        if (candidates.length === 0 && next.type === "word") {
          throw new NoCandidateError(input, word.text, resolver.nearest(word.text), [
            mapSpan({ start: next.start, end: next.end }),
          ]);
        }
        if (candidates.length > 0) {
          pos += 1;
          return {
            id: id(),
            type: "quantity",
            value: token.value,
            candidates,
            span: span(token, next),
          };
        }
      }
      return {
        id: id(),
        type: "number",
        value: token.value,
        span: { start: token.start, end: token.end },
      };
    }

    // A unit word with no number in front of it, counted once. "kg" is a
    // kilogram, "cm" is a centimetre, and "kg + 3 kg" is four of them — which
    // is why this is an atom rather than a special case for a one-token input.
    //
    // This moves a line the parser used to hold: a unit label alone was not a
    // legal atom, and `unitWordOf` reached one only from the two positions
    // where a label belongs. The line was worth holding while a label could
    // only be a label; it stops being worth holding once the count it lacks
    // has an obvious value. What it protected against is still protected by
    // `countable` — an opaque kind's units are names, not scales, so a bare
    // country code or zone name is no more an atom now than it was before.
    //
    // Only `token.type === "word"`, never a claimed token's fallback: a claim
    // is already a value, and reading "tomorrow" as one of something would
    // take a decided input and make it ambiguous.
    if (token.type === "word") {
      const candidates = resolver.countable(token.text);
      if (candidates.length > 0) {
        pos += 1;
        return {
          id: id(),
          type: "quantity",
          value: IMPLIED_COUNT,
          candidates,
          span: { start: token.start, end: token.end },
        };
      }
    }

    throw new UnitParseError(input);
  }

  function parseExpr(minBinding: number): Node {
    let left = parseAtom();

    for (;;) {
      const token = peek();
      if (token === undefined) break;

      // "to" and "as" arrive here as `in` too: a locale lists them as aliases
      // under its `in` key, and keywordFor returns the key, never the alias.
      if (token.type === "keyword" && token.keyword === "in") {
        if (CONVERT_BINDING < minBinding) break;
        pos += 1;
        const unit = peek();
        if (unit === undefined) throw new UnitParseError(input);

        // A kind claimed the target and marked the claim targetable: "japan to
        // ukraine", "3pm in japan". The matcher already built the Value and
        // already named a registered unit, so there is nothing to resolve — and
        // the Value travels on the node, because the signature that receives it
        // reads its `meta`.
        //
        // `targetable` is checked per reading rather than on the token. Every
        // literal is a value, but only some values are conversion *targets*:
        // datetime claims "tomorrow", and accepting that here made
        // `today in tomorrow` a zone conversion returning today, where it had
        // always thrown. A reading that does not opt in contributes nothing,
        // and a token whose readings all decline still reaches the
        // UnitParseError below unless the word underneath it is a real unit.
        if (unit.type === "literal") {
          const target: Candidate[] = [];
          const targetValues = new Map<Candidate, Value>();
          for (const reading of unit.readings) {
            if (reading.targetable !== true) continue;
            const candidate = candidateFor(reading, unit.text);
            target.push(candidate);
            targetValues.set(candidate, claimedValue(reading));
          }
          // And the ordinary unit readings of the word underneath, which is the
          // one position where a claimed token is legitimately a label: geo
          // claims "tokyo" the city, datetime registers it as a zone, and
          // "3pm in tokyo" has to be able to mean either.
          //
          // Minus the ones a claim already named, which is not an optimisation.
          // A bare alias and a claim that agree on kind and unit are one target,
          // and only the claim carries the `meta` its signature reads — the
          // alias would take the stand-in below, whose meta is the *left*
          // operand's, which is the failure `targetValue` was added to prevent.
          // Every country name is a place alias, so "3pm in ukraine" would carry
          // a second reading with no zone on its right; `evaluate` never reached
          // it, and `suggest`, which evaluates every assignment, returned an
          // empty list for the whole input.
          const word = unitWordOf(unit);
          if (word !== undefined) {
            const claimed = new Set(target.map((c) => `${c.kind}\u0000${c.unit}`));
            for (const c of resolver.resolve(word.text))
              if (!claimed.has(`${c.kind}\u0000${c.unit}`)) target.push(c);
          }

          if (target.length === 0) throw new UnitParseError(input);
          pos += 1;
          {
            const { nodeId, demoted: operand } = demote(left);
            left = {
              id: nodeId,
              type: "convert",
              operand,
              target,
              ...(targetValues.size > 0 ? { targetValues } : {}),
              span: span(operand.span, unit),
              targetSpan: { start: unit.start, end: unit.end },
            };
          }
          continue;
        }

        if (unit.type !== "word") throw new UnitParseError(input);
        const target = resolver.resolve(unit.text);
        if (target.length === 0) {
          throw new NoCandidateError(input, unit.text, resolver.nearest(unit.text), [
            mapSpan({ start: unit.start, end: unit.end }),
          ]);
        }
        pos += 1;
        {
          const { nodeId, demoted: operand } = demote(left);
          left = {
            id: nodeId,
            type: "convert",
            operand,
            target,
            span: span(operand.span, unit),
            targetSpan: { start: unit.start, end: unit.end },
          };
        }
        continue;
      }

      // "of" and "off" take the same shape — percentage on the left, base on
      // the right — and differ only in the signature the evaluator then looks
      // up, so one branch reads both. Neither is folded into an op token in
      // `wordops`: that fold rewrites a keyword into an *existing* arithmetic
      // operator, and these two have none to become.
      if (
        token.type === "keyword" &&
        (token.keyword === "of" || token.keyword === "off")
      ) {
        const op = token.keyword;
        const binding = BINDING[op];
        if (binding < minBinding) break;
        pos += 1;
        const { nodeId, demoted: demotedLeft } = demote(left);
        const right = parseExpr(binding + 1);
        left = {
          id: nodeId,
          type: "binary",
          op,
          left: demotedLeft,
          right,
          span: span(demotedLeft.span, right.span),
        };
        continue;
      }

      if (token.type !== "op") break;
      const binding = BINDING[token.op as Exclude<OpSymbol, "in">];
      if (binding === undefined || binding < minBinding) break;

      pos += 1;
      const { nodeId, demoted: demotedLeft } = demote(left);
      const right = parseExpr(binding + 1);
      left = {
        id: nodeId,
        type: "binary",
        op: token.op as Exclude<OpSymbol, "in">,
        left: demotedLeft,
        right,
        span: span(demotedLeft.span, right.span),
      };
    }

    return left;
  }

  const node = parseExpr(0);
  if (pos !== tokens.length) throw new UnitParseError(input);
  return node;
}
