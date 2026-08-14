import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { Corpora } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberEn from "@smartput/number/locale/en";
import numberUk from "@smartput/number/locale/uk";
import { measure } from "./index";
import measureEn from "./locale/en";
import measureUk from "./locale/uk";

/**
 * The corpus for `@smartput/measure`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * This kind is deliberately absent from `BUILTIN_KINDS` — its mm/cm aliases
 * collide with `length` — so an engine built by hand is the only way to reach
 * it, and the only way to test it. That is also why neither corpus can be
 * replayed through `@smartput/kinds`: this package is the only owner of these
 * rows in either language.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 *
 * One engine per language, and one corpus file per engine. The Ukrainian table
 * carries what English cannot express — three declension paradigms across six
 * units, and a fractional count that takes the genitive singular — while the
 * English one keeps the plain `one`/`other` rows.
 */
const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine: createEngine({
      locales: [composeLocale(en, [numberEn, measureEn])],
      kinds: [number, measure],
    }),
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, [numberUk, measureUk])],
      kinds: [number, measure],
    }),
  },
]);

corpora.evaluate();
