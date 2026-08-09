import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { Corpora } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationEn from "@smartput/duration/locale/en";
import durationUk from "@smartput/duration/locale/uk";
import { length } from "@smartput/length";
import lengthEn from "@smartput/length/locale/en";
import lengthUk from "@smartput/length/locale/uk";
import { number } from "@smartput/number";
import numberEn from "@smartput/number/locale/en";
import numberUk from "@smartput/number/locale/uk";
import { speed } from "./index";
import speedEn from "./locale/en";
import speedUk from "./locale/uk";

/**
 * The corpus for `@smartput/speed`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `length` and `duration` are registered but not depended on: the `length / duration` signature names both by id string.
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
      locales: [composeLocale(en, [numberEn, lengthEn, durationEn, speedEn])],
      kinds: [number, length, duration, speed],
    }),
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, [numberUk, lengthUk, durationUk, speedUk])],
      kinds: [number, length, duration, speed],
    }),
  },
]);

corpora.evaluate();
