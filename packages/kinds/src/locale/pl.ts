import anglePl from "@smartput/angle/locale/pl";
import areaPl from "@smartput/area/locale/pl";
import type { Vocabulary } from "@smartput/core";
import dataratePl from "@smartput/datarate/locale/pl";
import datasizePl from "@smartput/datasize/locale/pl";
import durationPl from "@smartput/duration/locale/pl";
import energyPl from "@smartput/energy/locale/pl";
import lengthPl from "@smartput/length/locale/pl";
import massPl from "@smartput/mass/locale/pl";
import numberPl from "@smartput/number/locale/pl";
import percentPl from "@smartput/percent/locale/pl";
import powerPl from "@smartput/power/locale/pl";
import speedPl from "@smartput/speed/locale/pl";
import temperaturePl from "@smartput/temperature/locale/pl";
import tempoPl from "@smartput/tempo/locale/pl";
import volumePl from "@smartput/volume/locale/pl";

/**
 * Every built-in `pl` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `polish`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(polish, BUILTIN_PL)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/pl` one subpath at a time — the same caveat
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
const BUILTIN_PL: readonly Vocabulary[] = [
  anglePl,
  areaPl,
  dataratePl,
  datasizePl,
  durationPl,
  energyPl,
  lengthPl,
  massPl,
  numberPl,
  percentPl,
  powerPl,
  speedPl,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperaturePl,
  tempoPl,
  volumePl,
];
export default BUILTIN_PL;
