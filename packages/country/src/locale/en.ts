import { defineVocabulary, type UnitWords } from "@smartput/core";
import { COUNTRIES } from "../data/countries";
import { MIN_NAME_LENGTH } from "../matcher";

/**
 * English words for the country units.
 *
 * The kind next door names no language at all: `place`'s units are the ISO
 * 3166-1 alpha-2 codes and nothing else, and every name a user can type for one
 * is here. Generated from `COUNTRIES` rather than written out, for the reason
 * `data/countries.ts` is generated at all — 252 rows with up to a dozen aliases
 * each is data, and a hand-kept copy of it would drift from the trie the
 * matcher builds over the same column.
 *
 * It names `place` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets a future `locale/uk` be imported without linking the postal regexes, the
 * completer and the distance op behind it.
 *
 * Two properties of the table are load-bearing and both are asserted in
 * `en.test.ts`:
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
 *   has spoken for it, must not fire for `place`: shipping this vocabulary is
 *   what opts the kind out of it.
 * - **`symbol` is the country's display name**, capitalised as GeoNames writes
 *   it ("Japan", "United Kingdom"), which is what `formatPlace` renders and what
 *   ruling R8 requires of every unit that had one before the split.
 *
 * No `forms`: a country name has no plural anyone types, and `formatPlace` is
 * the kind's own hook — it writes the row's facts and never asks for a form.
 */
const units: Record<string, UnitWords> = {};
for (const row of COUNTRIES) {
  units[row.a2] = {
    aliases: row.aliases.filter((a) => a.length >= MIN_NAME_LENGTH),
    symbol: row.name,
  };
}

export default defineVocabulary({ locale: "en", kind: "place", units });
