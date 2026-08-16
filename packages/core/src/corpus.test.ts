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
import { createEngine } from "./engine";
import { composeLocale } from "./locale/compose";
import { Corpora } from "./testing";
import type { Language, Vocabulary } from "./types";

/**
 * The engine's own corpus, replayed in every language it speaks.
 *
 * `corpus/uk.tsv` was already here — `parity.test.ts` next door reads column 0
 * of it for the recorded-snapshot half — but this file only ever opened
 * `corpus/en.tsv`, so the Ukrainian rows were asserted by the parity net and
 * not by the corpus net. They are asserted by both now, which is the point:
 * a snapshot says an output did not change, and these three columns say it was
 * right to begin with.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state and drops the ones its language has no use for, so sharing one table
 * across engines would assert the table and this asserts the language. That is
 * why `corpus/pl.tsv` and `corpus/ru.tsv` disagree about which category 21
 * takes, `corpus/ar.tsv` spends six rows on six plural categories and a broken
 * plural, `corpus/fr.tsv` and `corpus/pt.tsv` say the singular after a fraction
 * where `corpus/es.tsv` and `corpus/it.tsv` say the plural, `corpus/tr.tsv`
 * spells one unit two ways to catch the dotless i, `corpus/zh.tsv` puts no
 * space anywhere between a number and its unit, and `corpus/en.tsv` records
 * none of the above.
 */

/**
 * One language's two ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabulary barrel has to stay on the page. Deriving the engine
 * from the id — a map from `"de"` to two dynamic imports — would read shorter
 * and would hide exactly the seam a broken vocabulary breaks at.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  vocabularies: readonly Vocabulary[],
];

/**
 * Every language `@smartput/core` publishes, each paired with the
 * `@smartput/kinds` barrel that gives all seventeen built-in kinds their words
 * in it.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, BUILTIN_AR],
  ["de", german, BUILTIN_DE],
  ["en", english, BUILTIN_EN],
  ["es", spanish, BUILTIN_ES],
  ["fr", french, BUILTIN_FR],
  ["hi", hindi, BUILTIN_HI],
  ["id", indonesian, BUILTIN_ID],
  ["it", italian, BUILTIN_IT],
  ["ja", japanese, BUILTIN_JA],
  ["ko", korean, BUILTIN_KO],
  ["nl", dutch, BUILTIN_NL],
  ["pl", polish, BUILTIN_PL],
  ["pt", portuguese, BUILTIN_PT],
  ["ru", russian, BUILTIN_RU],
  ["tr", turkish, BUILTIN_TR],
  ["uk", ukrainian, BUILTIN_UK],
  ["zh", chinese, BUILTIN_ZH],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: BUILTIN_KINDS,
    }),
  })),
);

corpora.evaluate();
