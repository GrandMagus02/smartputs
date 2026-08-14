import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { Corpora } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_UK from "@smartput/kinds/locale/uk";

/**
 * The corpus for `@smartput/boolean`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * The whole built-in set, and not a hand-picked pair: this kind generates no operation of its own, so every row below is a comparison signature core generated for some *other* kind. A corpus over two kinds would only prove those two.
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
      locales: [composeLocale(en, BUILTIN_EN)],
      kinds: BUILTIN_KINDS,
    }),
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, BUILTIN_UK)],
      kinds: BUILTIN_KINDS,
    }),
  },
]);

corpora.evaluate();
