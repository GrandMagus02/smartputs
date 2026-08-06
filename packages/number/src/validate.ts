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

/**
 * A third point on the axis `mode` already measures, looser than `loose`.
 *
 * `strict` treats anything around the value as input that continued past it,
 * `loose` forgives case and surrounding space but still insists the word after
 * the number names a unit it knows. `native` stops insisting: it reads the
 * leading number the way `parseFloat` does and lets the rest of the string be
 * whatever it is.
 *
 * It lives here rather than in `@smartput/shared`'s `parse` for two reasons.
 * The narrow one is bytes: every kind's `validate` entry sits within about
 * 50 B of its ceiling in `scripts/check-size.ts` and `percent/validate` is
 * exactly at it, so a branch in the shared parser is a tax on eighteen
 * packages for one package's question. The broad one is that it is only
 * coherent here. `parseLength("30 kg")` reading 30 metres is a wrong answer
 * wearing a lenient mode's clothes; `number` is the one kind whose unit
 * carries no information, so discarding the word after the value discards
 * nothing.
 */
export type NumberParseOptions = Omit<O, "mode"> & {
  mode?: "strict" | "loose" | "native";
};

/**
 * `parse`'s NUMBER regex, and deliberately the same one: sign, digits, decimal
 * point, exponent, and nothing else. No thousands separator and no locale
 * decimal comma, so `"1,234"` reads as 1 exactly as `parseFloat` does — those
 * need `Intl` and the locale's numberFormat, which is the engine's job.
 */
const NATIVE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;

/**
 * Native mode is expressed as a rewrite rather than a branch inside `parse`:
 * take the leading numeric run and hand *that* to loose mode, which already
 * knows how to land a bare number on `defaultUnit`. One code path stays
 * responsible for building every `Ok` this module returns.
 *
 * When there is no numeric run the original input is delegated untouched, so
 * `""` is still `empty` and `"kg"` is still `nan`. Widening what counts as a
 * number must not blur what counts as a failure to find one.
 */
const forNative = (input: string, opts?: NumberParseOptions): [string, O | undefined] => {
  if (opts?.mode !== "native") return [input, opts as O | undefined];
  // `mode` is dropped rather than passed on: `parse` knows two modes, and the
  // rewrite above has already turned this call into the loose one.
  const { mode: _native, ...rest } = opts;
  return [NATIVE.exec(input.trim())?.[0] ?? input, rest as O];
};

export const parseNumber = (input: string, opts?: NumberParseOptions) => {
  const [text, o] = forNative(input, opts);
  return parse(NUMBER_UNITS, text, withDefault(o));
};
export const isNumber = (input: string, opts?: NumberParseOptions) => {
  const [text, o] = forNative(input, opts);
  return is(NUMBER_UNITS, text, withDefault(o));
};
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
