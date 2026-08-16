import anglePt from "@smartput/angle/locale/pt";
import areaPt from "@smartput/area/locale/pt";
import dataratePt from "@smartput/datarate/locale/pt";
import datasizePt from "@smartput/datasize/locale/pt";
import durationPt from "@smartput/duration/locale/pt";
import energyPt from "@smartput/energy/locale/pt";
import type { Vocabulary } from "@smartput/kind/types";
import lengthPt from "@smartput/length/locale/pt";
import massPt from "@smartput/mass/locale/pt";
import numberPt from "@smartput/number/locale/pt";
import percentPt from "@smartput/percent/locale/pt";
import powerPt from "@smartput/power/locale/pt";
import speedPt from "@smartput/speed/locale/pt";
import temperaturePt from "@smartput/temperature/locale/pt";
import tempoPt from "@smartput/tempo/locale/pt";
import volumePt from "@smartput/volume/locale/pt";

/**
 * Every built-in `pt` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `portuguese`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(portuguese, BUILTIN_PT)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/pt` one subpath at a time — the same caveat
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
 * `pt` is the bare tag, and it is Brazilian — the same ruling `portuguese`
 * itself is written to, and the same thing the platform does, since `Intl`
 * resolves the bare tag to the Brazilian defaults. So these vocabularies
 * **print** the Brazilian word and **read** the European one beside it:
 * "quilômetro" prints while "quilómetro" parses, "paica" prints while "pica"
 * parses, "octeto" parses and never prints. A consumer who wants European
 * Portuguese to come back out of `format` composes its own vocabularies rather
 * than editing these; the reading half already costs it nothing.
 */
const BUILTIN_PT: readonly Vocabulary[] = [
  anglePt,
  areaPt,
  dataratePt,
  datasizePt,
  durationPt,
  energyPt,
  lengthPt,
  massPt,
  numberPt,
  percentPt,
  powerPt,
  speedPt,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperaturePt,
  tempoPt,
  volumePt,
];
export default BUILTIN_PT;
