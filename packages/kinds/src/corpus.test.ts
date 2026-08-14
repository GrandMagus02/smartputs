import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { Corpora } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_UK from "./locale/uk";

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
