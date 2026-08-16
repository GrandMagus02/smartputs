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
import { tempdelta, temperature } from "./index";
import temperatureAr from "./locale/ar";
import temperatureDe from "./locale/de";
import temperatureEn from "./locale/en";
import temperatureEs from "./locale/es";
import temperatureFr from "./locale/fr";
import temperatureHi from "./locale/hi";
import temperatureId from "./locale/id";
import temperatureIt from "./locale/it";
import temperatureJa from "./locale/ja";
import temperatureKo from "./locale/ko";
import temperatureNl from "./locale/nl";
import temperaturePl from "./locale/pl";
import temperaturePt from "./locale/pt";
import temperatureRu from "./locale/ru";
import temperatureTr from "./locale/tr";
import temperatureUk from "./locale/uk";
import temperatureZh from "./locale/zh";

/**
 * The corpus for `@smartput/temperature`: one row per sentence someone might
 * type, asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * Two kinds, because a temperature and a difference between two of them are not
 * the same thing: `30 C - 20 C` is 10 degrees of delta, not the temperature
 * 10°C. The vocabulary is spread, not nested — this package exports one per
 * kind — and only the delta answers to `*` and `/`, so every scaling row in
 * every file below reaches for it through a subtraction first.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 *
 * One engine per language, and one corpus file per engine. The tables are not
 * translations of each other: each carries the rows only its own language can
 * state, and drops the ones its language has no use for. Sharing one table
 * across engines would assert the table; this asserts the language. A scale is
 * the odd unit out here — °C is °C in all seventeen, and no vocabulary declares
 * a single plural form — so what the files divide over is everything *around*
 * the symbol. `corpus/de.tsv` spends its rows on the space German leaves before
 * the degree sign and `corpus/ru.tsv` on the one Russian does not,
 * `corpus/pl.tsv` on four plural categories that live in the alias list and
 * reach no printed answer, `corpus/fr.tsv` on a U+202F group separator,
 * `corpus/ar.tsv` on Latin digits inside a right-to-left sentence and a dual,
 * `corpus/tr.tsv` on a conversion that is a verb rather than a preposition,
 * `corpus/zh.tsv` on a number and a unit with nothing between them, and
 * `corpus/en.tsv` on none of the above.
 */

/**
 * One language's ingredients, in the order `composeLocale` takes them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: the composition is the thing under test, so which language file
 * meets which vocabularies has to stay on the page. Deriving the engine from
 * the id — a map from `"de"` to a few dynamic imports — would read shorter and
 * would hide exactly the seam a broken vocabulary breaks at.
 *
 * The vocabularies are variadic because this package already contributes two
 * per language, one per kind, and spreads them into the row.
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
  ["ar", arabic, numberAr, ...temperatureAr],
  ["de", german, numberDe, ...temperatureDe],
  ["en", english, numberEn, ...temperatureEn],
  ["es", spanish, numberEs, ...temperatureEs],
  ["fr", french, numberFr, ...temperatureFr],
  ["hi", hindi, numberHi, ...temperatureHi],
  ["id", indonesian, numberId, ...temperatureId],
  ["it", italian, numberIt, ...temperatureIt],
  ["ja", japanese, numberJa, ...temperatureJa],
  ["ko", korean, numberKo, ...temperatureKo],
  ["nl", dutch, numberNl, ...temperatureNl],
  ["pl", polish, numberPl, ...temperaturePl],
  ["pt", portuguese, numberPt, ...temperaturePt],
  ["ru", russian, numberRu, ...temperatureRu],
  ["tr", turkish, numberTr, ...temperatureTr],
  ["uk", ukrainian, numberUk, ...temperatureUk],
  ["zh", chinese, numberZh, ...temperatureZh],
];

const corpora = await Corpora.load(
  new URL("../corpus/", import.meta.url),
  LANGUAGES.map(([id, language, ...vocabularies]) => ({
    id,
    engine: createEngine({
      locales: [composeLocale(language, vocabularies)],
      kinds: [number, temperature, tempdelta],
    }),
  })),
);

corpora.evaluate();
