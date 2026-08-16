import angleUk from "@smartput/angle/locale/uk";
import areaUk from "@smartput/area/locale/uk";
import datarateUk from "@smartput/datarate/locale/uk";
import datasizeUk from "@smartput/datasize/locale/uk";
import durationUk from "@smartput/duration/locale/uk";
import energyUk from "@smartput/energy/locale/uk";
import type { Vocabulary } from "@smartput/kind/types";
import lengthUk from "@smartput/length/locale/uk";
import massUk from "@smartput/mass/locale/uk";
import numberUk from "@smartput/number/locale/uk";
import percentUk from "@smartput/percent/locale/uk";
import powerUk from "@smartput/power/locale/uk";
import speedUk from "@smartput/speed/locale/uk";
import temperatureUk from "@smartput/temperature/locale/uk";
import tempoUk from "@smartput/tempo/locale/uk";
import volumeUk from "@smartput/volume/locale/uk";

/**
 * Every built-in `uk` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `ukrainian`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(ukrainian, BUILTIN_UK)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/uk` one subpath at a time — the same caveat
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
const BUILTIN_UK: readonly Vocabulary[] = [
  angleUk,
  areaUk,
  datarateUk,
  datasizeUk,
  durationUk,
  energyUk,
  lengthUk,
  massUk,
  numberUk,
  percentUk,
  powerUk,
  speedUk,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureUk,
  tempoUk,
  volumeUk,
];
export default BUILTIN_UK;
