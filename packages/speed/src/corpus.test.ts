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
import { speed } from "./index";
import speedAr from "./locale/ar";
import speedDe from "./locale/de";
import speedEn from "./locale/en";
import speedEs from "./locale/es";
import speedFr from "./locale/fr";
import speedHi from "./locale/hi";
import speedId from "./locale/id";
import speedIt from "./locale/it";
import speedJa from "./locale/ja";
import speedKo from "./locale/ko";
import speedNl from "./locale/nl";
import speedPl from "./locale/pl";
import speedPt from "./locale/pt";
import speedRu from "./locale/ru";
import speedTr from "./locale/tr";
import speedUk from "./locale/uk";
import speedZh from "./locale/zh";

/**
 * The corpus for `@smartput/speed`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `length` and `duration` are registered but not depended on: the
 * `length / duration` signature names both by id string.
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
 * categories that disagree with each other at exactly one key, `corpus/ar.tsv`
 * on six categories and a broken plural, `corpus/fr.tsv` on a `one` that
 * swallows every fraction below two and a group separator no keyboard types,
 * `corpus/pt.tsv` on a singular that covers zero, `corpus/tr.tsv` on a unit
 * with no number axis at all and a case fold that moves a letter's identity,
 * `corpus/zh.tsv` on word operators that need the whitespace Chinese does not
 * write, `corpus/hi.tsv` on a grouping rule core does not yet have, and
 * `corpus/en.tsv` on none of the above.
 *
 * Every file also spends rows on this kind's own seam. A speed is a compound,
 * and only the knot is a noun: `mps`, `kph` and `mph` print as slash-bearing
 * symbols with no `forms` table, so the plural rows have exactly one unit to
 * live on, and the compounds are proved instead by reading their own printed
 * symbol back — "120 km/h", "120 km/u", "5 मी/सेकंड" — through the
 * `length / duration` bridge that produced them.
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
 * add it here and nowhere else.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a vocabulary for, each paired with the
 * `@smartput/core` language it is spoken in and the three vocabularies its
 * sentences reach for: `number` for the spelled cardinals, `length` and
 * `duration` for the two operands the bridge divides.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, lengthAr, durationAr, speedAr],
  ["de", german, numberDe, lengthDe, durationDe, speedDe],
  ["en", english, numberEn, lengthEn, durationEn, speedEn],
  ["es", spanish, numberEs, lengthEs, durationEs, speedEs],
  ["fr", french, numberFr, lengthFr, durationFr, speedFr],
  ["hi", hindi, numberHi, lengthHi, durationHi, speedHi],
  ["id", indonesian, numberId, lengthId, durationId, speedId],
  ["it", italian, numberIt, lengthIt, durationIt, speedIt],
  ["ja", japanese, numberJa, lengthJa, durationJa, speedJa],
  ["ko", korean, numberKo, lengthKo, durationKo, speedKo],
  ["nl", dutch, numberNl, lengthNl, durationNl, speedNl],
  ["pl", polish, numberPl, lengthPl, durationPl, speedPl],
  ["pt", portuguese, numberPt, lengthPt, durationPt, speedPt],
  ["ru", russian, numberRu, lengthRu, durationRu, speedRu],
  ["tr", turkish, numberTr, lengthTr, durationTr, speedTr],
  ["uk", ukrainian, numberUk, lengthUk, durationUk, speedUk],
  ["zh", chinese, numberZh, lengthZh, durationZh, speedZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, length, duration, speed],
    }),
  })),
);

corpora.evaluate();
