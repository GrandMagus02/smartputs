import angleDe from "@smartput/angle/locale/de";
import areaDe from "@smartput/area/locale/de";
import datarateDe from "@smartput/datarate/locale/de";
import datasizeDe from "@smartput/datasize/locale/de";
import durationDe from "@smartput/duration/locale/de";
import energyDe from "@smartput/energy/locale/de";
import type { Vocabulary } from "@smartput/kind/types";
import lengthDe from "@smartput/length/locale/de";
import massDe from "@smartput/mass/locale/de";
import numberDe from "@smartput/number/locale/de";
import percentDe from "@smartput/percent/locale/de";
import powerDe from "@smartput/power/locale/de";
import speedDe from "@smartput/speed/locale/de";
import temperatureDe from "@smartput/temperature/locale/de";
import tempoDe from "@smartput/tempo/locale/de";
import volumeDe from "@smartput/volume/locale/de";

/**
 * Every built-in `de` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `german`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(german, BUILTIN_DE)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/de` one subpath at a time — the same caveat
 * the `./validate` and `./class` barrels next door carry.
 *
 * The array is ordered by kind id, and order is not load-bearing:
 * `composeLocale` refuses two vocabularies for one kind outright, so there is
 * no last-one-wins for the ordering to decide.
 *
 * It is `BUILTIN_EN`'s twin down to the import list, and deliberately so: the
 * barrel is the one file where a language that had been translated for fourteen
 * kinds and forgotten for the fifteenth would show up as a missing line, so the
 * two barrels being diffable against each other is the check.
 */
const BUILTIN_DE: readonly Vocabulary[] = [
  angleDe,
  areaDe,
  datarateDe,
  datasizeDe,
  durationDe,
  energyDe,
  lengthDe,
  massDe,
  numberDe,
  percentDe,
  powerDe,
  speedDe,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureDe,
  tempoDe,
  volumeDe,
];
export default BUILTIN_DE;
