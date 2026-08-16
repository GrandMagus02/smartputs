import angleZh from "@smartput/angle/locale/zh";
import areaZh from "@smartput/area/locale/zh";
import datarateZh from "@smartput/datarate/locale/zh";
import datasizeZh from "@smartput/datasize/locale/zh";
import durationZh from "@smartput/duration/locale/zh";
import energyZh from "@smartput/energy/locale/zh";
import type { Vocabulary } from "@smartput/kind/types";
import lengthZh from "@smartput/length/locale/zh";
import massZh from "@smartput/mass/locale/zh";
import numberZh from "@smartput/number/locale/zh";
import percentZh from "@smartput/percent/locale/zh";
import powerZh from "@smartput/power/locale/zh";
import speedZh from "@smartput/speed/locale/zh";
import temperatureZh from "@smartput/temperature/locale/zh";
import tempoZh from "@smartput/tempo/locale/zh";
import volumeZh from "@smartput/volume/locale/zh";

/**
 * Every built-in `zh` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `chinese`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(chinese, BUILTIN_ZH)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/zh` one subpath at a time — the same caveat
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
 * `zh` is the bare tag, and the bare tag means **Simplified** — that is CLDR's
 * own default for it, so there is no `zh-Hans.ts` here and no Traditional
 * spelling anywhere below. Where `pt` had a regional default to pick, Chinese
 * has a script and a register: the mainland GB-standard names are the ones that
 * *print* (千克, 厘米, 米, 升, 平方米, 立方米) while the colloquial and Taiwanese
 * ones (公斤, 公分, 公尺, 公升, 平米, 立米) are read and never written back. The
 * kilometre is the single exception and prints 公里, because 千米 loses to it in
 * real use *and* because ICU cuts 平方千米 while leaving 平方公里 whole — so length
 * and area describe one dimension in one register rather than two.
 *
 * That last clause is the thing to internalise before touching any file under
 * this barrel. `chinese.segment` is a `scriptSegmenter` over an unspaced script,
 * so ICU's dictionary — not Chinese — decides which unit words a vocabulary may
 * contain at all: a name ICU breaks in two can be printed and never read back,
 * which is rule 5's failure arriving where no shape check looks, because
 * `assertLocaleContract` reads the alias index and the analyzer chain and never
 * the segmenter. Every word below was swept through the segmenter before it was
 * written down, and the casualties are wide: 字节 cuts into 字 + 节, so `datasize`
 * prints Latin symbols throughout and 像素 — *the* Chinese word for a pixel —
 * is unreachable; 比特 cuts, so `datarate` carries no Chinese alias on any unit;
 * 千焦 cuts against 千, `zh-cardinals.ts`'s scale word for a thousand, so 「5千焦」
 * would lex as 5 then the NUMBER 1000 then a stray 焦. The vocabularies answer
 * that the way `ja` does, by declaring `forms` per family rather than per unit:
 * a family spells itself out only when every member survives, so a kind never
 * prints two registers for one quantity. `chinese.selectForm` returns only
 * `"other"`, so every `forms` table under this barrel is a single row.
 *
 * Two absences look like omissions and are not. `percent` ships no Chinese word
 * whatsoever — 百分之 goes in *front* of the number (百分之二十), which fits no seam
 * this engine has, and 成 and 折 are tenth-based units the kind does not declare.
 * `speed` and `datarate` decline names their kinds could plausibly have carried
 * because the flat, kind-blind alias index would give 「5公里」 or 「100兆」 two
 * readings. Reading the per-kind doc comments before adding a word to any of
 * them is not optional.
 */
const BUILTIN_ZH: readonly Vocabulary[] = [
  angleZh,
  areaZh,
  datarateZh,
  datasizeZh,
  durationZh,
  energyZh,
  lengthZh,
  massZh,
  numberZh,
  percentZh,
  powerZh,
  speedZh,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureZh,
  tempoZh,
  volumeZh,
];
export default BUILTIN_ZH;
