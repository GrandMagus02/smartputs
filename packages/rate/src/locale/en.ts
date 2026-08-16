import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/**
 * What only English speakers say. The ISO codes and the primary names are
 * generated from `@smartput/currency`'s table; these are the words that would
 * be wrong to put there, because they are not what the currency is called —
 * they are what one language calls it.
 *
 * "euros" is deliberately absent: the table already lists it as an alias of
 * `eur`, and an alias indexed twice is a duplicate candidate at every
 * keystroke.
 */
const COLLOQUIAL: Readonly<Record<string, readonly string[]>> = {
  gbp: ["quid", "sterling"],
  usd: ["buck", "bucks"],
};

/**
 * English words for the currencies, as one vocabulary.
 *
 * This was two things until i18n: a generated lexicon on the kind, and a
 * `LocalePack` beside it adding the slang. A pack was the old way to say
 * "these words are English" about a kind that had already claimed its own —
 * now the kind claims none, so there is one place for words and both halves
 * fold into it.
 *
 * The kind next door names no language at all: it is ISO 4217 codes, ratios
 * that read a rate snapshot, and the `typical` bands completion scores
 * against. This file names `money` by **id string** rather than importing it,
 * which is what lets `@smartput/rate/locale/uk` ship without linking the rate
 * machinery, and lets a translation come from someone who is not the kind's
 * author.
 */
const units: Record<string, UnitWords> = {};
for (const [code, words] of Object.entries(currencyVocabulary("en").units)) {
  const extra = COLLOQUIAL[code];
  units[code] =
    extra === undefined ? words : { ...words, aliases: [...words.aliases, ...extra] };
}

export default defineVocabulary({ locale: "en", kind: "money", units });
