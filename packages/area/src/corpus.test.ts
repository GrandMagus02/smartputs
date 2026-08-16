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
import { length } from "@smartput/length";
import lengthAr from "@smartput/length/locale/ar";
import lengthDe from "@smartput/length/locale/de";
import lengthEn from "@smartput/length/locale/en";
import lengthEs from "@smartput/length/locale/es";
import lengthFr from "@smartput/length/locale/fr";
import lengthHi from "@smartput/length/locale/hi";
import lengthId from "@smartput/length/locale/id";
import lengthIt from "@smartput/length/locale/it";
import lengthJa from "@smartput/length/locale/ja";
import lengthKo from "@smartput/length/locale/ko";
import lengthNl from "@smartput/length/locale/nl";
import lengthPl from "@smartput/length/locale/pl";
import lengthPt from "@smartput/length/locale/pt";
import lengthRu from "@smartput/length/locale/ru";
import lengthTr from "@smartput/length/locale/tr";
import lengthUk from "@smartput/length/locale/uk";
import lengthZh from "@smartput/length/locale/zh";
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
import { area } from "./index";
import areaAr from "./locale/ar";
import areaDe from "./locale/de";
import areaEn from "./locale/en";
import areaEs from "./locale/es";
import areaFr from "./locale/fr";
import areaHi from "./locale/hi";
import areaId from "./locale/id";
import areaIt from "./locale/it";
import areaJa from "./locale/ja";
import areaKo from "./locale/ko";
import areaNl from "./locale/nl";
import areaPl from "./locale/pl";
import areaPt from "./locale/pt";
import areaRu from "./locale/ru";
import areaTr from "./locale/tr";
import areaUk from "./locale/uk";
import areaZh from "./locale/zh";

/**
 * The corpus for `@smartput/area`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `length` because this kind's whole reason to exist is the `length * length`
 * bridge it declares, and a signature whose operands are unregistered is
 * unreachable rather than an error. `number` for the scaling ops, and for the
 * spelled cardinals the corpora read.
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
 * singular for fractions, `corpus/ru.tsv` on the same four categories landing
 * on different numbers, `corpus/ar.tsv` on six categories and a dual,
 * `corpus/fr.tsv` on a `one` that swallows every fraction below two where
 * `corpus/es.tsv` writes a plural for the same amount, `corpus/de.tsv` on five
 * units that decline for case and never for number, `corpus/nl.tsv` on units
 * that decline for nothing at all, `corpus/tr.tsv` on a case suffix stripped
 * off a unit word and a fold that moves a letter's identity, `corpus/zh.tsv`
 * and `corpus/ja.tsv` on a number and a unit with no space between them, and
 * `corpus/en.tsv` on none of the above.
 */

/**
 * One language's four ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which three vocabularies has to stay on the page. Deriving the engine
 * from the id — a map from `"de"` to four dynamic imports — would read shorter
 * and would hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies are variadic because a corpus that grew a fourth kind should
 * add it here and nowhere else.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a vocabulary for, each paired with the
 * `@smartput/core` language it is spoken in, the `@smartput/number` vocabulary
 * its cardinals come from, and the `@smartput/length` vocabulary the
 * `length * length` bridge reads its operands through.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, lengthAr, areaAr],
  ["de", german, numberDe, lengthDe, areaDe],
  ["en", english, numberEn, lengthEn, areaEn],
  ["es", spanish, numberEs, lengthEs, areaEs],
  ["fr", french, numberFr, lengthFr, areaFr],
  ["hi", hindi, numberHi, lengthHi, areaHi],
  ["id", indonesian, numberId, lengthId, areaId],
  ["it", italian, numberIt, lengthIt, areaIt],
  ["ja", japanese, numberJa, lengthJa, areaJa],
  ["ko", korean, numberKo, lengthKo, areaKo],
  ["nl", dutch, numberNl, lengthNl, areaNl],
  ["pl", polish, numberPl, lengthPl, areaPl],
  ["pt", portuguese, numberPt, lengthPt, areaPt],
  ["ru", russian, numberRu, lengthRu, areaRu],
  ["tr", turkish, numberTr, lengthTr, areaTr],
  ["uk", ukrainian, numberUk, lengthUk, areaUk],
  ["zh", chinese, numberZh, lengthZh, areaZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, length, area],
    }),
  })),
);

corpora.evaluate();
