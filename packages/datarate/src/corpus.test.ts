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
import { datasize } from "@smartput/datasize";
import datasizeAr from "@smartput/datasize/locale/ar";
import datasizeDe from "@smartput/datasize/locale/de";
import datasizeEn from "@smartput/datasize/locale/en";
import datasizeEs from "@smartput/datasize/locale/es";
import datasizeFr from "@smartput/datasize/locale/fr";
import datasizeHi from "@smartput/datasize/locale/hi";
import datasizeId from "@smartput/datasize/locale/id";
import datasizeIt from "@smartput/datasize/locale/it";
import datasizeJa from "@smartput/datasize/locale/ja";
import datasizeKo from "@smartput/datasize/locale/ko";
import datasizeNl from "@smartput/datasize/locale/nl";
import datasizePl from "@smartput/datasize/locale/pl";
import datasizePt from "@smartput/datasize/locale/pt";
import datasizeRu from "@smartput/datasize/locale/ru";
import datasizeTr from "@smartput/datasize/locale/tr";
import datasizeUk from "@smartput/datasize/locale/uk";
import datasizeZh from "@smartput/datasize/locale/zh";
import { duration } from "@smartput/duration";
import durationAr from "@smartput/duration/locale/ar";
import durationDe from "@smartput/duration/locale/de";
import durationEn from "@smartput/duration/locale/en";
import durationEs from "@smartput/duration/locale/es";
import durationFr from "@smartput/duration/locale/fr";
import durationHi from "@smartput/duration/locale/hi";
import durationId from "@smartput/duration/locale/id";
import durationIt from "@smartput/duration/locale/it";
import durationJa from "@smartput/duration/locale/ja";
import durationKo from "@smartput/duration/locale/ko";
import durationNl from "@smartput/duration/locale/nl";
import durationPl from "@smartput/duration/locale/pl";
import durationPt from "@smartput/duration/locale/pt";
import durationRu from "@smartput/duration/locale/ru";
import durationTr from "@smartput/duration/locale/tr";
import durationUk from "@smartput/duration/locale/uk";
import durationZh from "@smartput/duration/locale/zh";
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
import { datarate } from "./index";
import datarateAr from "./locale/ar";
import datarateDe from "./locale/de";
import datarateEn from "./locale/en";
import datarateEs from "./locale/es";
import datarateFr from "./locale/fr";
import datarateHi from "./locale/hi";
import datarateId from "./locale/id";
import datarateIt from "./locale/it";
import datarateJa from "./locale/ja";
import datarateKo from "./locale/ko";
import datarateNl from "./locale/nl";
import dataratePl from "./locale/pl";
import dataratePt from "./locale/pt";
import datarateRu from "./locale/ru";
import datarateTr from "./locale/tr";
import datarateUk from "./locale/uk";
import datarateZh from "./locale/zh";

/**
 * The corpus for `@smartput/datarate`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `datasize` and `duration` are registered but not depended on: the four bridge signatures name them by id string, which is exactly the claim these rows check.
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
 * `corpus/pl.tsv` and `corpus/ru.tsv` spend their rows on four plural
 * categories and a genitive singular for fractions, `corpus/ar.tsv` on six
 * categories and a bare prefix that means two different kinds either side of a
 * spelling, `corpus/fr.tsv` on a `one` that swallows zero and every fraction
 * below two, `corpus/tr.tsv` on a language with no number axis at all and a
 * dotless i, `corpus/zh.tsv` and `corpus/ja.tsv` on a gap that is empty on both
 * sides of the unit, and `corpus/en.tsv` on none of the above.
 *
 * Every table also carries the pair this kind exists for: the rate noun and the
 * size noun one letter or one syllable apart — "megabit" and "megabyte",
 * "мегабіт" and "мегабайт", "メガビット" and "メガバイト" — landing in two kinds
 * with the factor of 8 between them that `index.ts` writes out.
 */

/**
 * One language's four ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabularies has to stay on the page. Deriving the engine from
 * the id — a map from `"de"` to four dynamic imports — would read shorter and
 * would hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies are variadic because a corpus that grew a fifth kind should
 * add it here and nowhere else. This kind already needs four: the bridge
 * signatures produce a `datasize` and a `duration`, so the words those two
 * print in are as much a part of a datarate sentence as this package's own.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a vocabulary for, each paired with the
 * `@smartput/core` language it is spoken in and the three neighbouring
 * vocabularies its sentences reach through.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, durationAr, datasizeAr, datarateAr],
  ["de", german, numberDe, durationDe, datasizeDe, datarateDe],
  ["en", english, numberEn, durationEn, datasizeEn, datarateEn],
  ["es", spanish, numberEs, durationEs, datasizeEs, datarateEs],
  ["fr", french, numberFr, durationFr, datasizeFr, datarateFr],
  ["hi", hindi, numberHi, durationHi, datasizeHi, datarateHi],
  ["id", indonesian, numberId, durationId, datasizeId, datarateId],
  ["it", italian, numberIt, durationIt, datasizeIt, datarateIt],
  ["ja", japanese, numberJa, durationJa, datasizeJa, datarateJa],
  ["ko", korean, numberKo, durationKo, datasizeKo, datarateKo],
  ["nl", dutch, numberNl, durationNl, datasizeNl, datarateNl],
  ["pl", polish, numberPl, durationPl, datasizePl, dataratePl],
  ["pt", portuguese, numberPt, durationPt, datasizePt, dataratePt],
  ["ru", russian, numberRu, durationRu, datasizeRu, datarateRu],
  ["tr", turkish, numberTr, durationTr, datasizeTr, datarateTr],
  ["uk", ukrainian, numberUk, durationUk, datasizeUk, datarateUk],
  ["zh", chinese, numberZh, durationZh, datasizeZh, datarateZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, duration, datasize, datarate],
    }),
  })),
);

corpora.evaluate();
