import type { ExpressionParts, QuantityParts } from "../types";

/**
 * What every language gets unless it says otherwise, and an exact reproduction
 * of the template `formatValue` used to inline: a word wins, then a symbol
 * (set tight against the number, as `5kg` always was), then I10's graceful
 * degradation to the unit key.
 *
 * The last branch is unreachable for any language shipping a complete
 * vocabulary — every unit carries a symbol (R8) — and exists for the
 * half-translated case, where rendering `5 kg` awkwardly is the correct
 * outcome and throwing is not.
 *
 * `alias` joins `form` as a word (`Printer`'s ordinary label, and the only
 * caller that passes one), and `gap` overrides the per-branch spacing above
 * whenever the caller has already resolved a separator of its own — which is
 * what makes `Printer`'s `spacing` option reach a language that assembles its
 * own quantities instead of being silently dropped by it. `formatValue` passes
 * neither, so its output is the same byte for byte.
 */
export const defaultRenderQuantity = (p: QuantityParts): string => {
  const word = p.form ?? p.alias;
  if (word !== undefined) return `${p.number}${p.gap ?? " "}${word}`;
  if (p.symbol !== undefined) return `${p.number}${p.gap ?? ""}${p.symbol}`;
  return `${p.number}${p.gap ?? " "}${p.unit}`;
};

/**
 * Symbolic operators with single spaces — which is what `mode: "canonical"`
 * already needs, so the two share one implementation rather than drifting.
 */
export const defaultRenderExpression = (p: ExpressionParts): string =>
  `${p.left} ${p.word ?? p.op} ${p.right}`;
