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
import { power } from "@smartput/power";
import powerAr from "@smartput/power/locale/ar";
import powerDe from "@smartput/power/locale/de";
import powerEn from "@smartput/power/locale/en";
import powerEs from "@smartput/power/locale/es";
import powerFr from "@smartput/power/locale/fr";
import powerHi from "@smartput/power/locale/hi";
import powerId from "@smartput/power/locale/id";
import powerIt from "@smartput/power/locale/it";
import powerJa from "@smartput/power/locale/ja";
import powerKo from "@smartput/power/locale/ko";
import powerNl from "@smartput/power/locale/nl";
import powerPl from "@smartput/power/locale/pl";
import powerPt from "@smartput/power/locale/pt";
import powerRu from "@smartput/power/locale/ru";
import powerTr from "@smartput/power/locale/tr";
import powerUk from "@smartput/power/locale/uk";
import powerZh from "@smartput/power/locale/zh";
import { energy } from "./index";
import energyAr from "./locale/ar";
import energyDe from "./locale/de";
import energyEn from "./locale/en";
import energyEs from "./locale/es";
import energyFr from "./locale/fr";
import energyHi from "./locale/hi";
import energyId from "./locale/id";
import energyIt from "./locale/it";
import energyJa from "./locale/ja";
import energyKo from "./locale/ko";
import energyNl from "./locale/nl";
import energyPl from "./locale/pl";
import energyPt from "./locale/pt";
import energyRu from "./locale/ru";
import energyTr from "./locale/tr";
import energyUk from "./locale/uk";
import energyZh from "./locale/zh";

/**
 * The corpus for `@smartput/energy`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `power` and `duration` are registered but not depended on: this kind owns all
 * four signatures of the power x duration bridge and names both operands by id
 * string.
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
 * `corpus/pl.tsv` spends its rows on four plural categories and a 21 that
 * counts by the genitive plural where `corpus/ru.tsv` counts by the singular,
 * `corpus/ar.tsv` on six categories with a dual among them, `corpus/fr.tsv` on
 * a `one` that swallows every fraction below two, `corpus/tr.tsv` on a `forms`
 * table one key wide, `corpus/zh.tsv` and `corpus/ja.tsv` on units that print
 * with no space at all, and `corpus/en.tsv` on none of the above.
 *
 * The watt-hour is where the languages disagree most and the reason several of
 * these files exist. English, Spanish, Portuguese, Russian and Arabic have no
 * single token for it and print a symbol; German, French, Italian, Dutch,
 * Polish, Turkish and Korean fuse it into one ordinary noun and print that.
 * And the Russian, Arabic and Hindi symbols carry an interpunct the lexer
 * reads as `*`, so those three re-enter through the power x duration signature
 * and come back out as joules — a unit that reads as arithmetic, which is the
 * road "m/s" has always taken.
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
 * engine needs beside this one: `number` for the spelled cardinals, `duration`
 * and `power` for the two operands of the bridge.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr, durationAr, powerAr, energyAr],
  ["de", german, numberDe, durationDe, powerDe, energyDe],
  ["en", english, numberEn, durationEn, powerEn, energyEn],
  ["es", spanish, numberEs, durationEs, powerEs, energyEs],
  ["fr", french, numberFr, durationFr, powerFr, energyFr],
  ["hi", hindi, numberHi, durationHi, powerHi, energyHi],
  ["id", indonesian, numberId, durationId, powerId, energyId],
  ["it", italian, numberIt, durationIt, powerIt, energyIt],
  ["ja", japanese, numberJa, durationJa, powerJa, energyJa],
  ["ko", korean, numberKo, durationKo, powerKo, energyKo],
  ["nl", dutch, numberNl, durationNl, powerNl, energyNl],
  ["pl", polish, numberPl, durationPl, powerPl, energyPl],
  ["pt", portuguese, numberPt, durationPt, powerPt, energyPt],
  ["ru", russian, numberRu, durationRu, powerRu, energyRu],
  ["tr", turkish, numberTr, durationTr, powerTr, energyTr],
  ["uk", ukrainian, numberUk, durationUk, powerUk, energyUk],
  ["zh", chinese, numberZh, durationZh, powerZh, energyZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, duration, power, energy],
    }),
  })),
);

corpora.evaluate();
