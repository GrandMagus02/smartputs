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
} from "@smartput/validate";
import { ANGLE_UNITS, type AngleUnit } from "./units";

export type { AngleUnit } from "./units";
export { ANGLE_UNITS } from "./units";

type O = ParseOptions<AngleUnit>;
type I = Input<AngleUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseAngle = (input: string, opts?: O) => parse(ANGLE_UNITS, input, opts);
export const isAngle = (input: string, opts?: O) => is(ANGLE_UNITS, input, opts);
export const addAngle = (a: I, b: I, opts?: O) => add(ANGLE_UNITS, a, b, opts);
export const subAngle = (a: I, b: I, opts?: O) => sub(ANGLE_UNITS, a, b, opts);
export const scaleAngle = (a: I, factor: number, opts?: O) =>
  scale(ANGLE_UNITS, a, factor, opts);
export const negateAngle = (a: I, opts?: O) => negate(ANGLE_UNITS, a, opts);
export const toAngle = (a: I, to: AngleUnit, opts?: O) =>
  convert(ANGLE_UNITS, a, to, opts);
export const asAngle = (a: I, to: AngleUnit, opts?: O) => as(ANGLE_UNITS, a, to, opts);
export const equalsAngle = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(ANGLE_UNITS, a, b, epsilon, opts);
export const compareAngle = (a: I, b: I, opts?: O) => compare(ANGLE_UNITS, a, b, opts);
export const formatAngle = (a: Ok<AngleUnit>) => format(ANGLE_UNITS, a);
export const patternForAngle = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(ANGLE_UNITS, opts);
