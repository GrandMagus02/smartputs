import type { UnitWords, Vocabulary } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MIN_NAME_LENGTH } from "../kind/matcher";
import type { CountryRow } from "../kind/types";

/**
 * The words for the country units, built from the table they name.
 *
 * There is no `locale/en.ts` in this package and there will be no `locale/uk.ts`
 * either, and that absence is the point. Every other kind package ships a
 * vocabulary per language because the words are the package's — "kilometre",
 * "kilomètre", "кілометр" are three translations of one unit, and somebody has
 * to write and review them. A country's words are its *names*, and the names are
 * the data's: ask a provider for `lang: "uk"` and the table comes back with
 * Ukrainian names in it, so a translation of this file would be a second, worse
 * copy of what the caller already fetched.
 *
 * So the function takes a table and produces the vocabulary that table implies,
 * in whatever language that table is in.
 *
 * Two properties are load-bearing and both are asserted in `vocabulary.test.ts`:
 *
 * - **Names only, never codes.** The alias index is global — one key, every
 *   kind — so shipping the alpha-2 codes as aliases would make "km" Comoros as
 *   well as a kilometre, "in" Comoros' neighbour instead of the conversion
 *   keyword and "3pm" a country instead of a time, none of which any weight can
 *   undo. `MIN_NAME_LENGTH` is the matcher's own floor, reused here so the two
 *   readings of a surface cannot disagree about which surfaces exist. A code
 *   written *as* a code still resolves — the matcher's trie carries every one of
 *   them and offers it a guard the index has no way to express. This is also why
 *   the registry's R2 pass, which indexes a kind's unit keys when no language
 *   has spoken for it, must not fire for `place`: passing this vocabulary is
 *   what opts the kind out of it.
 * - **`symbol` is the country's display name**, as the provider wrote it
 *   ("Japan", "United Kingdom", "Україна"), which is what the formatter renders
 *   and what ruling R8 requires of every unit that had one before the split.
 *
 * No `forms`: a country name has no plural anyone types, and the place kind's
 * own format hook writes the row's facts rather than asking for a form.
 */
export function placeVocabulary(
  countries: readonly CountryRow[],
  locale = "en",
): Vocabulary {
  const units: Record<string, UnitWords> = {};
  for (const row of countries) {
    units[row.a2] = {
      aliases: row.aliases.filter((alias) => alias.length >= MIN_NAME_LENGTH),
      symbol: row.name,
    };
  }
  return defineVocabulary({ locale, kind: "place", units });
}
