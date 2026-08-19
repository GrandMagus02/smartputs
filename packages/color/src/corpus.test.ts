import {
  composeLocale,
  createEngine,
  type Language,
  type Vocabulary,
} from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { german } from "@smartput/core/locale/de";
import { english } from "@smartput/core/locale/en";
import { spanish } from "@smartput/core/locale/es";
import { french } from "@smartput/core/locale/fr";
import { hindi } from "@smartput/core/locale/hi";
import { indonesian } from "@smartput/core/locale/id";
import { italian } from "@smartput/core/locale/it";
import { japanese } from "@smartput/core/locale/ja";
import { korean } from "@smartput/core/locale/ko";
import { dutch } from "@smartput/core/locale/nl";
import { polish } from "@smartput/core/locale/pl";
import { portuguese } from "@smartput/core/locale/pt";
import { russian } from "@smartput/core/locale/ru";
import { turkish } from "@smartput/core/locale/tr";
import { ukrainian } from "@smartput/core/locale/uk";
import { chinese } from "@smartput/core/locale/zh";
import { Corpora } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberAr from "@smartput/number/locale/ar";
import numberDe from "@smartput/number/locale/de";
import numberEn from "@smartput/number/locale/en";
import numberEs from "@smartput/number/locale/es";
import numberFr from "@smartput/number/locale/fr";
import numberHi from "@smartput/number/locale/hi";
import numberId from "@smartput/number/locale/id";
import numberIt from "@smartput/number/locale/it";
import numberJa from "@smartput/number/locale/ja";
import numberKo from "@smartput/number/locale/ko";
import numberNl from "@smartput/number/locale/nl";
import numberPl from "@smartput/number/locale/pl";
import numberPt from "@smartput/number/locale/pt";
import numberRu from "@smartput/number/locale/ru";
import numberTr from "@smartput/number/locale/tr";
import numberUk from "@smartput/number/locale/uk";
import numberZh from "@smartput/number/locale/zh";
import { defineColorKinds } from "./color";
import { channelWordsFor } from "./i18n";
import colorAr from "./locale/ar";
import colorDe from "./locale/de";
import colorEn from "./locale/en";
import colorEs from "./locale/es";
import colorFr from "./locale/fr";
import colorHi from "./locale/hi";
import colorId from "./locale/id";
import colorIt from "./locale/it";
import colorJa from "./locale/ja";
import colorKo from "./locale/ko";
import colorNl from "./locale/nl";
import colorPl from "./locale/pl";
import colorPt from "./locale/pt";
import colorRu from "./locale/ru";
import colorTr from "./locale/tr";
import colorUk from "./locale/uk";
import colorZh from "./locale/zh";

/**
 * The corpus for `@smartput/color`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `number` is registered for the scaling op — "#808080 * 2" has no signature
 * without it — and for the cardinals the shared harness reads.
 *
 * Four columns, as everywhere: input, kind, canonical, formatted. The
 * `canonical` column earns its place here more than in most packages. It is
 * the packed `0xRRGGBBAA` pixel (see `packSrgb`), and it is the column that
 * caught the one real bug this package shipped a draft of: `packSrgb` was
 * gamut-mapping while `serialize` was clamping, so "#eeff66 lighten 0.2"
 * recorded `4294967295` — white — beside a formatted `#fcff75`. A three-column
 * corpus would have called that green.
 *
 * **What differs between the tables, and what does not.** The CSS notation
 * names are the same seventeen times over, because `oklch(…)` is typed the same
 * in Warsaw and in Seoul — see `locale/shared.ts`. What each table asserts of
 * its own language is the conversion keyword (`в`, `إلى`, `を`, `çevir`), the
 * channel words that come from `@urcolor/i18n` (`насиченість`, `درجة اللون`,
 * `明るさ`), and the cues. Five languages — `hi`, `ja`, `ko`, `tr`, `zh` — have
 * no `of` keyword in their `@smartput/core` language table, so they carry no
 * channel-read rows: there is no word for the operator to be spelled as, and
 * inventing one here would assert this file rather than the language.
 *
 * The verb phrases ("darken 20%", "with 150 hue") are English-only and appear
 * in `corpus/en.tsv` alone. They are claimed by a literal matcher over English
 * words, and a translation of them is a real piece of work rather than a table
 * — stated here so the gap is a decision on the page and not an oversight.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, colorAr],
  ["de", german, numberDe, colorDe],
  ["en", english, numberEn, colorEn],
  ["es", spanish, numberEs, colorEs],
  ["fr", french, numberFr, colorFr],
  ["hi", hindi, numberHi, colorHi],
  ["id", indonesian, numberId, colorId],
  ["it", italian, numberIt, colorIt],
  ["ja", japanese, numberJa, colorJa],
  ["ko", korean, numberKo, colorKo],
  ["nl", dutch, numberNl, colorNl],
  ["pl", polish, numberPl, colorPl],
  ["pt", portuguese, numberPt, colorPt],
  ["ru", russian, numberRu, colorRu],
  ["tr", turkish, numberTr, colorTr],
  ["uk", ukrainian, numberUk, colorUk],
  ["zh", chinese, numberZh, colorZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      // The channel words are per language and come from `@urcolor/i18n`, so
      // the kinds are built per engine rather than shared. That is the seam
      // under test as much as the rows are: an engine speaking Ukrainian has
      // to read `насиченість` and one speaking German `Sättigung`, and a
      // single shared pair of kinds would prove neither.
      kinds: [number, ...defineColorKinds({ channelWords: channelWordsFor([id]) })],
    }),
  })),
);

corpora.evaluate();
