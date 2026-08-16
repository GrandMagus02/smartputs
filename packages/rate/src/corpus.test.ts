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
import moneyAr from "./locale/ar";
import moneyDe from "./locale/de";
import moneyEn from "./locale/en";
import moneyEs from "./locale/es";
import moneyFr from "./locale/fr";
import moneyHi from "./locale/hi";
import moneyId from "./locale/id";
import moneyIt from "./locale/it";
import moneyJa from "./locale/ja";
import moneyKo from "./locale/ko";
import moneyNl from "./locale/nl";
import moneyPl from "./locale/pl";
import moneyPt from "./locale/pt";
import moneyRu from "./locale/ru";
import moneyTr from "./locale/tr";
import moneyUk from "./locale/uk";
import moneyZh from "./locale/zh";
import { money } from "./money";
import { snapshot } from "./snapshot";

/**
 * The corpus for `@smartput/rate`, in every language it publishes a vocabulary
 * for, against one fixed rate snapshot so the rows are arithmetic rather than a
 * live quote.
 *
 * Four columns — input, kind, canonical, formatted — because a sentence that
 * lands on the right number in the wrong kind, or the right number under the
 * wrong words, has failed in a way a single assertion would miss.
 *
 * Money splits those four columns down the middle in a way no other kind does,
 * and it is worth saying before the rows are read. The *input* half is entirely
 * language: "5 доларів", "خمسة دولارات", "5 dolarları" and "5 달러를" are four
 * ways of writing the same amount and no two of them share a character. The
 * *output* half is entirely currency: `money`'s format hook renders through
 * `@smartput/currency`'s table, so what comes back is a sign and an amount —
 * `$5.00` — and never a noun. A currency sign is not a translation and stays
 * put. So the tables below spend their rows on plural categories, cases,
 * particles and spellings that only the reader ever sees, and what they pin is
 * many readings arriving at one unit; the third and fourth columns then move
 * only where the *number* is written differently, which is where Polish's
 * U+00A0, French's U+202F and Arabic's Latin digits inside right-to-left text
 * come in.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state and drops the ones its language has no use for. So `corpus/ar.tsv`
 * spends its rows on six plural categories and a broken plural, `corpus/pl.tsv`
 * on four categories and an adjectival currency noun, `corpus/tr.tsv` on suffix
 * stripping and the dotless i, `corpus/zh.tsv` on a script that writes no space
 * between the number and the unit, and `corpus/id.tsv` on a language with no
 * plural and no cardinals at all.
 *
 * The snapshot quotes every currency `@smartput/currency` knows a rate for,
 * rather than the two `en.tsv` and `uk.tsv` needed, because a language's word
 * for the franc or the zloty cannot be read back if the franc has no rate — the
 * `MissingRateError` arrives before the vocabulary is ever consulted.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 170,
  CHF: 0.94,
  PLN: 4.28,
  UAH: 45.5,
  CAD: 1.5,
  AUD: 1.68,
  SEK: 11.2,
  NOK: 11.7,
  CZK: 24.8,
});

/**
 * One language's ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabulary has to stay on the page. Deriving the engine from the
 * id — a map from `"de"` to two dynamic imports — would read shorter and would
 * hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies are variadic because a corpus that grew a second kind should
 * add it here and nowhere else. `@smartput/number`'s vocabulary is deliberately
 * *not* one of them: its units are numbers, the spelled cardinals every table
 * below reads come from the `Language`, and composing it changes not one of the
 * 391 rows.
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
  ["ar", arabic, moneyAr],
  ["de", german, moneyDe],
  ["en", english, moneyEn],
  ["es", spanish, moneyEs],
  ["fr", french, moneyFr],
  ["hi", hindi, moneyHi],
  ["id", indonesian, moneyId],
  ["it", italian, moneyIt],
  ["ja", japanese, moneyJa],
  ["ko", korean, moneyKo],
  ["nl", dutch, moneyNl],
  ["pl", polish, moneyPl],
  ["pt", portuguese, moneyPt],
  ["ru", russian, moneyRu],
  ["tr", turkish, moneyTr],
  ["uk", ukrainian, moneyUk],
  ["zh", chinese, moneyZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, money],
      rates,
    }),
  })),
);

corpora.evaluate();
