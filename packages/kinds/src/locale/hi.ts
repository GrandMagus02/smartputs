import angleHi from "@smartput/angle/locale/hi";
import areaHi from "@smartput/area/locale/hi";
import type { Vocabulary } from "@smartput/core";
import datarateHi from "@smartput/datarate/locale/hi";
import datasizeHi from "@smartput/datasize/locale/hi";
import durationHi from "@smartput/duration/locale/hi";
import energyHi from "@smartput/energy/locale/hi";
import lengthHi from "@smartput/length/locale/hi";
import massHi from "@smartput/mass/locale/hi";
import numberHi from "@smartput/number/locale/hi";
import percentHi from "@smartput/percent/locale/hi";
import powerHi from "@smartput/power/locale/hi";
import speedHi from "@smartput/speed/locale/hi";
import temperatureHi from "@smartput/temperature/locale/hi";
import tempoHi from "@smartput/tempo/locale/hi";
import volumeHi from "@smartput/volume/locale/hi";

/**
 * Every built-in `hi` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `hindi`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(hindi, BUILTIN_HI)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/hi` one subpath at a time — the same caveat
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
 * Nothing here is Devanagari: the file holds module identifiers only. Two facts
 * about the composed locale are worth knowing before you wire it, and neither is
 * a vocabulary's to fix, so they are recorded where the wiring happens. The
 * digits an engine built from this prints are ASCII, because `numberFormat` has
 * no digit-set field — `१२३` is not read back as a number. And the grouping is
 * core's fixed period of three, so this engine writes `10,00,000` as
 * `1,000,000` where `Intl.NumberFormat("hi")` would use the lakh/crore
 * positions; the *reader* is grouping-agnostic and takes either, so a
 * round trip through Indian-grouped input already holds today. Every kind's
 * `locale/hi.test.ts` pins both sides of that, which is what turns a future
 * widening of `NumberFormatSpec` into a failing assertion rather than a silent
 * change of output.
 */
const BUILTIN_HI: readonly Vocabulary[] = [
  angleHi,
  areaHi,
  datarateHi,
  datasizeHi,
  durationHi,
  energyHi,
  lengthHi,
  massHi,
  numberHi,
  percentHi,
  powerHi,
  speedHi,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureHi,
  tempoHi,
  volumeHi,
];
export default BUILTIN_HI;
