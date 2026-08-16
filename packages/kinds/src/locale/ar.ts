import angleAr from "@smartput/angle/locale/ar";
import areaAr from "@smartput/area/locale/ar";
import datarateAr from "@smartput/datarate/locale/ar";
import datasizeAr from "@smartput/datasize/locale/ar";
import durationAr from "@smartput/duration/locale/ar";
import energyAr from "@smartput/energy/locale/ar";
import type { Vocabulary } from "@smartput/kind/types";
import lengthAr from "@smartput/length/locale/ar";
import massAr from "@smartput/mass/locale/ar";
import numberAr from "@smartput/number/locale/ar";
import percentAr from "@smartput/percent/locale/ar";
import powerAr from "@smartput/power/locale/ar";
import speedAr from "@smartput/speed/locale/ar";
import temperatureAr from "@smartput/temperature/locale/ar";
import tempoAr from "@smartput/tempo/locale/ar";
import volumeAr from "@smartput/volume/locale/ar";

/**
 * Every built-in `ar` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `arabic`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(arabic, BUILTIN_AR)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/ar` one subpath at a time — the same caveat
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
 *
 * Nothing here is right-to-left: the file holds module identifiers only. The
 * Arabic that these modules carry is stored and printed in logical order, and
 * the vocabularies say so one by one — this barrel neither reverses nor wraps
 * anything, and adding a bidi control here would only feed invisible characters
 * to a lexer that has no rule for them.
 */
const BUILTIN_AR: readonly Vocabulary[] = [
  angleAr,
  areaAr,
  datarateAr,
  datasizeAr,
  durationAr,
  energyAr,
  lengthAr,
  massAr,
  numberAr,
  percentAr,
  powerAr,
  speedAr,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureAr,
  tempoAr,
  volumeAr,
];
export default BUILTIN_AR;
