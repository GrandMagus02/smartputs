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
import { tempo } from "./index";
import tempoAr from "./locale/ar";
import tempoDe from "./locale/de";
import tempoEn from "./locale/en";
import tempoEs from "./locale/es";
import tempoFr from "./locale/fr";
import tempoHi from "./locale/hi";
import tempoId from "./locale/id";
import tempoIt from "./locale/it";
import tempoJa from "./locale/ja";
import tempoKo from "./locale/ko";
import tempoNl from "./locale/nl";
import tempoPl from "./locale/pl";
import tempoPt from "./locale/pt";
import tempoRu from "./locale/ru";
import tempoTr from "./locale/tr";
import tempoUk from "./locale/uk";
import tempoZh from "./locale/zh";

/**
 * The corpus for `@smartput/tempo`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `duration` for the reciprocal bridge, which is an `in` signature rather than a ratio row: 120 bpm is a half-second beat, and no unit table can say that.
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
 * `corpus/pl.tsv` and `corpus/uk.tsv` spend their rows on four plural
 * categories and a genitive singular for fractions, `corpus/ar.tsv` on six
 * categories, `corpus/fr.tsv` on a `one` that swallows every fraction below
 * two, `corpus/tr.tsv` on a conversion that is a verb between the operands
 * rather than a preposition before the target, `corpus/zh.tsv` on a number and
 * a unit with nothing between them, and `corpus/en.tsv` on none of the above.
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
 * its cardinals come from, and the `@smartput/duration` vocabulary the
 * reciprocal bridge lands in.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, durationAr, tempoAr],
  ["de", german, numberDe, durationDe, tempoDe],
  ["en", english, numberEn, durationEn, tempoEn],
  ["es", spanish, numberEs, durationEs, tempoEs],
  ["fr", french, numberFr, durationFr, tempoFr],
  ["hi", hindi, numberHi, durationHi, tempoHi],
  ["id", indonesian, numberId, durationId, tempoId],
  ["it", italian, numberIt, durationIt, tempoIt],
  ["ja", japanese, numberJa, durationJa, tempoJa],
  ["ko", korean, numberKo, durationKo, tempoKo],
  ["nl", dutch, numberNl, durationNl, tempoNl],
  ["pl", polish, numberPl, durationPl, tempoPl],
  ["pt", portuguese, numberPt, durationPt, tempoPt],
  ["ru", russian, numberRu, durationRu, tempoRu],
  ["tr", turkish, numberTr, durationTr, tempoTr],
  ["uk", ukrainian, numberUk, durationUk, tempoUk],
  ["zh", chinese, numberZh, durationZh, tempoZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, duration, tempo],
    }),
  })),
);

corpora.evaluate();
