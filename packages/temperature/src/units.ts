import type { UnitTable } from "@smartput/shared";

export type TemperatureUnit = "c" | "f" | "k";
/** A difference between readings is measured on the same scale as a reading. */
export type TempDeltaUnit = TemperatureUnit;

/**
 * The ratios both kinds share. One object, not two copies: "same ratios, no
 * offsets" is the entire definition of the delta kind, and a copy is a place
 * for the two to drift apart.
 *
 * `f` is written out to all 28 significant digits `new Decimal(5).div(9)`
 * produces at the configured precision, not to some shorter approximation.
 * At 28 digits `(212 - 32) * f` rounds to exactly 100; at 20 digits it lands
 * on 100.0000000000000000008 and `212 F in C` stops being 100.
 */
const RATIO: Readonly<Record<TemperatureUnit, string>> = {
  c: "1",
  f: "0.5555555555555555555555555556",
  k: "1",
};

/**
 * Shared for the same reason as the ratios: the delta kind exists so that
 * "20 C + 5 F" can read its right operand as a difference, which only works
 * while both kinds answer to the same words.
 *
 * `°c`/`°f`/`°k` are here because `30°C` is what people type. `°k` is not
 * correct SI notation — kelvin takes no degree sign — but it is what a hand
 * reaching for the same key produces, and rejecting it teaches nothing.
 * The engine's lexer drops `°` as an unrecognized character, so on that path
 * these are dead entries that cost one alias-index slot each and change no
 * resolution; on the micro path they are the difference between `30°C`
 * parsing and not.
 */
const ALIAS: Readonly<Record<string, TemperatureUnit>> = {
  c: "c",
  "°c": "c",
  celsius: "c",
  centigrade: "c",
  f: "f",
  "°f": "f",
  fahrenheit: "f",
  k: "k",
  "°k": "k",
  kelvin: "k",
  kelvins: "k",
};

/**
 * An absolute reading. `canonical = (value + offset) * ratio`, which is the
 * order both `@smartput/shared`'s convert and core's eval/convert use.
 */
export const TEMPERATURE_UNITS: UnitTable<TemperatureUnit> = {
  canonical: "c",
  ratio: RATIO,
  offset: { f: "-32", k: "-273.15" },
  alias: ALIAS,
};

/**
 * A difference between readings. The absence of `offset` is what makes the
 * class factory hand this kind `add`/`sub`/`scale`/`negate` and hand
 * `temperature` `diff` instead — 5F as a reading is -15C, as a difference it
 * is 2.78C.
 */
export const TEMPDELTA_UNITS: UnitTable<TempDeltaUnit> = {
  canonical: "c",
  ratio: RATIO,
  alias: ALIAS,
};
