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
import { NUMBER_UNITS, type NumberUnit } from "./units";

export type { NumberUnit } from "./units";
export { NUMBER_UNITS } from "./units";

type O = ParseOptions<NumberUnit>;
type I = Input<NumberUnit>;

// number has exactly one unit and no aliases beyond its own name, so a bare
// "30" is the form every caller actually types. defaultUnit is hardcoded
// here rather than left to the caller: it is set *after* spreading the
// caller's own opts, so nothing a caller passes can erase it, while `mode`,
// `unit`, `ctx` and `resolve` all still pass through untouched. When the
// caller passes nothing at all — the common case for the smallest kind in
// the library — the frozen module-level constant is reused instead of
// allocating a new object per call.
//
// This does not make `missing-unit` unreachable: `parse`'s strict mode has
// no bare-number fallback regardless of `defaultUnit` (see
// packages/shared/src/parse.ts's `word.length === 0` branch), so
// `parseNumber("30", { mode: "strict" })` is still `missing-unit`. Only
// loose mode — the default — gets the free pass, which is the case that
// actually matters: a caller has to opt into strict mode by name.
const DEFAULT_OPTS: O = { defaultUnit: "one" };
const withDefault = (opts?: O): O =>
  opts === undefined ? DEFAULT_OPTS : { ...opts, defaultUnit: "one" };

export const parseNumber = (input: string, opts?: O) =>
  parse(NUMBER_UNITS, input, withDefault(opts));
export const isNumber = (input: string, opts?: O) =>
  is(NUMBER_UNITS, input, withDefault(opts));
export const addNumber = (a: I, b: I, opts?: O) =>
  add(NUMBER_UNITS, a, b, withDefault(opts));
export const subNumber = (a: I, b: I, opts?: O) =>
  sub(NUMBER_UNITS, a, b, withDefault(opts));
export const scaleNumber = (a: I, factor: number, opts?: O) =>
  scale(NUMBER_UNITS, a, factor, withDefault(opts));
export const negateNumber = (a: I, opts?: O) =>
  negate(NUMBER_UNITS, a, withDefault(opts));
export const toNumber = (a: I, to: NumberUnit, opts?: O) =>
  convert(NUMBER_UNITS, a, to, withDefault(opts));
export const asNumber = (a: I, to: NumberUnit, opts?: O) =>
  as(NUMBER_UNITS, a, to, withDefault(opts));
export const equalsNumber = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(NUMBER_UNITS, a, b, epsilon, withDefault(opts));
export const compareNumber = (a: I, b: I, opts?: O) =>
  compare(NUMBER_UNITS, a, b, withDefault(opts));
export const formatNumber = (a: Ok<NumberUnit>) => format(NUMBER_UNITS, a);
export const patternForNumber = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(NUMBER_UNITS, opts);
