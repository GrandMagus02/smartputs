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
import { duration } from "./index";
import durationAr from "./locale/ar";
import durationDe from "./locale/de";
import durationEn from "./locale/en";
import durationEs from "./locale/es";
import durationFr from "./locale/fr";
import durationHi from "./locale/hi";
import durationId from "./locale/id";
import durationIt from "./locale/it";
import durationJa from "./locale/ja";
import durationKo from "./locale/ko";
import durationNl from "./locale/nl";
import durationPl from "./locale/pl";
import durationPt from "./locale/pt";
import durationRu from "./locale/ru";
import durationTr from "./locale/tr";
import durationUk from "./locale/uk";
import durationZh from "./locale/zh";

/**
 * The corpus for `@smartput/duration`: one row per sentence someone might type,
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
 * `corpus/pl.tsv` spends its rows on four plural categories and the one unit
 * whose `few` and `many` coincide, `corpus/ar.tsv` on six categories and two
 * broken plurals, `corpus/fr.tsv` on a `one` that swallows every fraction
 * below two where `corpus/it.tsv` takes the plural for the same number,
 * `corpus/nl.tsv` on the single unit that declines for nothing at all,
 * `corpus/tr.tsv` on a suffix stripper and the dotless i, `corpus/ko.tsv` on
 * the particles a Hangul unit will not let go of, and `corpus/en.tsv` on none
 * of the above.
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
  ["ar", arabic, numberAr, durationAr],
  ["de", german, numberDe, durationDe],
  ["en", english, numberEn, durationEn],
  ["es", spanish, numberEs, durationEs],
  ["fr", french, numberFr, durationFr],
  ["hi", hindi, numberHi, durationHi],
  ["id", indonesian, numberId, durationId],
  ["it", italian, numberIt, durationIt],
  ["ja", japanese, numberJa, durationJa],
  ["ko", korean, numberKo, durationKo],
  ["nl", dutch, numberNl, durationNl],
  ["pl", polish, numberPl, durationPl],
  ["pt", portuguese, numberPt, durationPt],
  ["ru", russian, numberRu, durationRu],
  ["tr", turkish, numberTr, durationTr],
  ["uk", ukrainian, numberUk, durationUk],
  ["zh", chinese, numberZh, durationZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, duration],
    }),
  })),
);

corpora.evaluate();
