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
import { measure } from "./index";
import measureAr from "./locale/ar";
import measureDe from "./locale/de";
import measureEn from "./locale/en";
import measureEs from "./locale/es";
import measureFr from "./locale/fr";
import measureHi from "./locale/hi";
import measureId from "./locale/id";
import measureIt from "./locale/it";
import measureJa from "./locale/ja";
import measureKo from "./locale/ko";
import measureNl from "./locale/nl";
import measurePl from "./locale/pl";
import measurePt from "./locale/pt";
import measureRu from "./locale/ru";
import measureTr from "./locale/tr";
import measureUk from "./locale/uk";
import measureZh from "./locale/zh";

/**
 * The corpus for `@smartput/measure`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * This kind is deliberately absent from `BUILTIN_KINDS` — its mm/cm aliases
 * collide with `length` — so an engine built by hand is the only way to reach
 * it, and the only way to test it. That is also why no corpus here can be
 * replayed through `@smartput/kinds`: this package is the only owner of these
 * rows in any of the seventeen languages.
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
 * `corpus/uk.tsv` spends its rows on three declension paradigms across six
 * units, `corpus/ar.tsv` on six plural categories and a dual, `corpus/pl.tsv`
 * on a feminine `pika` whose `few` and `other` collapse into one word,
 * `corpus/fr.tsv` on a `one` that swallows every fraction below two where
 * `corpus/es.tsv` pluralises the same numbers, `corpus/de.tsv` on a dative
 * that is read and never printed, `corpus/tr.tsv` on a case suffix stripped
 * off the unit and a dotless i, `corpus/zh.tsv` on two units that print
 * through a Latin symbol because ICU cuts their Chinese words in half,
 * `corpus/hi.tsv` on a grouping gap recorded rather than worked around, and
 * `corpus/en.tsv` on none of the above.
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
  ["ar", arabic, numberAr, measureAr],
  ["de", german, numberDe, measureDe],
  ["en", english, numberEn, measureEn],
  ["es", spanish, numberEs, measureEs],
  ["fr", french, numberFr, measureFr],
  ["hi", hindi, numberHi, measureHi],
  ["id", indonesian, numberId, measureId],
  ["it", italian, numberIt, measureIt],
  ["ja", japanese, numberJa, measureJa],
  ["ko", korean, numberKo, measureKo],
  ["nl", dutch, numberNl, measureNl],
  ["pl", polish, numberPl, measurePl],
  ["pt", portuguese, numberPt, measurePt],
  ["ru", russian, numberRu, measureRu],
  ["tr", turkish, numberTr, measureTr],
  ["uk", ukrainian, numberUk, measureUk],
  ["zh", chinese, numberZh, measureZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, measure],
    }),
  })),
);

corpora.evaluate();
