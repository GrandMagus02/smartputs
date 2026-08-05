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
import { SPEED_UNITS, type SpeedUnit } from "./units";

export type { SpeedUnit } from "./units";
export { SPEED_UNITS } from "./units";

type O = ParseOptions<SpeedUnit>;
type I = Input<SpeedUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseSpeed = (input: string, opts?: O) => parse(SPEED_UNITS, input, opts);
export const isSpeed = (input: string, opts?: O) => is(SPEED_UNITS, input, opts);
export const addSpeed = (a: I, b: I, opts?: O) => add(SPEED_UNITS, a, b, opts);
export const subSpeed = (a: I, b: I, opts?: O) => sub(SPEED_UNITS, a, b, opts);
export const scaleSpeed = (a: I, factor: number, opts?: O) =>
  scale(SPEED_UNITS, a, factor, opts);
export const negateSpeed = (a: I, opts?: O) => negate(SPEED_UNITS, a, opts);
export const toSpeed = (a: I, to: SpeedUnit, opts?: O) =>
  convert(SPEED_UNITS, a, to, opts);
export const asSpeed = (a: I, to: SpeedUnit, opts?: O) => as(SPEED_UNITS, a, to, opts);
export const equalsSpeed = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(SPEED_UNITS, a, b, epsilon, opts);
export const compareSpeed = (a: I, b: I, opts?: O) => compare(SPEED_UNITS, a, b, opts);
export const formatSpeed = (a: Ok<SpeedUnit>) => format(SPEED_UNITS, a);
export const patternForSpeed = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(SPEED_UNITS, opts);
