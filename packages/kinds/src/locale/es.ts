import angleEs from "@smartput/angle/locale/es";
import areaEs from "@smartput/area/locale/es";
import type { Vocabulary } from "@smartput/core";
import datarateEs from "@smartput/datarate/locale/es";
import datasizeEs from "@smartput/datasize/locale/es";
import durationEs from "@smartput/duration/locale/es";
import energyEs from "@smartput/energy/locale/es";
import lengthEs from "@smartput/length/locale/es";
import massEs from "@smartput/mass/locale/es";
import numberEs from "@smartput/number/locale/es";
import percentEs from "@smartput/percent/locale/es";
import powerEs from "@smartput/power/locale/es";
import speedEs from "@smartput/speed/locale/es";
import temperatureEs from "@smartput/temperature/locale/es";
import tempoEs from "@smartput/tempo/locale/es";
import volumeEs from "@smartput/volume/locale/es";

/**
 * Every built-in `es` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `spanish`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(spanish, BUILTIN_ES)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/es` one subpath at a time — the same caveat
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
 * `es` is the bare tag, with no region, and every vocabulary in here was
 * written to that: the words are the RAE's for the whole language (`julio` for
 * the joule, `hercio` for the hertz), not any one country's. A region that
 * wants its own register composes its own vocabularies rather than editing
 * these.
 */
const BUILTIN_ES: readonly Vocabulary[] = [
  angleEs,
  areaEs,
  datarateEs,
  datasizeEs,
  durationEs,
  energyEs,
  lengthEs,
  massEs,
  numberEs,
  percentEs,
  powerEs,
  speedEs,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureEs,
  tempoEs,
  volumeEs,
];
export default BUILTIN_ES;
