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
import { BUILTIN_KINDS } from "./index";
import BUILTIN_AR from "./locale/ar";
import BUILTIN_DE from "./locale/de";
import BUILTIN_EN from "./locale/en";
import BUILTIN_ES from "./locale/es";
import BUILTIN_FR from "./locale/fr";
import BUILTIN_HI from "./locale/hi";
import BUILTIN_ID from "./locale/id";
import BUILTIN_IT from "./locale/it";
import BUILTIN_JA from "./locale/ja";
import BUILTIN_KO from "./locale/ko";
import BUILTIN_NL from "./locale/nl";
import BUILTIN_PL from "./locale/pl";
import BUILTIN_PT from "./locale/pt";
import BUILTIN_RU from "./locale/ru";
import BUILTIN_TR from "./locale/tr";
import BUILTIN_UK from "./locale/uk";
import BUILTIN_ZH from "./locale/zh";

/**
 * The corpus for `@smartput/kinds`: the whole built-in set, wired the way the
 * README wires it, asked the questions no single kind package can answer.
 *
 * Every other kind package's corpus stands up the smallest engine that can read
 * its own rows. This one is the opposite claim — that the set ships *together*
 * and the seams between its members hold. `datarate`, `energy`, `speed`,
 * `area` and `tempo` each declare signatures naming their operand kinds by id
 * string, and registry pass 4 keys the op table without checking those ids
 * resolve, so an operand quietly dropped from `BUILTIN_KINDS` makes the
 * signature unreachable rather than a build error. The bridge rows below are
 * the only thing that fails when that happens.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state, and drops the ones its language has no use for. Sharing one table
 * across engines would assert the table; this asserts the language. So
 * `corpus/ar.tsv` spends its rows on six plural categories counting bytes,
 * `corpus/pl.tsv` and `corpus/ru.tsv` on four apiece that disagree with each
 * other about 102, `corpus/fr.tsv` on a `one` that swallows every fraction
 * below two where `corpus/es.tsv` pluralises it, `corpus/tr.tsv` on a
 * conversion that is a verb and a case suffix rather than a preposition,
 * `corpus/nl.tsv` on units that decline for nothing at all, `corpus/hi.tsv` on
 * a grouping the reader accepts and the writer cannot yet produce, and
 * `corpus/en.tsv` on none of the above.
 *
 * A bridge answers a second question in every language but English: a bridge
 * resolves on a *signature*, and a signature is reached through whichever
 * language's words got there. `500 мб / 20 с` and `500 ميغابايت / 20 ثانية`
 * prove the datasize÷duration bridge is reachable from Cyrillic and from
 * Arabic, which no English row can say.
 */

/**
 * One language's two ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabulary set has to stay on the page. Deriving the engine from
 * the id — a map from `"de"` to two dynamic imports — would read shorter and
 * would hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies arrive as one array rather than variadically because that is
 * what this package publishes: `BUILTIN_DE` is the words half of the built-in
 * set, and a row that spread it would be claiming to compose something smaller.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a built-in vocabulary set for, each
 * paired with the `@smartput/core` language it is spoken in.
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
