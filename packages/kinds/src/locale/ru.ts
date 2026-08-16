import angleRu from "@smartput/angle/locale/ru";
import areaRu from "@smartput/area/locale/ru";
import datarateRu from "@smartput/datarate/locale/ru";
import datasizeRu from "@smartput/datasize/locale/ru";
import durationRu from "@smartput/duration/locale/ru";
import energyRu from "@smartput/energy/locale/ru";
import type { Vocabulary } from "@smartput/kind/types";
import lengthRu from "@smartput/length/locale/ru";
import massRu from "@smartput/mass/locale/ru";
import numberRu from "@smartput/number/locale/ru";
import percentRu from "@smartput/percent/locale/ru";
import powerRu from "@smartput/power/locale/ru";
import speedRu from "@smartput/speed/locale/ru";
import temperatureRu from "@smartput/temperature/locale/ru";
import tempoRu from "@smartput/tempo/locale/ru";
import volumeRu from "@smartput/volume/locale/ru";

/**
 * Every built-in `ru` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `russian`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(russian, BUILTIN_RU)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/ru` one subpath at a time — the same caveat
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
const BUILTIN_RU: readonly Vocabulary[] = [
  angleRu,
  areaRu,
  datarateRu,
  datasizeRu,
  durationRu,
  energyRu,
  lengthRu,
  massRu,
  numberRu,
  percentRu,
  powerRu,
  speedRu,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureRu,
  tempoRu,
  volumeRu,
];
export default BUILTIN_RU;
