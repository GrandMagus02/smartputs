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
import { number } from "./index";
import numberAr from "./locale/ar";
import numberDe from "./locale/de";
import numberEn from "./locale/en";
import numberEs from "./locale/es";
import numberFr from "./locale/fr";
import numberHi from "./locale/hi";
import numberId from "./locale/id";
import numberIt from "./locale/it";
import numberJa from "./locale/ja";
import numberKo from "./locale/ko";
import numberNl from "./locale/nl";
import numberPl from "./locale/pl";
import numberPt from "./locale/pt";
import numberRu from "./locale/ru";
import numberTr from "./locale/tr";
import numberUk from "./locale/uk";
import numberZh from "./locale/zh";

/**
 * The corpus for `@smartput/number`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * One kind and nothing else. Everything below is arithmetic over a ratio of
 * one, which is what this package is.
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
 * On every other kind the spelled cardinals are a supporting row — a way of
 * saying a quantity of something. Here they are the subject, because a bare
 * count is all this kind has. So `corpus/de.tsv` spends its rows on cardinals
 * written as one token with the units before the tens, `corpus/fr.tsv` on the
 * vigesimal seventies and nineties, `corpus/it.tsv` on the tens eliding their
 * final vowel, `corpus/pt.tsv` on an "e" between every part where Italian
 * writes none, `corpus/zh.tsv` and `corpus/ja.tsv` on the myriad and on which
 * of the two writes the leading 一, `corpus/ar.tsv` on units before tens joined
 * by و, `corpus/hi.tsv` on लाख and on the Indian grouping the reader accepts
 * and the writer cannot yet produce, and `corpus/tr.tsv` on the dotless i.
 *
 * What no file here spends a row on is agreement. Polish, Russian, Ukrainian
 * and Arabic bring four, four, four and six plural categories to this engine
 * and none of them is reachable: there is no unit noun beside a bare count for
 * `selectForm` to inflect, which is the same finding `locale/uk.ts` records
 * from the vocabulary side. What is left of those languages here is the
 * numeral's own morphology — "один"/"одна", "jeden"/"jedna", واحد/واحدة — and
 * that is what those files assert instead.
 *
 * `corpus/id.tsv` asserts an absence: Indonesian is the one language in this
 * set with no cardinals file in core, so it carries no spelled row at all and
 * says why in a comment.
 */

/**
 * One language's two ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabulary has to stay on the page. Deriving the engine from the
 * id — a map from `"de"` to two dynamic imports — would read shorter and would
 * hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies are variadic because a corpus that grew a second kind should
 * add it here and nowhere else.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  ...vocabularies: readonly Vocabulary[],
];

/**
 * Every language this package publishes a vocabulary for, each paired with the
 * `@smartput/core` language it is spoken in.
 *
 * All seventeen carry a corpus. A language with a vocabulary and no rows would
 * be a vocabulary nothing reads back — `Corpora.load` turns a silently missing
 * file into a failure for that reason, and `pending` is the door for a
 * deliberately absent one.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", arabic, numberAr],
  ["de", german, numberDe],
  ["en", english, numberEn],
  ["es", spanish, numberEs],
  ["fr", french, numberFr],
  ["hi", hindi, numberHi],
  ["id", indonesian, numberId],
  ["it", italian, numberIt],
  ["ja", japanese, numberJa],
  ["ko", korean, numberKo],
  ["nl", dutch, numberNl],
  ["pl", polish, numberPl],
  ["pt", portuguese, numberPt],
  ["ru", russian, numberRu],
  ["tr", turkish, numberTr],
  ["uk", ukrainian, numberUk],
  ["zh", chinese, numberZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number],
    }),
  })),
);

corpora.evaluate();
