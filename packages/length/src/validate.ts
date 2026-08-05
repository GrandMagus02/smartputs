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
import { LENGTH_UNITS, type LengthUnit } from "./units";

export type { LengthUnit } from "./units";
export { LENGTH_UNITS } from "./units";

type O = ParseOptions<LengthUnit>;
type I = Input<LengthUnit>;

export const parseLength = (input: string, opts?: O) => parse(LENGTH_UNITS, input, opts);
export const isLength = (input: string, opts?: O) => is(LENGTH_UNITS, input, opts);
export const addLength = (a: I, b: I, opts?: O) => add(LENGTH_UNITS, a, b, opts);
export const subLength = (a: I, b: I, opts?: O) => sub(LENGTH_UNITS, a, b, opts);
export const scaleLength = (a: I, factor: number, opts?: O) =>
  scale(LENGTH_UNITS, a, factor, opts);
export const negateLength = (a: I, opts?: O) => negate(LENGTH_UNITS, a, opts);
export const toLength = (a: I, to: LengthUnit, opts?: O) =>
  convert(LENGTH_UNITS, a, to, opts);
export const asLength = (a: I, to: LengthUnit, opts?: O) => as(LENGTH_UNITS, a, to, opts);
export const equalsLength = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(LENGTH_UNITS, a, b, epsilon, opts);
export const compareLength = (a: I, b: I, opts?: O) => compare(LENGTH_UNITS, a, b, opts);
export const formatLength = (a: Ok<LengthUnit>) => format(LENGTH_UNITS, a);
export const patternForLength = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(LENGTH_UNITS, opts);
