import angleIt from "@smartput/angle/locale/it";
import areaIt from "@smartput/area/locale/it";
import type { Vocabulary } from "@smartput/core";
import datarateIt from "@smartput/datarate/locale/it";
import datasizeIt from "@smartput/datasize/locale/it";
import durationIt from "@smartput/duration/locale/it";
import energyIt from "@smartput/energy/locale/it";
import lengthIt from "@smartput/length/locale/it";
import massIt from "@smartput/mass/locale/it";
import numberIt from "@smartput/number/locale/it";
import percentIt from "@smartput/percent/locale/it";
import powerIt from "@smartput/power/locale/it";
import speedIt from "@smartput/speed/locale/it";
import temperatureIt from "@smartput/temperature/locale/it";
import tempoIt from "@smartput/tempo/locale/it";
import volumeIt from "@smartput/volume/locale/it";

/**
 * Every built-in `it` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `italian`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(italian, BUILTIN_IT)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/it` one subpath at a time — the same caveat
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
 * `it` is the bare tag, and the vocabularies behind it were written to standard
 * Italian rather than to any regional register: the international abbreviation
 * where Italian abbreviates at all, and the Crusca's ruling where usage is
 * split (`euro` invariant, never `euri`). Note also what the bare tag inherits
 * from the language half: Italian is a consonant-final borrower, so a great
 * many of these units — bit, byte, watt, hertz, gon, pixel — carry the same
 * string in both `forms` rows, which is a declared invariant and not a
 * half-finished table.
 */
const BUILTIN_IT: readonly Vocabulary[] = [
  angleIt,
  areaIt,
  datarateIt,
  datasizeIt,
  durationIt,
  energyIt,
  lengthIt,
  massIt,
  numberIt,
  percentIt,
  powerIt,
  speedIt,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureIt,
  tempoIt,
  volumeIt,
];
export default BUILTIN_IT;
