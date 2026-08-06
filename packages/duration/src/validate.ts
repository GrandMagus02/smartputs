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
import { DURATION_UNITS, type DurationUnit } from "./units";

export type { DurationUnit } from "./units";
export { DURATION_UNITS } from "./units";

type O = ParseOptions<DurationUnit>;
type I = Input<DurationUnit>;

export const parseDuration = (input: string, opts?: O) =>
  parse(DURATION_UNITS, input, opts);
export const isDuration = (input: string, opts?: O) => is(DURATION_UNITS, input, opts);
export const addDuration = (a: I, b: I, opts?: O) => add(DURATION_UNITS, a, b, opts);
export const subDuration = (a: I, b: I, opts?: O) => sub(DURATION_UNITS, a, b, opts);
export const scaleDuration = (a: I, factor: number, opts?: O) =>
  scale(DURATION_UNITS, a, factor, opts);
export const negateDuration = (a: I, opts?: O) => negate(DURATION_UNITS, a, opts);
export const toDuration = (a: I, to: DurationUnit, opts?: O) =>
  convert(DURATION_UNITS, a, to, opts);
export const asDuration = (a: I, to: DurationUnit, opts?: O) =>
  as(DURATION_UNITS, a, to, opts);
export const equalsDuration = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(DURATION_UNITS, a, b, epsilon, opts);
export const compareDuration = (a: I, b: I, opts?: O) =>
  compare(DURATION_UNITS, a, b, opts);
export const formatDuration = (a: Ok<DurationUnit>) => format(DURATION_UNITS, a);
export const patternForDuration = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(DURATION_UNITS, opts);
