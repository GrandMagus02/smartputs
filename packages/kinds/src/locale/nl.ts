import angleNl from "@smartput/angle/locale/nl";
import areaNl from "@smartput/area/locale/nl";
import datarateNl from "@smartput/datarate/locale/nl";
import datasizeNl from "@smartput/datasize/locale/nl";
import durationNl from "@smartput/duration/locale/nl";
import energyNl from "@smartput/energy/locale/nl";
import type { Vocabulary } from "@smartput/kind/types";
import lengthNl from "@smartput/length/locale/nl";
import massNl from "@smartput/mass/locale/nl";
import numberNl from "@smartput/number/locale/nl";
import percentNl from "@smartput/percent/locale/nl";
import powerNl from "@smartput/power/locale/nl";
import speedNl from "@smartput/speed/locale/nl";
import temperatureNl from "@smartput/temperature/locale/nl";
import tempoNl from "@smartput/tempo/locale/nl";
import volumeNl from "@smartput/volume/locale/nl";

/**
 * Every built-in `nl` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `dutch`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(dutch, BUILTIN_NL)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/nl` one subpath at a time — the same caveat
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
const BUILTIN_NL: readonly Vocabulary[] = [
  angleNl,
  areaNl,
  datarateNl,
  datasizeNl,
  durationNl,
  energyNl,
  lengthNl,
  massNl,
  numberNl,
  percentNl,
  powerNl,
  speedNl,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureNl,
  tempoNl,
  volumeNl,
];
export default BUILTIN_NL;
