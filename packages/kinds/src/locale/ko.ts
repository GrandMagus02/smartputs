import angleKo from "@smartput/angle/locale/ko";
import areaKo from "@smartput/area/locale/ko";
import type { Vocabulary } from "@smartput/core";
import datarateKo from "@smartput/datarate/locale/ko";
import datasizeKo from "@smartput/datasize/locale/ko";
import durationKo from "@smartput/duration/locale/ko";
import energyKo from "@smartput/energy/locale/ko";
import lengthKo from "@smartput/length/locale/ko";
import massKo from "@smartput/mass/locale/ko";
import numberKo from "@smartput/number/locale/ko";
import percentKo from "@smartput/percent/locale/ko";
import powerKo from "@smartput/power/locale/ko";
import speedKo from "@smartput/speed/locale/ko";
import temperatureKo from "@smartput/temperature/locale/ko";
import tempoKo from "@smartput/tempo/locale/ko";
import volumeKo from "@smartput/volume/locale/ko";

/**
 * Every built-in `ko` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `korean`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(korean, BUILTIN_KO)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/ko` one subpath at a time — the same caveat
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
 * `ko` is the bare tag with nothing regional to decide — one written standard,
 * one script, so no `pt`-style default and no `zh`-style script pick. It shares
 * exactly one property with its CJK neighbours: `korean.selectForm` returns only
 * `"other"`, so every `forms` table under this barrel is a single row. Beyond
 * that the resemblance to `ja` is a trap, and the vocabularies say so one by one.
 * **Korean is spaced, and `korean.segment` is `undefined`** — `lex` has already
 * cut at every space, and the `defaultSegment` fallback it still runs
 * (`Intl.Segmenter("ko")`) carries no Korean dictionary, so it breaks only at
 * script boundaries. No dictionary can veto a row. That is why the words `ja`
 * had to abandon are printed here: 라디안 where `angle/locale/ja` gave up on
 * ラジアン, the whole 비트 family where `ja` could claim two of five, 킬로와트시 as
 * one token, 밀리초, 기가와트, 테라바이트. `area` and `volume` spell all of
 * 제곱미터/세제곱미터 out for the same reason `ja` could.
 *
 * What Korean loses instead is a numeral collision `ja` never has. `foldNumerals`
 * rewrites an all-numeral word token into a number before the alias index is
 * consulted, and Sino-Korean numerals are ordinary Hangul syllables, so **any
 * unit word spelled entirely from 영공일이삼사오육륙칠팔구십백천만억조 is
 * unclaimable** — it would pass `assertLocaleContract`, which knows nothing of
 * the numeral pass, and be unreachable from any input. `duration` prints 일간 for
 * the day rather than 일 on exactly that ground. Two further refusals are
 * homographs, not mechanics: `energy` prints J/kJ/MJ because 줄 is one of the
 * commonest nouns in the language, and `temperature` leaves 도 to
 * `@smartput/angle` while 섭씨/화씨 stay out of `forms` because they are
 * prefixes — a table prints after the number and would emit 20섭씨.
 *
 * The seam to know before writing a test against this barrel: a target particle
 * is recovered (`particleStripper` peels 로/으로), a *source* particle is not.
 * 「5킬로그램을 그램으로」 is one token too few for the parser, so every conversion
 * here is written mixed-script — 「0.5kg를 그램」, 「2gb를 메가바이트로」 — which works
 * because ICU splits at the script boundary. Reading the per-kind doc comments
 * before adding a word to any of them is not optional.
 */
const BUILTIN_KO: readonly Vocabulary[] = [
  angleKo,
  areaKo,
  datarateKo,
  datasizeKo,
  durationKo,
  energyKo,
  lengthKo,
  massKo,
  numberKo,
  percentKo,
  powerKo,
  speedKo,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureKo,
  tempoKo,
  volumeKo,
];
export default BUILTIN_KO;
