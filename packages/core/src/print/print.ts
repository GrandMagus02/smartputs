import type { Decimal } from "../decimal";
import { fromCanonical, toCanonical } from "../eval/convert";
import { formatNumber, formatValue } from "../format/format";
import type { Registry } from "../kind/registry";
import type { Node, NodeId } from "../parse/ast";
import { type BinaryOp, bindingOf, CONVERT_BINDING } from "../parse/pratt";
import type { Program } from "../parse/program";
import type { Resolution } from "../solve/solver";
import type {
  Candidate,
  FormatOptions,
  Keyword,
  KindId,
  Locale,
  NumeralSpeller,
  RateLookup,
  Value,
} from "../types";
import { avoidSpellings, pickCandidate, spelledUnitWord, unitWord } from "./unit-word";

// `format/format.ts` stays the one place `formatValue` is defined; this is a
// re-export, not a second copy, so a caller who wants the bare function
// without standing up a `Printer` still has one place to import it from.
export { DISPLAY_PRECISION, formatNumber, formatValue } from "../format/format";
export type { FormatOptions } from "../types";

export type PrintMode = "canonical" | "verbatim" | "resolved";

export interface PrintOptions {
  /** Defaults to "canonical". */
  mode?: PrintMode;
  /**
   * Required for `"resolved"`. Unused by `"canonical"` and `"verbatim"`.
   * Missing on a `"resolved"` print throws rather than quietly falling back
   * to `"canonical"` — see `buildCtx`.
   */
  resolution?: Resolution;
  /**
   * Rebase every quantity of the result kind onto this unit — resolved (via
   * the registry's alias index) once per call, not once per node, so a typo
   * that would fail to rebase anything still fails loudly. Ignored by
   * `"verbatim"`: that mode never computes a value, only echoes source text.
   *
   * Carve-out: an ambiguous quantity under `"canonical"` (no `Resolution`,
   * so `pickCandidate` cannot choose) is never rebased, even when one of its
   * candidates matches — `canonical` genuinely does not know this node's
   * kind, the same reason it echoes the raw surface instead of an alias, so
   * rebasing it would be guessing which reading to convert. The result can
   * look mixed-unit on the printed line (`{ unit: "cm" }` on `"10 m + 5 km"`
   * rebases only the unambiguous `"5 km"`, producing `"10 m + 500,000 cm"`);
   * `"resolved"` with an actual `Resolution` rebases the ambiguous quantity
   * too, since it has a chosen kind to check `unit` against. See
   * `renderQuantity`'s doc comment.
   */
  unit?: string;
  /**
   * "thirty degrees plus fifteen degrees" — reads `Locale.spell` (a
   * `NumeralSpeller`, built by `cardinalSpeller` from the same tables that
   * parse numerals back) for each number, `Locale.keywords`'s first word form
   * for a symbolic operator (`+ - * /`), and `UnitLexeme.display` for each
   * unit, selecting a plural category with `Intl.PluralRules(locale.id)`
   * against the number printed beside it (see `spelledUnitWord`).
   *
   * Throws if the configured locale declares no `spell` at all — a `spelled`
   * print that silently fell back to digits would be the same class of bug
   * as `"resolved"` degrading to `"canonical"` for a missing `Resolution`.
   * Once a locale does have `spell`, one specific number can still fall back
   * to digits: `cardinalSpeller` returns `null` for a non-integer, a negative
   * magnitude, or one beyond the locale's largest declared scale, and
   * `renderMagnitude`'s caller prints that number's digits when it does — a
   * documented, tested fallback for a specific value, never a silent one for
   * the whole feature.
   *
   * Composes with the other options: `spelled` + `"resolved"` spells the
   * resolved candidate's unit; `spelled` + `unit` spells the rebased
   * quantity. It overrides `symbols` for the unit label specifically — a
   * spelled print's unit is a written word (`UnitLexeme.display`, falling
   * back to its alias) or nothing, never a glyph, so `symbols` is not
   * consulted at all once `spelled` is on (see `spelledUnitWord`).
   *
   * An operator with no word form in the locale keeps its symbol rather than
   * inventing one — the same rule a missing `display` follows for a unit,
   * and a missing `symbol` follows under `symbols`. `"of"`/`"off"` already
   * print their locale word regardless of `spelled` (`opWord`'s existing
   * cases), so this only changes `+ - * /`; a unary minus has no word form in
   * `Locale.keywords` at all (there is no `Keyword` for negation) and always
   * keeps its symbol, spelled or not — only its operand's magnitude and unit
   * spell.
   *
   * An ambiguous quantity under `"canonical"` (no `Resolution`, so
   * `pickCandidate` cannot choose) is unaffected by `spelled` for the same
   * reason it is unaffected by `unit`/`precision`: with no chosen candidate
   * there is no unit — or plural category — to derive at all, so the whole
   * quantity is echoed exactly as typed. See `PrintOptions.unit`'s doc
   * comment for the same carve-out on rebasing.
   *
   * Breaks the round-trip contract in whatever way the number, operator or
   * unit word cannot lex back — expected, and out of scope for
   * `roundtrip.test.ts`, which only calls `print` with default options (see
   * that file's own doc comment and `PrintOptions.symbols`'s).
   *
   * Ignored by `"verbatim"`, like `symbols`/`spacing`/`unit`: that mode never
   * computes a value or reads the tree, only echoes source text.
   */
  spelled?: boolean;
  /**
   * "30 m²" rather than "30 m2" — reads `UnitLexeme.symbol`, falling back to
   * the unit's first alias when a unit has no symbol of its own, never
   * inventing one. Ignored by `"verbatim"`.
   *
   * Breaks the round-trip contract by design in some cases (a symbol like
   * `"m²"` does not lex back through every path — see `unitWord`'s doc
   * comment). That is expected: the contract is specified for `"canonical"`
   * with default options only.
   *
   * On `"resolved"`, an ambiguous node whose candidates share one symbol as
   * well as one alias table (temperature/tempdelta's `"°C"`) still has
   * nothing to reveal, so `symbols` is inert there too — see `unitWord`'s
   * doc comment.
   */
  symbols?: boolean;
  /**
   * Significant digits for a quantity `unit` rebases. Before `unit` can
   * rebase a quantity onto a different unit there is nothing to apply this
   * to: `canonical`/`resolved` otherwise reprint the literal the user typed
   * via `printDecimal`, not a number the printer itself derived. Harmless,
   * not an error, when no quantity on the tree ends up rebased — the same
   * "nothing to apply to" case as `value()`'s `rates` on a kind with no FX.
   */
  precision?: number;
  /**
   * "30deg+15deg" vs "30 deg + 15 deg". Defaults to `"normal"`. `"tight"`
   * only squeezes the number-unit gap and the space around a symbolic
   * operator (`+ - * /`); a keyword operator (`in`, `of`, `off`) always keeps
   * its surrounding spaces even under `"tight"` — gluing two words together
   * would produce a different, unreadable word ("2kmin m"), not just a
   * differently-spaced one. Ignored by `"verbatim"`.
   */
  spacing?: "tight" | "normal";
}

