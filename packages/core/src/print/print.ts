import type { Decimal } from "../decimal";
import { formatValue } from "../format/format";
import type { Registry } from "../kind/registry";
import type { Node, NodeId } from "../parse/ast";
import { type BinaryOp, bindingOf, CONVERT_BINDING } from "../parse/pratt";
import type { Program } from "../parse/program";
import type { Resolution } from "../solve/solver";
import type { Candidate, FormatOptions, Locale, RateLookup, Value } from "../types";

// `format/format.ts` stays the one place `formatValue` is defined; this is a
// re-export, not a second copy, so a caller who wants the bare function
// without standing up a `Printer` still has one place to import it from.
export { DISPLAY_PRECISION, formatNumber, formatValue } from "../format/format";
export type { FormatOptions } from "../types";

export type PrintMode = "canonical" | "verbatim" | "resolved";

export interface PrintOptions {
  /** Defaults to "canonical". `"verbatim"` and `"resolved"` are Task 10. */
  mode?: PrintMode;
  /** Required for `"resolved"`. Unused by `"canonical"`. */
  resolution?: Resolution;
  /** Rebase every quantity of the result kind onto this unit. Task 10. */
  unit?: string;
  /** "thirty degrees plus fifteen degrees". Task 11. */
  spelled?: boolean;
  /** "30° + 15°" vs "30 deg + 15 deg". Task 10. */
  symbols?: boolean;
  /**
   * Significant digits for a quantity `canonical` recomputes — which, before
   * `unit` (Task 10) can rebase a quantity onto a different unit, is never:
   * `canonical` reprints the literal the user typed via `printDecimal`, not
   * a number the printer itself derived, so there is nothing yet for a
   * precision to round. Task 10.
   */
  precision?: number;
  /** "30deg+15deg" vs "30 deg + 15 deg". Task 10. */
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
 * Renders a `Program` (`print`) and a `Value` (`value`) — two jobs in one
 * class because both need the same registry and locale, and a caller doing
 * both today (`createEngine`'s `toResult`) would otherwise thread the two
 * separately for no reason.
 *
 * Only `canonical` mode is implemented (spec's Task 9); `verbatim`, `resolved`
 * and `node()` are Task 10, `spelled` is Task 11. Each throws rather than
 * silently falling back to `canonical` — a silent fallback is how a
 * half-built printer ships looking finished.
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
    if (mode !== "canonical") {
      throw new Error(
        `Printer.print: mode ${JSON.stringify(mode)} is not implemented yet (Task 10)`,
      );
    }
    if (opts.unit !== undefined) {
      throw new Error("Printer.print: { unit } is not implemented yet (Task 10)");
    }
    if (opts.symbols === true) {
      throw new Error(
        "Printer.print: { symbols: true } is not implemented yet (Task 10)",
      );
    }
    if (opts.precision !== undefined) {
      throw new Error("Printer.print: { precision } is not implemented yet (Task 10)");
    }
    if (opts.spacing !== undefined) {
      throw new Error("Printer.print: { spacing } is not implemented yet (Task 10)");
    }
    if (opts.spelled === true) {
      throw new Error(
        "Printer.print: { spelled: true } is not implemented yet (Task 11)",
      );
    }
    return this.printNode(program.root);
  }

  /**
   * Prints the subtree rooted at `id`, for a caller that wants one node's
   * text rather than the whole program (a UI highlighting a single operand,
   * for instance). Not implemented — Task 10 names this alongside `resolved`
   * because the two share the same "where does a node's text start and end"
   * bookkeeping.
   */
  node(_program: Program, _id: NodeId, _opts?: PrintOptions): string {
    throw new Error("Printer.node: not implemented yet (Task 10)");
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
  private printChild(node: Node, minBinding: number): string {
    const text = this.printNode(node);
    return precedenceOf(node) < minBinding ? `(${text})` : text;
  }

  private printNode(node: Node): string {
    switch (node.type) {
      case "number":
        return this.printDecimal(node.value);

      case "quantity":
        return `${this.printDecimal(node.value)} ${this.unitText(node.candidates)}`;

      // Not reachable by any BUILTIN_KINDS input — no built-in kind registers
      // a literal matcher (see `parity.ts`'s doc comment) — but a plugin kind
      // can claim a span, and a literal node's canonical text is simply
      // whatever was typed: a claim is recognized textually, not through the
      // alias table `unitText` reads, so there is no "normalized spelling" to
      // canonicalize it to.
      case "literal":
        return node.candidates[0]?.surface ?? "";

      case "unary":
        // No space: matches the convention every unary input in the corpus
        // already uses ("-5 km"), and reparsing is indifferent either way —
        // the lexer treats "-" as its own token regardless of adjacency.
        return `-${this.printChild(node.operand, UNARY_OPERAND_BINDING)}`;

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
        const operand = this.printChild(node.operand, CONVERT_BINDING);
        const inWord = this.locale.keywords.in?.[0] ?? "in";
        return `${operand} ${inWord} ${this.unitText(node.target)}`;
      }

      case "binary": {
        const binding = bindingOf(node.op);
        const left = this.printChild(node.left, binding);
        // Right recurses at `binding + 1`: the parser's own right-hand
        // `parseExpr(binding + 1)` is what makes this grammar left-associative,
        // so a right child at the *same* binding (only reachable through
        // explicit source parens, since without them the parser would have
        // folded it into `left` instead) must keep its parens on reprint.
        const right = this.printChild(node.right, binding + 1);
        return `${left} ${this.opWord(node.op)} ${right}`;
      }
    }
  }

  /** The literal digits the user typed, exactly — never rounded or grouped:
   * this is the parsed literal itself, not a computed value, so there is
   * nothing for `formatValue`'s precision or grouping rules to apply to. */
  private printDecimal(value: Decimal): string {
    return value.toFixed();
  }

  private opWord(op: BinaryOp): string {
    switch (op) {
      case "of":
        return this.locale.keywords.of?.[0] ?? "of";
      case "off":
        return this.locale.keywords.off?.[0] ?? "off";
      default:
        return op;
    }
  }

  /**
   * The text for a quantity's unit or a convert's target, from the
   * `Candidate` list a `QuantityNode`/`ConvertNode` already carries.
   *
   * Every candidate on one node comes from resolving the *same* surface text
   * (`parse/candidates.ts`'s `resolve` is called once per node, with one
   * `surface`), so `candidates.length > 1` means exactly one thing: this
   * word has more than one registered meaning and nothing on the node alone
   * says which the solver would pick — canonicalizing it to any one
   * candidate's alias would silently narrow an ambiguous reading to an
   * unambiguous one, changing what the printed text *means*, not just how it
   * looks. Echoing the original surface instead reproduces the identical
   * ambiguity on reparse, so the solver sees the same candidate set and the
   * same surrounding tree it saw the first time and returns the same
   * `Resolution` — which is exactly what the round-trip contract requires
   * and is the reason `canonical` needs no `Resolution` of its own.
   *
   * A single candidate has nothing to disambiguate, so it canonicalizes
   * freely: the unit's first registered alias, which `aliasesFor` (every
   * kind package's units table) always lists in a form the parser accepts —
   * unlike `UnitLexeme.symbol` ("m/s", "m²"), which exists for `formatValue`
   * and is not guaranteed to lex back into the token it decorates.
   */
  private unitText(candidates: readonly Candidate[]): string {
    const first = candidates[0];
    if (first === undefined) return "";
    if (candidates.length > 1) return first.surface;
    const alias = this.registry.kinds.get(first.kind)?.units.get(first.unit)?.lexeme
      .aliases[0];
    return alias ?? first.unit;
  }
}
