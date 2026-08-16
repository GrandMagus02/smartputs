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
import { percent } from "./index";
import percentAr from "./locale/ar";
import percentDe from "./locale/de";
import percentEn from "./locale/en";
import percentEs from "./locale/es";
import percentFr from "./locale/fr";
import percentHi from "./locale/hi";
import percentId from "./locale/id";
import percentIt from "./locale/it";
import percentJa from "./locale/ja";
import percentKo from "./locale/ko";
import percentNl from "./locale/nl";
import percentPl from "./locale/pl";
import percentPt from "./locale/pt";
import percentRu from "./locale/ru";
import percentTr from "./locale/tr";
import percentUk from "./locale/uk";
import percentZh from "./locale/zh";

/**
 * The corpus for `@smartput/percent`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `number` for the `of` and the plus/minus forms, whose result is a number rather than a percentage.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state, and drops the ones its language has no use for. Sharing one table
 * across engines would assert the table; this asserts the language.
 *
 * This kind prints a sign and never a word — no vocabulary here declares
 * `forms` — so what a language spends its rows on is the two things left: which
 * spellings reach the unit, and how the number and the sign are written. So
 * `corpus/pl.tsv` and `corpus/ru.tsv` read four plural categories apiece and
 * print the same sign for all four, on the same two separators, one setting the
 * sign off from the number and the other setting it tight; `corpus/es.tsv`,
 * `corpus/it.tsv` and `corpus/pt.tsv` each pin the two-token phrase their
 * language actually writes reading as arithmetic instead of as a unit;
 * `corpus/tr.tsv` and `corpus/zh.tsv` add no word at all, because theirs stands
 * in front of the number where an alias cannot reach; `corpus/ar.tsv` spends
 * rows on three orthographies and on Latin digits inside right-to-left text;
 * `corpus/hi.tsv` reads Indian grouping and writes it back in threes; and
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
  ["ar", arabic, numberAr, percentAr],
  ["de", german, numberDe, percentDe],
  ["en", english, numberEn, percentEn],
  ["es", spanish, numberEs, percentEs],
  ["fr", french, numberFr, percentFr],
  ["hi", hindi, numberHi, percentHi],
  ["id", indonesian, numberId, percentId],
  ["it", italian, numberIt, percentIt],
  ["ja", japanese, numberJa, percentJa],
  ["ko", korean, numberKo, percentKo],
  ["nl", dutch, numberNl, percentNl],
  ["pl", polish, numberPl, percentPl],
  ["pt", portuguese, numberPt, percentPt],
  ["ru", russian, numberRu, percentRu],
  ["tr", turkish, numberTr, percentTr],
  ["uk", ukrainian, numberUk, percentUk],
  ["zh", chinese, numberZh, percentZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, percent],
    }),
  })),
);

corpora.evaluate();
