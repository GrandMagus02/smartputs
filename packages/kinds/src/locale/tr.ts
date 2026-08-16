import angleTr from "@smartput/angle/locale/tr";
import areaTr from "@smartput/area/locale/tr";
import datarateTr from "@smartput/datarate/locale/tr";
import datasizeTr from "@smartput/datasize/locale/tr";
import durationTr from "@smartput/duration/locale/tr";
import energyTr from "@smartput/energy/locale/tr";
import type { Vocabulary } from "@smartput/kind/types";
import lengthTr from "@smartput/length/locale/tr";
import massTr from "@smartput/mass/locale/tr";
import numberTr from "@smartput/number/locale/tr";
import percentTr from "@smartput/percent/locale/tr";
import powerTr from "@smartput/power/locale/tr";
import speedTr from "@smartput/speed/locale/tr";
import temperatureTr from "@smartput/temperature/locale/tr";
import tempoTr from "@smartput/tempo/locale/tr";
import volumeTr from "@smartput/volume/locale/tr";

/**
 * Every built-in `tr` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `turkish`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(turkish, BUILTIN_TR)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/tr` one subpath at a time — the same caveat
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
const BUILTIN_TR: readonly Vocabulary[] = [
  angleTr,
  areaTr,
  datarateTr,
  datasizeTr,
  durationTr,
  energyTr,
  lengthTr,
  massTr,
  numberTr,
  percentTr,
  powerTr,
  speedTr,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureTr,
  tempoTr,
  volumeTr,
];
export default BUILTIN_TR;
