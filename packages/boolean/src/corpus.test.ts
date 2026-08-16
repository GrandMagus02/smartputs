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

/**
 * The corpus for `@smartput/boolean`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * The whole built-in set, and not a hand-picked pair: this kind generates no
 * operation of its own, so every row below is a comparison signature core
 * generated for some *other* kind. A corpus over two kinds would only prove
 * those two.
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
 * categories that disagree with each other about the same number,
 * `corpus/ar.tsv` on six categories and a broken plural, `corpus/tr.tsv` on the
 * dotless i and a conversion verb standing where a preposition would,
 * `corpus/zh.tsv` and `corpus/ja.tsv` on a number and its unit with no space
 * between them, `corpus/id.tsv` on the absent spelled cardinal core has no
 * table for, and `corpus/en.tsv` on none of the above.
 *
 * The third column is the same word in all seventeen, and that is the finding
 * the files keep rather than hide: this kind ships no vocabulary, so
 * `formatValue` degrades to the unit key and every engine answers "true". Each
 * table says so in a comment, which is what makes a later `boolean/locale/<id>`
 * a visible diff here.
 */

/**
 * One language's ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabularies has to stay on the page. Deriving the engine from
 * the id — a map from `"de"` to two dynamic imports — would read shorter and
 * would hide exactly the seam a broken vocabulary breaks at.
 *
 * The words arrive as one barrel rather than as a named vocabulary per kind,
 * which is where this table differs from every single-kind package's. A
 * comparison is generated per kind by core, so the rows below reach fifteen
 * kinds' words and no subset of them would do; `BUILTIN_<ID>` is exactly that
 * set, and it is the one import a consumer of this kind would write too.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  vocabularies: readonly Vocabulary[],
];

/**
 * Every language `@smartput/kinds` publishes a barrel for, each paired with the
 * `@smartput/core` language it is spoken in.
 *
 * All seventeen carry a corpus. A language an engine can be built for and no
 * row is ever read back in would be a language nothing tests —
 * `Corpora.load` turns a silently missing file into a failure for that reason,
 * and `pending` is the door for a deliberately absent one.
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
