import {
  add,
  as,
  coerce,
  compare,
  convert,
  equals,
  format,
  type Input,
  is,
  negate,
  type Ok,
  type Parsed,
  type ParseOptions,
  parse,
  patternFor,
  scale,
  sub,
  toCanonical,
} from "@smartput/shared";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "./units";

export type { TempDeltaUnit, TemperatureUnit } from "./units";
export { TEMPDELTA_UNITS, TEMPERATURE_UNITS } from "./units";

type O = ParseOptions<TemperatureUnit>;
type I = Input<TemperatureUnit>;

// --- temperature: an absolute reading -------------------------------------
//
// No `addTemperature`, `subTemperature`, `scaleTemperature` or
// `negateTemperature`, and their absence is the point: 20C + 20C and 20C * 2
// have no meaning, and a missing export is a compile error where a throwing
// one is a bug report. `diffTemperature` is the one arithmetic this kind has,
// and it lands in the *delta* kind. Adding a delta back to a reading is the
// documented exception and lives on the class, in `class.ts`.

export const parseTemperature = (input: string, opts?: O) =>
  parse(TEMPERATURE_UNITS, input, opts);
export const isTemperature = (input: string, opts?: O) =>
  is(TEMPERATURE_UNITS, input, opts);

/**
 * The difference between two readings, as a `tempdelta` in temperature's
 * canonical unit — the same unit and the same number `Temperature#diff`
 * returns, so the free path and the class never disagree.
 *
 * Canonical rather than the left operand's unit, which is the rule everywhere
 * else here: a difference is a magnitude on the ratio line, and handing it
 * back in Fahrenheit invites a caller to read it through temperature's offsets
 * and re-apply the 32. Same-unit differences are still computed where they
 * already are, so `30c - 20c` is 10 and not 9.999999999999998.
 */
export const diffTemperature = (a: I, b: I, opts?: O): Parsed<TempDeltaUnit> => {
  const left = coerce(TEMPERATURE_UNITS, a, opts);
  if (!left.ok) return left;
  const right = coerce(TEMPERATURE_UNITS, b, opts);
  if (!right.ok) return right;
  const value =
    left.unit === right.unit
      ? toCanonical(TEMPDELTA_UNITS, left.value - right.value, left.unit, opts?.ctx)
      : toCanonical(TEMPERATURE_UNITS, left.value, left.unit, opts?.ctx) -
        toCanonical(TEMPERATURE_UNITS, right.value, right.unit, opts?.ctx);
  return Object.freeze({
    ok: true as const,
    value,
    unit: TEMPDELTA_UNITS.canonical,
    raw: String(value),
  });
};

export const toTemperature = (a: I, to: TemperatureUnit, opts?: O) =>
  convert(TEMPERATURE_UNITS, a, to, opts);
export const asTemperature = (a: I, to: TemperatureUnit, opts?: O) =>
  as(TEMPERATURE_UNITS, a, to, opts);
export const equalsTemperature = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(TEMPERATURE_UNITS, a, b, epsilon, opts);
export const compareTemperature = (a: I, b: I, opts?: O) =>
  compare(TEMPERATURE_UNITS, a, b, opts);
export const formatTemperature = (a: Ok<TemperatureUnit>) => format(TEMPERATURE_UNITS, a);
export const patternForTemperature = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(TEMPERATURE_UNITS, opts);

// --- tempdelta: an ordinary ratio kind, with the whole op set --------------

type DO = ParseOptions<TempDeltaUnit>;
type DI = Input<TempDeltaUnit>;

export const parseTempDelta = (input: string, opts?: DO) =>
  parse(TEMPDELTA_UNITS, input, opts);
export const isTempDelta = (input: string, opts?: DO) => is(TEMPDELTA_UNITS, input, opts);
export const addTempDelta = (a: DI, b: DI, opts?: DO) => add(TEMPDELTA_UNITS, a, b, opts);
export const subTempDelta = (a: DI, b: DI, opts?: DO) => sub(TEMPDELTA_UNITS, a, b, opts);
export const scaleTempDelta = (a: DI, factor: number, opts?: DO) =>
  scale(TEMPDELTA_UNITS, a, factor, opts);
export const negateTempDelta = (a: DI, opts?: DO) => negate(TEMPDELTA_UNITS, a, opts);
export const toTempDelta = (a: DI, to: TempDeltaUnit, opts?: DO) =>
  convert(TEMPDELTA_UNITS, a, to, opts);
export const asTempDelta = (a: DI, to: TempDeltaUnit, opts?: DO) =>
  as(TEMPDELTA_UNITS, a, to, opts);
export const equalsTempDelta = (a: DI, b: DI, epsilon?: number, opts?: DO) =>
  equals(TEMPDELTA_UNITS, a, b, epsilon, opts);
export const compareTempDelta = (a: DI, b: DI, opts?: DO) =>
  compare(TEMPDELTA_UNITS, a, b, opts);
export const formatTempDelta = (a: Ok<TempDeltaUnit>) => format(TEMPDELTA_UNITS, a);
export const patternForTempDelta = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(TEMPDELTA_UNITS, opts);