export interface PrinterOptions {
  registry: Registry;
  locale: Locale;
  rates?: RateLookup;
  rounding?: Decimal.Rounding;
}

/**
 * The binding power a unary operand is parsed at (`parse/pratt.ts`'s
 * `parseExpr(30)`). Higher than every real operator, so a binary or convert
 * node reachable only through explicit source parens always gets them back.
 */
const UNARY_OPERAND_BINDING = 30;

/** Atoms — number, quantity, literal, unary — never need parens as a child. */
const ATOM_PRECEDENCE = Number.POSITIVE_INFINITY;

/**
 * `"+ - * /"`'s locale word, under `spelled`. The deliberate mirror of
 * `parse/wordops.ts`'s `KEYWORD_OPS` (`Keyword -> OpSymbol`, for parsing) in
 * the opposite direction (`OpSymbol -> Keyword`, for printing) — not the same
 * object inverted, because that map also folds the phrasal "divided by"/
 * "multiplied by" spelling into one op, a distinction printing never needs to
 * make (there is exactly one word to print back, `keywords.over[0]` or
 * `keywords.times[0]`, whichever `en.ts` declares). `"of"`/`"off"` are not
 * here: `opWord` already spells them regardless of `spelled` — they are word
 * operators to begin with — so only the four symbolic ops need a mapping.
 */
const OP_KEYWORDS: Record<"+" | "-" | "*" | "/", Keyword> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "over",
};

/**
 * `node`'s own precedence, read from `parse/pratt.ts`'s `bindingOf`/
 * `CONVERT_BINDING` rather than a table restated here — the printer reads
 * the parser's precedence directly, so the two cannot disagree.
 */
