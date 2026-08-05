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
import { PERCENT_UNITS, type PercentUnit } from "./units";

export type { PercentUnit } from "./units";
export { PERCENT_UNITS } from "./units";

type O = ParseOptions<PercentUnit>;
type I = Input<PercentUnit>;

export const parsePercent = (input: string, opts?: O) =>
  parse(PERCENT_UNITS, input, opts);
export const isPercent = (input: string, opts?: O) => is(PERCENT_UNITS, input, opts);
export const addPercent = (a: I, b: I, opts?: O) => add(PERCENT_UNITS, a, b, opts);
export const subPercent = (a: I, b: I, opts?: O) => sub(PERCENT_UNITS, a, b, opts);
export const scalePercent = (a: I, factor: number, opts?: O) =>
  scale(PERCENT_UNITS, a, factor, opts);
export const negatePercent = (a: I, opts?: O) => negate(PERCENT_UNITS, a, opts);
export const toPercent = (a: I, to: PercentUnit, opts?: O) =>
  convert(PERCENT_UNITS, a, to, opts);
export const asPercent = (a: I, to: PercentUnit, opts?: O) =>
  as(PERCENT_UNITS, a, to, opts);
export const equalsPercent = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(PERCENT_UNITS, a, b, epsilon, opts);
export const comparePercent = (a: I, b: I, opts?: O) =>
  compare(PERCENT_UNITS, a, b, opts);
export const formatPercent = (a: Ok<PercentUnit>) => format(PERCENT_UNITS, a);
export const patternForPercent = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(PERCENT_UNITS, opts);
