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
import { TEMPO_UNITS, type TempoUnit } from "./units";

export type { TempoUnit } from "./units";
export { TEMPO_UNITS } from "./units";

type O = ParseOptions<TempoUnit>;
type I = Input<TempoUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseTempo = (input: string, opts?: O) => parse(TEMPO_UNITS, input, opts);
export const isTempo = (input: string, opts?: O) => is(TEMPO_UNITS, input, opts);
export const addTempo = (a: I, b: I, opts?: O) => add(TEMPO_UNITS, a, b, opts);
export const subTempo = (a: I, b: I, opts?: O) => sub(TEMPO_UNITS, a, b, opts);
export const scaleTempo = (a: I, factor: number, opts?: O) =>
  scale(TEMPO_UNITS, a, factor, opts);
export const negateTempo = (a: I, opts?: O) => negate(TEMPO_UNITS, a, opts);
export const toTempo = (a: I, to: TempoUnit, opts?: O) =>
  convert(TEMPO_UNITS, a, to, opts);
export const asTempo = (a: I, to: TempoUnit, opts?: O) => as(TEMPO_UNITS, a, to, opts);
export const equalsTempo = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(TEMPO_UNITS, a, b, epsilon, opts);
export const compareTempo = (a: I, b: I, opts?: O) => compare(TEMPO_UNITS, a, b, opts);
export const formatTempo = (a: Ok<TempoUnit>) => format(TEMPO_UNITS, a);
export const patternForTempo = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(TEMPO_UNITS, opts);