function precedenceOf(node: Node): number {
  switch (node.type) {
    case "binary":
      return bindingOf(node.op);
    case "convert":
      return CONVERT_BINDING;
    default:
      return ATOM_PRECEDENCE;
  }
}

/**
 * What a node needs printed, threaded through the whole recursive descent so
 * `canonical` and `resolved` share one code path rather than two that could
 * drift apart. `verbatim` never reaches this — it short-circuits in `print`/
 * `node` before a `RenderCtx` is even built, because it reads source text and
 * spans, not the tree.
 */
interface RenderCtx {
  readonly mode: "canonical" | "resolved";
  readonly resolution?: Resolution;
  readonly symbols: boolean;
  readonly spacing: "tight" | "normal";
  /** Resolved once per `print()`/`node()` call from `PrintOptions.unit`, not
   * once per node — a typo in the option fails loudly exactly once. */
  readonly rebase?: { readonly kind: KindId; readonly unit: string };
  readonly precision?: number;
  /**
   * `this.locale.spell`, carried into the ctx only when `PrintOptions.spelled`
   * was `true` — set here (once per call) rather than read from `this.locale`
   * again at every node is what lets `buildCtx` be the single place that
   * throws for a missing `spell`; every node downstream only ever asks
   * "is `ctx.spell` set", never "is spelling on and does the locale support
   * it", so there is exactly one place that can get that check wrong.
   */
  readonly spell?: NumeralSpeller;
}

/**
 * Renders a `Program` (`print`) and a `Value` (`value`) — two jobs in one
 * class because both need the same registry and locale, and a caller doing
 * both today (`createEngine`'s `toResult`) would otherwise thread the two
 * separately for no reason.
 */
export class Printer {
  private readonly registry: Registry;
  private readonly locale: Locale;
  private readonly rates?: RateLookup;
  private readonly rounding?: Decimal.Rounding;

  constructor(cfg: PrinterOptions) {
    this.registry = cfg.registry;
    this.locale = cfg.locale;
    if (cfg.rates !== undefined) this.rates = cfg.rates;
    if (cfg.rounding !== undefined) this.rounding = cfg.rounding;
    Object.freeze(this);
  }

  /**
   * `formatValue(value, this.registry, this.locale, opts)`, with this
   * instance's own `rates`/`rounding` folded in wherever the caller's `opts`
   * did not already say — the caller's `opts` always wins, the same
   * "explicit beats configured" rule every stage here follows.
   */
  value(v: Value, opts: FormatOptions = {}): string {
    return formatValue(v, this.registry, this.locale, {
      ...(this.rates !== undefined ? { rates: this.rates } : {}),
      ...(this.rounding !== undefined ? { rounding: this.rounding } : {}),
      ...opts,
    });
  }

  print(program: Program, opts: PrintOptions = {}): string {
    const mode = opts.mode ?? "canonical";
    if (mode === "verbatim") {
      // Reads `Program.input.source` directly, not any node's mapped span —
      // the whole-program case is simpler than `node()`'s and sidesteps its
      // NFKC caveat entirely: `source` is "exactly what the caller passed"
      // by construction (see `NormalizedInput`'s own doc comment), whatever
      // normalization did or didn't do to it. This is also the only way a
      // padded or double-spaced input reproduces exactly — the root node's
      // own span excludes surrounding whitespace the normalizer trimmed,
      // so mapping *its* span back would drop the padding, not keep it.
      return program.input.source;
    }
    const ctx = this.buildCtx(mode, opts);
    return this.printNode(program.root, ctx);
  }

  /**
   * Prints the subtree rooted at `id` — same modes, same options as `print`
   * — for a caller that wants one node's text rather than the whole program
   * (a UI highlighting a single operand, for instance), which is the reason
   * every node carries a stable id at all.
   *
   * Unlike `print`, `"verbatim"` here does go through `NormalizedInput.mapSpan`:
   * a subexpression's own text, excluding whatever surrounds it, is precisely
   * what mapping *that node's* span answers. See `verbatimSlice` for the one
   * case (an NFKC length change) where that mapping cannot be trusted.
   */
  node(program: Program, id: NodeId, opts: PrintOptions = {}): string {
    const target = program.nodes[id];
    if (target === undefined) {
      throw new Error(`Printer.node: no node with id ${id} in this program`);
    }
    const mode = opts.mode ?? "canonical";
    if (mode === "verbatim") {
      return this.verbatimSlice(program, target);
    }
    const ctx = this.buildCtx(mode, opts);
    return this.printNode(target, ctx);
  }

