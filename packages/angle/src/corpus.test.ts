import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { Corpora } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberEn from "@smartput/number/locale/en";
import numberUk from "@smartput/number/locale/uk";
import { angle } from "./index";
import angleEn from "./locale/en";
import angleUk from "./locale/uk";

/**
 * The corpus for `@smartput/angle`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `number` because the generated scaling ops name it: without it `45 deg * 2` has no signature to match.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 *
 * One engine per language, and one corpus file per engine. The two tables are
 * not translations of each other: `corpus/uk.tsv` carries the rows English
 * cannot express — four plural categories, a genitive singular for fractions, a
 * decimal comma where English puts a thousands separator — and `corpus/en.tsv`
 * keeps the ones Ukrainian has no use for. Sharing one table across both
 * engines would assert the table; this asserts the language.
 */
const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine: createEngine({
      locales: [composeLocale(en, [numberEn, angleEn])],
      kinds: [number, angle],
    }),
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, [numberUk, angleUk])],
      kinds: [number, angle],
    }),
  },
]);

corpora.evaluate();
