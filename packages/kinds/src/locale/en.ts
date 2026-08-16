import angleEn from "@smartput/angle/locale/en";
import areaEn from "@smartput/area/locale/en";
import datarateEn from "@smartput/datarate/locale/en";
import datasizeEn from "@smartput/datasize/locale/en";
import durationEn from "@smartput/duration/locale/en";
import energyEn from "@smartput/energy/locale/en";
import type { Vocabulary } from "@smartput/kind/types";
import lengthEn from "@smartput/length/locale/en";
import massEn from "@smartput/mass/locale/en";
import numberEn from "@smartput/number/locale/en";
import percentEn from "@smartput/percent/locale/en";
import powerEn from "@smartput/power/locale/en";
import speedEn from "@smartput/speed/locale/en";
import temperatureEn from "@smartput/temperature/locale/en";
import tempoEn from "@smartput/tempo/locale/en";
import volumeEn from "@smartput/volume/locale/en";

/**
 * Every built-in `en` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `english`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(english, BUILTIN_EN)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/en` one subpath at a time — the same caveat
 * the `./validate` and `./class` barrels next door carry.
 *
 * The array is ordered by kind id, and order is not load-bearing:
 * `composeLocale` refuses two vocabularies for one kind outright, so there is
 * no last-one-wins for the ordering to decide.
 */
const BUILTIN_EN: readonly Vocabulary[] = [
  angleEn,
  areaEn,
  datarateEn,
  datasizeEn,
  durationEn,
  energyEn,
  lengthEn,
  massEn,
  numberEn,
  percentEn,
  powerEn,
  speedEn,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureEn,
  tempoEn,
  volumeEn,
];
export default BUILTIN_EN;