  /**
   * `NormalizedInput.mapSpan` translates `node`'s normalized-relative span
   * back into `program.input.source` coordinates; slicing `source` there is
   * the original text for exactly that node — the general mechanism spec
   * §4.6 describes for `verbatim`.
   *
   * The one case that mechanism cannot serve: once NFKC has changed the
   * string's length, `mapSpan` has no character-level correspondence to fall
   * back on and answers with the whole source for *every* span (see
   * `normalize.ts`'s own doc comment on `nfkcShifted`) — which would silently
   * hand back text that does not belong to `node` at all. `program.input`
   * does not expose that flag directly, but it always shows up as a
   * `reason: "nfkc"` edit, which is what this checks. Throwing here is the
   * same call `resolved` makes for a missing `Resolution`: a `node()` call
   * that quietly returned the wrong slice would be worse than one that failed
   * loudly, because the caller has no way to tell the two apart from the
   * string alone.
   */
  private verbatimSlice(program: Program, node: Node): string {
    if (program.input.edits.some((e) => e.reason === "nfkc")) {
      throw new Error(
        "Printer.node: verbatim cannot address a single node after NFKC changed " +
          "the source's length — every span maps to the whole source (see " +
          "NormalizedInput.mapSpan), so there is no single node's text to return",
      );
    }
    const span = program.input.mapSpan(node.span);
    return program.input.source.slice(span.start, span.end);
  }

  /**
   * Turns `PrintOptions` into the `RenderCtx` the recursive printer reads,
   * doing the three checks that must happen once per call rather than once
   * per node: `"resolved"` needs a `Resolution` at all (a missing one throws
   * here, never silently degrading to `canonical` — see `PrintOptions.resolution`'s
   * doc comment), `unit` needs to name exactly one registered unit (an
   * unknown or ambiguous one throws in `resolveRebaseTarget`), and `spelled`
   * needs the locale to actually declare `spell` (a missing one throws here
   * too — see `PrintOptions.spelled`'s doc comment).
   */
  private buildCtx(mode: "canonical" | "resolved", opts: PrintOptions): RenderCtx {
    if (mode === "resolved" && opts.resolution === undefined) {
      throw new Error(
        'Printer: mode "resolved" requires { resolution } — printing it as ' +
          '"canonical" instead would hide exactly the choice the caller asked to see',
      );
    }
    const rebase =
      opts.unit !== undefined ? this.resolveRebaseTarget(opts.unit) : undefined;
    const spell = opts.spelled === true ? this.locale.spell : undefined;
    if (opts.spelled === true && spell === undefined) {
      throw new Error(
        'Printer: { spelled: true } requires the locale to declare "spell" — ' +
          "printing digits instead would be the same silent fallback " +
          '"resolved" refuses to make for a missing Resolution',
      );
    }
    return {
      mode,
      ...(opts.resolution !== undefined ? { resolution: opts.resolution } : {}),
      symbols: opts.symbols === true,
      spacing: opts.spacing ?? "normal",
      ...(rebase !== undefined ? { rebase } : {}),
      ...(opts.precision !== undefined ? { precision: opts.precision } : {}),
      ...(spell !== undefined ? { spell } : {}),
    };
  }

  /**
   * `PrintOptions.unit` names a unit the way source text does — an alias,
   * folded through the registry's own `aliasIndex` exactly as an ordinary
   * token would be — not a `(kind, unit)` pair, so it can itself be unknown
   * or ambiguous. Both throw: a rebase silently applied to the wrong kind, or
   * silently skipped because the name did not resolve, is the same class of
   * bug `resolved`'s missing-`Resolution` check exists to rule out.
   */
  private resolveRebaseTarget(unit: string): { kind: KindId; unit: string } {
    const key = unit.toLocaleLowerCase(this.locale.id);
    const entries = this.registry.aliasIndex.get(key) ?? [];
    const first = entries[0];
    if (first === undefined) {
      throw new Error(
        `Printer: { unit: ${JSON.stringify(unit)} } does not name a registered unit`,
      );
    }
    if (entries.length > 1) {
      throw new Error(
        `Printer: { unit: ${JSON.stringify(unit)} } is ambiguous (${entries
          .map((e) => `${e.kind}:${e.unit}`)
          .join(", ")}) — pass an alias specific to one kind`,
      );
    }
    return { kind: first.kind, unit: first.unit };
  }

