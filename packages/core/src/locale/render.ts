import type { ExpressionParts, QuantityParts } from "../types";

/**
 * What every language gets unless it says otherwise, and an exact reproduction
 * of the template `formatValue` used to inline: a word wins, then a symbol
 * (set tight against the number, as `5kg` always was), then I10's graceful
 * degradation to the unit key.
 *
 * The third branch is unreachable for any language shipping a complete
 * vocabulary — every unit carries a symbol (R8) — and exists for the
 * half-translated case, where rendering `5 kg` awkwardly is the correct
 * outcome and throwing is not.
 */
export const defaultRenderQuantity = (p: QuantityParts): string =>
  p.form !== undefined
    ? `${p.number} ${p.form}`
    : p.symbol !== undefined
      ? `${p.number}${p.symbol}`
      : `${p.number} ${p.unit}`;

/**
 * Symbolic operators with single spaces — which is what `mode: "canonical"`
 * already needs, so the two share one implementation rather than drifting.
 */
export const defaultRenderExpression = (p: ExpressionParts): string =>
  `${p.left} ${p.word ?? p.op} ${p.right}`;
