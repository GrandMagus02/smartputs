import angleJa from "@smartput/angle/locale/ja";
import areaJa from "@smartput/area/locale/ja";
import type { Vocabulary } from "@smartput/core";
import datarateJa from "@smartput/datarate/locale/ja";
import datasizeJa from "@smartput/datasize/locale/ja";
import durationJa from "@smartput/duration/locale/ja";
import energyJa from "@smartput/energy/locale/ja";
import lengthJa from "@smartput/length/locale/ja";
import massJa from "@smartput/mass/locale/ja";
import numberJa from "@smartput/number/locale/ja";
import percentJa from "@smartput/percent/locale/ja";
import powerJa from "@smartput/power/locale/ja";
import speedJa from "@smartput/speed/locale/ja";
import temperatureJa from "@smartput/temperature/locale/ja";
import tempoJa from "@smartput/tempo/locale/ja";
import volumeJa from "@smartput/volume/locale/ja";

/**
 * Every built-in `ja` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `japanese`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(japanese, BUILTIN_JA)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/ja` one subpath at a time — the same caveat
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
 * `ja` is the bare tag, and there is no regional register to choose between —
 * where `pt` had to pick a default and `zh` a script, Japanese has one written
 * standard. What the bare tag does inherit from the language half is sharper
 * than a spelling convention: `japanese.selectForm` returns only `"other"`, so
 * every `forms` table under this barrel is a single row, and `japanese.segment`
 * is a `scriptSegmenter` over an unspaced script, so ICU's dictionary — not
 * Japanese — decides which unit words a vocabulary may contain at all. A name
 * ICU breaks in two (ラジアン, キロビット, ワット時) can be printed and never read
 * back, which is rule 5's failure arriving where no shape check looks. The
 * vocabularies answer that by declaring `forms` per family rather than per
 * unit: a family spells itself out only when every member survives the
 * segmenter, so `datasize`, `datarate`, `duration` and `power` carry no `forms`
 * at all and print the Latin symbols a Japanese product page writes, while
 * `area` and `volume` carry `forms` that `en` and `uk` refuse — 平方メートル and
 * 立方メートル are one word here, where "square metre" is two. Reading the
 * per-kind doc comments before adding a word to any of them is not optional.
 */
const BUILTIN_JA: readonly Vocabulary[] = [
  angleJa,
  areaJa,
  datarateJa,
  datasizeJa,
  durationJa,
  energyJa,
  lengthJa,
  massJa,
  numberJa,
  percentJa,
  powerJa,
  speedJa,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureJa,
  tempoJa,
  volumeJa,
];
export default BUILTIN_JA;
