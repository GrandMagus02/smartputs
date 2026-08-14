import angleFr from "@smartput/angle/locale/fr";
import areaFr from "@smartput/area/locale/fr";
import type { Vocabulary } from "@smartput/core";
import datarateFr from "@smartput/datarate/locale/fr";
import datasizeFr from "@smartput/datasize/locale/fr";
import durationFr from "@smartput/duration/locale/fr";
import energyFr from "@smartput/energy/locale/fr";
import lengthFr from "@smartput/length/locale/fr";
import massFr from "@smartput/mass/locale/fr";
import numberFr from "@smartput/number/locale/fr";
import percentFr from "@smartput/percent/locale/fr";
import powerFr from "@smartput/power/locale/fr";
import speedFr from "@smartput/speed/locale/fr";
import temperatureFr from "@smartput/temperature/locale/fr";
import tempoFr from "@smartput/tempo/locale/fr";
import volumeFr from "@smartput/volume/locale/fr";

/**
 * Every built-in `fr` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `french`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(french, BUILTIN_FR)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/fr` one subpath at a time — the same caveat
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
 * `fr` is the bare tag, with no region, and every vocabulary in here was
 * written to that: the words are metropolitan French, the register `Intl`
 * resolves the bare tag to — `octet` and never "byte" for the datasize unit,
 * `soixante-dix`/`quatre-vingt-dix` in `french`'s own cardinals rather than the
 * Belgian and Swiss `septante`/`nonante`. A region that wants its own register
 * composes its own vocabularies rather than editing these.
 */
const BUILTIN_FR: readonly Vocabulary[] = [
  angleFr,
  areaFr,
  datarateFr,
  datasizeFr,
  durationFr,
  energyFr,
  lengthFr,
  massFr,
  numberFr,
  percentFr,
  powerFr,
  speedFr,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureFr,
  tempoFr,
  volumeFr,
];
export default BUILTIN_FR;