  /**
   * Renders `node` as it would stand alone, then wraps it in parentheses if
   * its own precedence is lower than `minBinding` — the position it is being
   * printed into demands at least that much binding power to be safely
   * unparenthesized. This is the exact inverse of `parse/pratt.ts`'s
   * `parseExpr(minBinding)`: that function consumes an operator only when
   * its binding is `>= minBinding`, so a node whose own binding falls short
   * of what its position requires would, printed bare, be re-grouped
   * differently on reparse — which is precisely what round-tripping forbids.
   */
  private printChild(node: Node, minBinding: number, ctx: RenderCtx): string {
    const text = this.printNode(node, ctx);
    return precedenceOf(node) < minBinding ? `(${text})` : text;
  }

  private printNode(node: Node, ctx: RenderCtx): string {
    switch (node.type) {
      case "number":
        // A bare number has no unit to spell, but its own magnitude still
        // does — `ctx.spell` falls back to `printDecimal` for exactly the
        // documented cases `cardinalSpeller` declines (non-integer, negative,
        // too large), the same per-value fallback `renderMagnitude`'s caller
        // uses for a quantity's number.
        return ctx.spell !== undefined
          ? (ctx.spell(node.value) ?? this.printDecimal(node.value))
          : this.printDecimal(node.value);

      case "quantity":
        return this.renderQuantity(node.id, node.value, node.candidates, ctx);

      // Not reachable by any BUILTIN_KINDS input — no built-in kind registers
      // a literal matcher (see `parity.ts`'s doc comment) — but a plugin kind
      // can claim a span, and a literal node's canonical text is simply
      // whatever was typed: a claim is recognized textually, not through any
      // alias table, so there is no "normalized spelling" to canonicalize it
      // to. Unaffected by `mode`: every candidate on one literal node shares
      // the same `surface` (one span, several readings of it), so there is
      // nothing for `"resolved"` to reveal here that `candidates[0]` doesn't
      // already show — unlike a quantity's unit word, no reading changes
      // what text would be printed, only what it would be worth.
      case "literal":
        return node.candidates[0]?.surface ?? "";

      case "unary":
        // No space: matches the convention every unary input in the corpus
        // already uses ("-5 km"), and reparsing is indifferent either way —
        // the lexer treats "-" as its own token regardless of adjacency.
        // Unaffected by `spacing`: this is already as tight as it gets.
        return `-${this.printChild(node.operand, UNARY_OPERAND_BINDING, ctx)}`;

      case "convert": {
        // The operand needs protecting exactly like a binary child does, at
        // threshold `CONVERT_BINDING`: reprinting `X in u` re-parses `X`
        // inside some `parseExpr(m)` with `m <= CONVERT_BINDING` (that is
        // what let the parser consume `in` for this convert in the first
        // place, un-parenthesized). If `X`'s own top operator has binding
        // `b >= CONVERT_BINDING`, every right-recursive threshold inside `X`
        // is `> CONVERT_BINDING` too (each step is `+1` on an already-`>=`
        // value), so none of them will swallow the trailing `in` themselves —
        // control bubbles back up to the `parseExpr(m)` that is actually
        // building this convert, which then takes `in` for the whole of `X`,
        // matching the tree. But if `b < CONVERT_BINDING` (comparison
        // operators, once they exist, bind at 3), `X`'s *own* right operand
        // is parsed at `b + 1 <= CONVERT_BINDING`, so that inner call absorbs
        // `in` into `X`'s right subtree instead: printing `1 < 2 in g` bare
        // would re-parse as `1 < (2 in g)`, not `(1 < 2) in g`. Comparing
        // against `CONVERT_BINDING` (not `0`) is what forces the parens
        // there. A nested convert (precedence exactly `CONVERT_BINDING`)
        // still gets none: `2 km in m in cm` is unaffected.
        //
        // Note: the exhaustive `Record<BinaryOp, number>` a new operator
        // forces open in `parse/pratt.ts` does not cover this — it only
        // demands *a* binding power for the new operator, not that this
        // threshold is `CONVERT_BINDING` rather than `0`. This comment, and
        // `print.test.ts`'s comparison-operator convert case (once
        // comparisons land), are what actually keep it correct.
        //
        // The operand-and-keyword join always keeps its spaces, even under
        // `spacing: "tight"` — see `PrintOptions.spacing`'s doc comment.
        const operand = this.printChild(node.operand, CONVERT_BINDING, ctx);
        const inWord = this.locale.keywords.in?.[0] ?? "in";
        return `${operand} ${inWord} ${this.renderTarget(node.id, node.target, ctx)}`;
      }

      case "binary": {
        const binding = bindingOf(node.op);
        const left = this.printChild(node.left, binding, ctx);
        // Right recurses at `binding + 1`: the parser's own right-hand
        // `parseExpr(binding + 1)` is what makes this grammar left-associative,
        // so a right child at the *same* binding (only reachable through
        // explicit source parens, since without them the parser would have
        // folded it into `left` instead) must keep its parens on reprint.
        const right = this.printChild(node.right, binding + 1, ctx);
        // "of"/"off" are locale words; squeezing them against their operands
        // under `spacing: "tight"` would glue two words into a third one
        // ("20%of100") rather than just remove a space — see
        // `PrintOptions.spacing`'s doc comment. `+ - * /` are symbols, so no
        // such risk, and are the only ones `spacing: "tight"` ever squeezes.
        const isWordOp = node.op === "of" || node.op === "off";
        const sep = ctx.spacing === "tight" && !isWordOp ? "" : " ";
        return `${left}${sep}${this.opWord(node.op, ctx)}${sep}${right}`;
      }
    }
  }

