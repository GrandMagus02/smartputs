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
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_AR from "@smartput/kinds/locale/ar";
import BUILTIN_DE from "@smartput/kinds/locale/de";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_ES from "@smartput/kinds/locale/es";
import BUILTIN_FR from "@smartput/kinds/locale/fr";
import BUILTIN_HI from "@smartput/kinds/locale/hi";
import BUILTIN_ID from "@smartput/kinds/locale/id";
import BUILTIN_IT from "@smartput/kinds/locale/it";
import BUILTIN_JA from "@smartput/kinds/locale/ja";
import BUILTIN_KO from "@smartput/kinds/locale/ko";
import BUILTIN_NL from "@smartput/kinds/locale/nl";
import BUILTIN_PL from "@smartput/kinds/locale/pl";
import BUILTIN_PT from "@smartput/kinds/locale/pt";
import BUILTIN_RU from "@smartput/kinds/locale/ru";
import BUILTIN_TR from "@smartput/kinds/locale/tr";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import BUILTIN_ZH from "@smartput/kinds/locale/zh";
import { datetime } from "./datetime";
import datetimeAr from "./locale/ar";
import datetimeDe from "./locale/de";
import datetimeEn from "./locale/en";
import datetimeEs from "./locale/es";
import datetimeFr from "./locale/fr";
import datetimeHi from "./locale/hi";
import datetimeId from "./locale/id";
import datetimeIt from "./locale/it";
import datetimeJa from "./locale/ja";
import datetimeKo from "./locale/ko";
import datetimeNl from "./locale/nl";
import datetimePl from "./locale/pl";
import datetimePt from "./locale/pt";
import datetimeRu from "./locale/ru";
import datetimeTr from "./locale/tr";
import datetimeUk from "./locale/uk";
import datetimeZh from "./locale/zh";
import { TEST_NOW, TEST_ZONE } from "./temporal";

/**
 * The corpus for `@smartput/datetime`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * Every built-in kind is registered beside `datetime`, and that is the point of
 * half the rows: the accept-gate has to keep refusing "5 min" and "10 km + 5 km"
 * while claiming "9:30", and it can only be seen refusing them if the readings
 * it refuses in favour of are actually present.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state, and drops the ones its language has no use for. What a language can
 * state here is narrower than in a ratio kind, and narrower in a way worth
 * naming: this package reads its dates through chrono-node in its English
 * configuration, so "heute" and "1 марта 2026" throw under every one of these
 * engines while "today" and "1 March 2026" read under all seventeen. What each
 * file spends its rows on instead is the two halves that *are* translated — the
 * zone words in `locale/<lang>.ts`, and the duration a date difference lands
 * in. So `corpus/ar.tsv` states all six Arabic plural categories by subtracting
 * one date from another, `corpus/pl.tsv` the locative "w Kijowie" against the
 * genitive "do Kijowa", `corpus/tr.tsv` a conversion keyword that is a verb
 * behind its object and an uppercase I that lowercases to "ı",
 * `corpus/zh.tsv` a myriad and word operators that need the whitespace Chinese
 * writing does not have, and `corpus/en.tsv` on none of the above.
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
 * The vocabularies are variadic, and the built-in half of each row is already
 * an array: `BUILTIN_DE` is every built-in kind's German words, spread in
 * beside this package's own.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a vocabulary for, each paired with the
 * `@smartput/core` language it is spoken in and the `@smartput/kinds` bundle
 * the durations, lengths and temperatures beside it are named by.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, ...BUILTIN_AR, datetimeAr],
  ["de", german, ...BUILTIN_DE, datetimeDe],
  ["en", english, ...BUILTIN_EN, datetimeEn],
  ["es", spanish, ...BUILTIN_ES, datetimeEs],
  ["fr", french, ...BUILTIN_FR, datetimeFr],
  ["hi", hindi, ...BUILTIN_HI, datetimeHi],
  ["id", indonesian, ...BUILTIN_ID, datetimeId],
  ["it", italian, ...BUILTIN_IT, datetimeIt],
  ["ja", japanese, ...BUILTIN_JA, datetimeJa],
  ["ko", korean, ...BUILTIN_KO, datetimeKo],
  ["nl", dutch, ...BUILTIN_NL, datetimeNl],
  ["pl", polish, ...BUILTIN_PL, datetimePl],
  ["pt", portuguese, ...BUILTIN_PT, datetimePt],
  ["ru", russian, ...BUILTIN_RU, datetimeRu],
  ["tr", turkish, ...BUILTIN_TR, datetimeTr],
  ["uk", ukrainian, ...BUILTIN_UK, datetimeUk],
  ["zh", chinese, ...BUILTIN_ZH, datetimeZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [...BUILTIN_KINDS, datetime],
      // The clock and the zone every row was generated against. A corpus over a
      // kind whose values are instants is a corpus over `now`, so both have to
      // be pinned here or "9:30" would mean a different thing tomorrow.
      now: () => TEST_NOW,
      timeZone: TEST_ZONE,
    }),
  })),
);

corpora.evaluate();
