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
import { AREA_UNITS, type AreaUnit } from "./units";

export type { AreaUnit } from "./units";
export { AREA_UNITS } from "./units";

type O = ParseOptions<AreaUnit>;
type I = Input<AreaUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseArea = (input: string, opts?: O) => parse(AREA_UNITS, input, opts);
export const isArea = (input: string, opts?: O) => is(AREA_UNITS, input, opts);
export const addArea = (a: I, b: I, opts?: O) => add(AREA_UNITS, a, b, opts);
export const subArea = (a: I, b: I, opts?: O) => sub(AREA_UNITS, a, b, opts);
export const scaleArea = (a: I, factor: number, opts?: O) =>
  scale(AREA_UNITS, a, factor, opts);
export const negateArea = (a: I, opts?: O) => negate(AREA_UNITS, a, opts);
export const toArea = (a: I, to: AreaUnit, opts?: O) => convert(AREA_UNITS, a, to, opts);
export const asArea = (a: I, to: AreaUnit, opts?: O) => as(AREA_UNITS, a, to, opts);
export const equalsArea = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(AREA_UNITS, a, b, epsilon, opts);
export const compareArea = (a: I, b: I, opts?: O) => compare(AREA_UNITS, a, b, opts);
export const formatArea = (a: Ok<AreaUnit>) => format(AREA_UNITS, a);
export const patternForArea = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(AREA_UNITS, opts);
