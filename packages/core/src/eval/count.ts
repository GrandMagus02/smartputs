import type { Registry } from "../kind/registry";
import type { ConvertNode } from "../parse/ast";
import type { Resolution } from "../solve/solver";
import type { KindId } from "../types";

/**
 * A "how many X in a Y" reading of a conversion: the units, and the words that
 * spelled them.
 *
 * `unit` is what the answer comes back in, which is the *left* operand — the
 * opposite of every other conversion, and the whole reason this type exists.
 */
export interface CountQuery {
  readonly kind: KindId;
  /** The unit being counted, written plural: "minutes" in "minutes in hour". */
  readonly unit: string;
  /** The unit one of which holds them, written singular: "hour". */
  readonly per: string;
  /** The two words as typed, for an error message that can quote them. */
  readonly unitWord: string;
  readonly perWord: string;
}

/**
 * Whether `surface` is a plural spelling of `kind`/`unit`, a singular one, or
 * neither — a symbol, an abbreviation, or a word this language marks no number
 * on. `undefined` for the last case, and for a surface that is somehow both:
 * an unmarked word carries no evidence either way, and reading one as plural
 * is what would turn "5 Löffel in Tasse" into a question nobody asked.
 */
function numberOf(
  registry: Registry,
  surface: string,
  kind: KindId,
  unit: string,
): boolean | undefined {
  const entries = registry.formIndex.get(surface);
  if (entries === undefined) return undefined;
  let plural = false;
  let singular = false;
  for (const e of entries) {
    if (e.kind !== kind || e.unit !== unit) continue;
    if (e.plural) plural = true;
    else singular = true;
  }
  if (plural === singular) return undefined;
  return plural;
}

/**
 * The count reading of a `convert` node, or `undefined` when the node is the
 * ordinary conversion it looks like.
 *
 * English says "how many minutes in an hour" by putting the counted unit
 * first, plural, and the unit holding them second, singular. Strip the words
 * that carry no unit and that is "minutes in hour" — the same three tokens a
 * conversion has, in the same order, meaning the other thing. The parser
 * cannot tell them apart, because the difference is not in the shape: it is in
 * the grammatical number of two words whose spelling the parser folds away.
 *
 * All four conditions below are load-bearing:
 *
 * - **No count was typed.** "1 minute in hours" and "10 minutes in hours" are
 *   conversions of a quantity somebody wrote down. Only the implied 1 — a bare
 *   unit word standing alone — leaves room for a different reading.
 * - **The left word is plural.** "hour in minutes" is a conversion and stays
 *   one, which is why the mirrored spelling keeps working.
 * - **The right word is singular.** "minutes in hours" names no single
 *   container, so there is nothing to count inside; it stays a conversion.
 * - **One kind.** "3pm in tokyo" crosses kinds and is a zone conversion; a
 *   count is always of a unit inside another unit of the same dimension.
 *
 * A claimed target (`targetValues`) is excluded for the same reason as the
 * last: it is a value, not a unit label, so there is no "one of it" to count
 * inside.
 */
export function countQueryOf(
  node: ConvertNode,
  resolution: Resolution,
  registry: Registry,
  text: string,
  locale: string,
): CountQuery | undefined {
  const operandNode = node.operand;
  if (operandNode.type !== "quantity" || operandNode.implied !== true) return undefined;

  const operand = resolution.choices[operandNode.id];
  const target = resolution.choices[node.id];
  if (operand === undefined || target === undefined) return undefined;
  if (operand.kind !== target.kind) return undefined;
  if (operand.unit === target.unit) return undefined;
  if (node.targetValues?.has(target) === true) return undefined;

  const unitWord = text.slice(operandNode.span.start, operandNode.span.end);
  const perWord = text.slice(node.targetSpan.start, node.targetSpan.end);
  const left = numberOf(
    registry,
    unitWord.toLocaleLowerCase(locale),
    operand.kind,
    operand.unit,
  );
  const right = numberOf(
    registry,
    perWord.toLocaleLowerCase(locale),
    target.kind,
    target.unit,
  );
  if (left !== true || right !== false) return undefined;

  return {
    kind: operand.kind,
    unit: operand.unit,
    per: target.unit,
    unitWord,
    perWord,
  };
}
