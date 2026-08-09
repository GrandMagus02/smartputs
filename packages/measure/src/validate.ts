import {
  add,
  as,
  compare,
  convert,
  equals,
  format,
  type Input,
  is,
  negate,
  type Ok,
  type ParseOptions,
  parse,
  patternFor,
  scale,
  sub,
} from "@smartput/shared";
import { MEASURE_UNITS, type MeasureUnit } from "./units";

export type { MeasureUnit } from "./units";
export { DEFAULT_DPI, MEASURE_UNITS } from "./units";

type O = ParseOptions<MeasureUnit>;
type I = Input<MeasureUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
//
// Every wrapper forwards `opts` untouched, which is how `px` gets its dpi:
// `toMeasure("10px", "mm", { ctx: { dpi: 144 } })`.
export const parseMeasure = (input: string, opts?: O) =>
  parse(MEASURE_UNITS, input, opts);
export const isMeasure = (input: string, opts?: O) => is(MEASURE_UNITS, input, opts);
export const addMeasure = (a: I, b: I, opts?: O) => add(MEASURE_UNITS, a, b, opts);
export const subMeasure = (a: I, b: I, opts?: O) => sub(MEASURE_UNITS, a, b, opts);
export const scaleMeasure = (a: I, factor: number, opts?: O) =>
  scale(MEASURE_UNITS, a, factor, opts);
export const negateMeasure = (a: I, opts?: O) => negate(MEASURE_UNITS, a, opts);
export const toMeasure = (a: I, to: MeasureUnit, opts?: O) =>
  convert(MEASURE_UNITS, a, to, opts);
export const asMeasure = (a: I, to: MeasureUnit, opts?: O) =>
  as(MEASURE_UNITS, a, to, opts);
export const equalsMeasure = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(MEASURE_UNITS, a, b, epsilon, opts);
export const compareMeasure = (a: I, b: I, opts?: O) =>
  compare(MEASURE_UNITS, a, b, opts);
export const formatMeasure = (a: Ok<MeasureUnit>) => format(MEASURE_UNITS, a);
export const patternForMeasure = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(MEASURE_UNITS, opts);