  /** The literal digits the user typed, exactly — never rounded or grouped:
   * this is the parsed literal itself, not a computed value, so there is
   * nothing for `formatValue`'s precision or grouping rules to apply to. */
  private printDecimal(value: Decimal): string {
    return value.toFixed();
  }

  /**
   * `"of"`/`"off"` already print their locale word regardless of `spelled` —
   * they are word operators to begin with, nothing for `spelled` to change.
   * `+ - * /` print bare under every other option, but spell to
   * `Locale.keywords`'s first word form once `ctx.spell` is set (`OP_KEYWORDS`
   * is the deliberate mirror of `parse/wordops.ts`'s `KEYWORD_OPS`, walked in
   * the opposite direction — not literally shared, since that map also folds
   * the phrasal "divided by"/"multiplied by" case this one has no need of),
   * falling back to the bare symbol when the locale has no word for it: the
   * same "no invented word" rule a missing `display` follows for a unit.
   */
  private opWord(op: BinaryOp, ctx: RenderCtx): string {
    switch (op) {
      case "of":
        return this.locale.keywords.of?.[0] ?? "of";
      case "off":
        return this.locale.keywords.off?.[0] ?? "off";
      default:
        if (ctx.spell === undefined) return op;
        return this.locale.keywords[OP_KEYWORDS[op]]?.[0] ?? op;
    }
  }

  /**
   * A quantity's `"<number> <unit>"`, or the ambiguous echo when
   * `pickCandidate` cannot choose.
   *
   * That echo branch also means `ctx.rebase`/`ctx.precision` are silently
   * skipped for this node even when `ctx.rebase.kind` matches one of
   * `candidates`' kinds — deliberately: with no chosen candidate there is no
   * single kind to check `unit` against without guessing, the same reason
   * `canonical` echoes the surface here instead of an alias. See
   * `PrintOptions.unit`'s doc comment for the resulting mixed-unit output
   * this can produce on one printed line, and why `"resolved"` (which does
   * have a chosen candidate) does not have this carve-out.
   */
  private renderQuantity(
    nodeId: NodeId,
    value: Decimal,
    candidates: readonly Candidate[],
    ctx: RenderCtx,
  ): string {
    const sep = ctx.spacing === "tight" ? "" : " ";
    const chosen = pickCandidate(candidates, nodeId, ctx);
    if (chosen === undefined) {
      // No chosen candidate means no known kind — not just no alias to
      // canonicalize to (as the comment above already covers) but no unit to
      // derive a plural category from either, so `spelled` has nothing to do
      // here and the whole quantity is echoed exactly as typed, digits
      // included. See `PrintOptions.spelled`'s doc comment.
      return `${this.printDecimal(value)}${sep}${candidates[0]?.surface ?? ""}`;
    }
    const magnitude = this.renderMagnitude(value, chosen, ctx);
    const avoid = avoidSpellings(candidates, chosen, this.registry, this.locale);
    const ambiguousSurface = candidates.length > 1 ? candidates[0]?.surface : undefined;
    const unit =
      ctx.spell !== undefined
        ? spelledUnitWord(
            magnitude.kind,
            magnitude.unit,
            magnitude.magnitude,
            avoid,
            ambiguousSurface,
            this.registry,
            this.locale,
          )
        : unitWord(
            magnitude.kind,
            magnitude.unit,
            ctx,
            avoid,
            ambiguousSurface,
            this.registry,
            this.locale,
          );
    const numberText =
      ctx.spell !== undefined
        ? (ctx.spell(magnitude.magnitude) ?? magnitude.text)
        : magnitude.text;
    return `${numberText}${sep}${unit}`;
  }

