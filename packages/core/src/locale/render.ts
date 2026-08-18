import type { ExpressionParts, QuantityParts } from "../types";

/**
 * What every language gets unless it says otherwise: a word wins, then a
 * symbol, then I10's graceful degradation to the unit key. All three branches
 * default to one space.
 *
 * The symbol branch used to default to no space at all, which made "100kph"
 * and "120bpm" the normal output and "1.5 kilograms" the exception — a unit
 * that had not been given `forms` yet was rendered as if its author had asked
 * for tight spacing. Ruling R-C1 turns that around: spacing is the default and
 * `UnitWords.tight` is how a word asks for the other one, which `formatValue`
 * resolves into `gap: ""` before it gets here.
 *
 * `gap` still overrides all three, and a caller that resolves no separator of
 * its own (a language assembling its own quantity, `Printer` under
 * `spacing: "tight"`) still decides for itself — which is why ja/zh/ko, whose
 * scripts set nothing off from a number, are untouched by this.
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
  if (p.symbol !== undefined) return `${p.number}${p.gap ?? " "}${p.symbol}`;
  return `${p.number}${p.gap ?? " "}${p.unit}`;
};

/**
 * Symbolic operators with single spaces — which is what `mode: "canonical"`
 * already needs, so the two share one implementation rather than drifting.
 */
export const defaultRenderExpression = (p: ExpressionParts): string =>
  `${p.left} ${p.word ?? p.op} ${p.right}`;
