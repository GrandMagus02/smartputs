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
import { POWER_UNITS, type PowerUnit } from "./units";

export type { PowerUnit } from "./units";
export { POWER_UNITS } from "./units";

type O = ParseOptions<PowerUnit>;
type I = Input<PowerUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parsePower = (input: string, opts?: O) => parse(POWER_UNITS, input, opts);
export const isPower = (input: string, opts?: O) => is(POWER_UNITS, input, opts);
export const addPower = (a: I, b: I, opts?: O) => add(POWER_UNITS, a, b, opts);
export const subPower = (a: I, b: I, opts?: O) => sub(POWER_UNITS, a, b, opts);
export const scalePower = (a: I, factor: number, opts?: O) =>
  scale(POWER_UNITS, a, factor, opts);
export const negatePower = (a: I, opts?: O) => negate(POWER_UNITS, a, opts);
export const toPower = (a: I, to: PowerUnit, opts?: O) =>
  convert(POWER_UNITS, a, to, opts);
export const asPower = (a: I, to: PowerUnit, opts?: O) => as(POWER_UNITS, a, to, opts);
export const equalsPower = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(POWER_UNITS, a, b, epsilon, opts);
export const comparePower = (a: I, b: I, opts?: O) => compare(POWER_UNITS, a, b, opts);
export const formatPower = (a: Ok<PowerUnit>) => format(POWER_UNITS, a);
export const patternForPower = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(POWER_UNITS, opts);
