import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { Corpora } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { money } from "./money";
import { snapshot } from "./snapshot";

/**
 * The corpus for `@smartput/rate`, in both languages, against one fixed rate
 * snapshot so the rows are arithmetic rather than a live quote.
 *
 * Neither engine composes a money vocabulary — `composeLocale(en)` and
 * `composeLocale(uk)` with nothing after them — so every code below is reached
 * through the kind's own unit keys. That is the claim the two tables make
 * together: the ISO codes are the same in every language, so the *input* half
 * of a money corpus barely moves between them, and the output half moves
 * entirely. Ukrainian writes the decimal comma and groups with U+00A0, so the
 * amount English prints as "₴1,000.00" is "₴1 000,00" here and the two strings
 * share no separator; the currency symbol is not a translation and stays put.
 */
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });

const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine: createEngine({ locales: [composeLocale(en)], kinds: [number, money], rates }),
  },
  {
    id: "uk",
    engine: createEngine({ locales: [composeLocale(uk)], kinds: [number, money], rates }),
  },
]);

corpora.evaluate();