  /**
   * A convert's target unit alone — there is no magnitude of its own to
   * rebase or apply `precision` to, only the label, which `unit` can still
   * substitute when `pickCandidate` has a chosen candidate. An ambiguous
   * target under `"canonical"` echoes the raw surface and skips `unit`
   * entirely, for the same reason `renderQuantity`'s ambiguous branch does —
   * see its doc comment.
   */
  private renderTarget(
    nodeId: NodeId,
    target: readonly Candidate[],
    ctx: RenderCtx,
  ): string {
    const chosen = pickCandidate(target, nodeId, ctx);
    if (chosen === undefined) return target[0]?.surface ?? "";
    const unitId =
      ctx.rebase !== undefined && chosen.kind === ctx.rebase.kind
        ? ctx.rebase.unit
        : chosen.unit;
    const avoid = avoidSpellings(target, chosen, this.registry, this.locale);
    const ambiguousSurface = target.length > 1 ? target[0]?.surface : undefined;
    // No magnitude of its own — `spelledUnitWord` reads that as "select the
    // generic plural category", see its own doc comment.
    return ctx.spell !== undefined
      ? spelledUnitWord(
          chosen.kind,
          unitId,
          undefined,
          avoid,
          ambiguousSurface,
          this.registry,
          this.locale,
        )
      : unitWord(
          chosen.kind,
          unitId,
          ctx,
          avoid,
          ambiguousSurface,
          this.registry,
          this.locale,
        );
  }

  /**
   * The number half of a quantity: `value` reprinted literally, unless
   * `ctx.rebase` names `chosen`'s own kind, in which case it is actually
   * converted — through canonical, the same path `formatValue` takes — onto
   * the rebase unit and formatted with `ctx.precision`. This is the one
   * place in `Printer.print`/`node` that computes rather than reprints,
   * which is why `precision` only ever does anything here.
   *
   * `magnitude` (added for Task 11) is the same number as `text`, but as a
   * `Decimal` rather than a formatted string — `renderQuantity` needs the
   * `Decimal` for two things `text` cannot give it back: `ctx.spell`, and the
   * plural category `spelledUnitWord` selects the unit's `display` form by.
   * Both need the *actual* rebased number when `ctx.rebase` applied, not the
   * literal the user typed, which is exactly what `text`/`magnitude` already
   * agree on here.
   */
  private renderMagnitude(
    value: Decimal,
    chosen: Candidate,
    ctx: RenderCtx,
  ): { text: string; kind: KindId; unit: string; magnitude: Decimal } {
    if (ctx.rebase === undefined || chosen.kind !== ctx.rebase.kind) {
      return {
        text: this.printDecimal(value),
        kind: chosen.kind,
        unit: chosen.unit,
        magnitude: value,
      };
    }
    const kind = this.registry.kinds.get(chosen.kind);
    if (kind === undefined) {
      throw new Error(`Printer: unknown kind ${JSON.stringify(chosen.kind)}`);
    }
    const conversionCtx = {
      locale: this.locale.id,
      ...(this.rates !== undefined ? { rates: this.rates } : {}),
    };
    const canonical = toCanonical(value, kind, chosen.unit, conversionCtx);
    const authored = fromCanonical(canonical, kind, ctx.rebase.unit, conversionCtx);
    const text = formatNumber(authored, this.locale, {
      ...(ctx.precision !== undefined ? { precision: ctx.precision } : {}),
      ...(this.rounding !== undefined ? { rounding: this.rounding } : {}),
    });
    return { text, kind: chosen.kind, unit: ctx.rebase.unit, magnitude: authored };
  }
}
