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
import { volume } from "./index";
import volumeAr from "./locale/ar";
import volumeDe from "./locale/de";
import volumeEn from "./locale/en";
import volumeEs from "./locale/es";
import volumeFr from "./locale/fr";
import volumeHi from "./locale/hi";
import volumeId from "./locale/id";
import volumeIt from "./locale/it";
import volumeJa from "./locale/ja";
import volumeKo from "./locale/ko";
import volumeNl from "./locale/nl";
import volumePl from "./locale/pl";
import volumePt from "./locale/pt";
import volumeRu from "./locale/ru";
import volumeTr from "./locale/tr";
import volumeUk from "./locale/uk";
import volumeZh from "./locale/zh";

/**
 * The corpus for `@smartput/volume`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `number` for the scaling ops, and for the spelled cardinals the corpora read.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state, and drops the ones its language has no use for. Sharing one table
 * across engines would assert the table; this asserts the language. So
 * `corpus/pl.tsv` spends its rows on four plural categories and a genitive
 * singular for fractions, `corpus/ar.tsv` on six categories and a dual,
 * `corpus/fr.tsv` on a `one` that swallows every fraction below two,
 * `corpus/nl.tsv` on five units that decline for nothing at all,
 * `corpus/tr.tsv` on a case suffix where the others put a preposition,
 * `corpus/zh.tsv` on a unit written with no space before it, and
 * `corpus/en.tsv` on none of the above.
 *
 * The cubic metre is where the seventeen disagree most plainly. Most of them
 * say it as a phrase — "cubic metres", "кубічних метрів" — and `lex` ends a
 * word token at a space, so those engines have no printable word and answer
 * with the symbol `m³`. German, Turkish, Japanese, Korean and Chinese write it
 * as one token and print it in words; Dutch and Hindi write one token, list it
 * as an alias, and still print the symbol. Each corpus records its own half of
 * that split.
 */

/**
 * One language's three ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which two vocabularies has to stay on the page. Deriving the engine
 * from the id — a map from `"de"` to three dynamic imports — would read shorter
 * and would hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies are variadic because a corpus that grew a third kind should
 * add it here and nowhere else.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a vocabulary for, each paired with the
 * `@smartput/core` language it is spoken in and the `@smartput/number`
 * vocabulary its cardinals come from.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, volumeAr],
  ["de", german, numberDe, volumeDe],
  ["en", english, numberEn, volumeEn],
  ["es", spanish, numberEs, volumeEs],
  ["fr", french, numberFr, volumeFr],
  ["hi", hindi, numberHi, volumeHi],
  ["id", indonesian, numberId, volumeId],
  ["it", italian, numberIt, volumeIt],
  ["ja", japanese, numberJa, volumeJa],
  ["ko", korean, numberKo, volumeKo],
  ["nl", dutch, numberNl, volumeNl],
  ["pl", polish, numberPl, volumePl],
  ["pt", portuguese, numberPt, volumePt],
  ["ru", russian, numberRu, volumeRu],
  ["tr", turkish, numberTr, volumeTr],
  ["uk", ukrainian, numberUk, volumeUk],
  ["zh", chinese, numberZh, volumeZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, volume],
    }),
  })),
);

corpora.evaluate();
