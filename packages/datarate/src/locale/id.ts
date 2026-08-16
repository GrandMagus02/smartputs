import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Indonesian words for the datarate units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Shaped
 * exactly like `en.ts`, `nl.ts` and `ja.ts` beside it, down to naming `datarate`
 * by **id string** rather than importing the kind — that is what lets this file
 * be imported without linking the ratio table or the four bridge signatures, and
 * `composeLocale` is the seam where the two halves meet.
 *
 * **`aliases` is the derived list and nothing else, and that is the finding
 * rather than an unfinished file.** Indonesian borrowed this family whole and
 * did not adapt a letter of it: an Indonesian ISP sells "paket 100 Mbps", a
 * router box prints "Gbps", and the alias index already holds every one of those
 * spellings from `units.ts`. Appending "mbps" to a list that contains "mbps"
 * would be a hand-maintained second copy of the ratio table's alias map. What
 * this file contributes is the other two columns: the symbol casing Indonesia
 * writes, and the argument below for the `forms` column staying empty.
 *
 * **The one colloquialism that exists is the one that cannot be claimed.** An
 * Indonesian speaker does elide the unit — "paket 50 mega", "internetnya 100
 * mega" — exactly as Japanese says 「100メガ」 and Ukrainian "100 мбіт". The
 * elision is real; the word is not claimable. *Mega* is a bare SI prefix and
 * nothing else, so claiming it here would give "50 mega" a datarate reading in
 * any engine that also installs `@smartput/datasize` (where the same elision
 * means megabytes of quota, and is if anything commoner) or `@smartput/power`.
 * The alias index is one flat map with no kind in the key, so the collision
 * would not be a ranked ambiguity between two spellings of one thing but two
 * different quantities under one word. Japanese could take 「メガビット」
 * because the head noun rides along; the Indonesian elision drops it.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * Indonesian reaches by the same road every language in this package has. The
 * Indonesian for a rate is "megabit per detik" — three words, with *per* a
 * borrowed preposition standing between two nouns — and `parse/lex.ts` builds a
 * unit word out of letters plus trailing digits, so a space ends the token
 * however the phrase is spelled. A `forms` table here would be a row of prose no
 * input could reach, which is worse than an empty column: rule 6 is satisfied by
 * an empty key set, never by an unreachable one. Indonesian has no compounding
 * escape either — it is not a Germanic language and does not glue nouns the way
 * `@smartput/energy/locale/nl` glues *kilowattuur* — so unlike Dutch there was
 * never a second road to weigh.
 *
 * Absent forms keep `formatValue` on the symbol, and in this language that costs
 * a space: `defaultRenderQuantity` sets a symbol tight, so a rate prints
 * "2.000Mbps" where Indonesian typography wants "2.000 Mbps". `id.ts`'s own doc
 * comment declines `renderQuantity` on the reasoning that every translated
 * Indonesian unit carries a `forms` row and therefore takes the spacing word
 * branch — true of `duration` and `power`, and false here, in `speed`, and for
 * `tempo`'s bpm. It is recorded rather than worked around, because a
 * `renderQuantity` belongs in the language file and not in seven vocabularies.
 *
 * **The symbols are Latin and SI-cased, and that is Indonesian rather than a
 * fallback.** Indonesia writes a network rate exactly as the rest of the world
 * does and has no abbreviation of its own to prefer — ruling R8 says to use the
 * language's own where the language actually abbreviates and never to invent
 * one, and "Mbps" *is* what Indonesian writes. The lowercase `k` against the
 * capital `M`, `G` and `T` is SI's own rule for prefix symbols, the same
 * distinction `nl.ts` and `de.ts` keep in `@smartput/datasize`. It costs nothing
 * to read back: `buildRegistry` folds an alias to lowercase before indexing, so
 * "Mbps" and the derived "mbps" are one key.
 */
export default defineVocabulary({
  locale: "id",
  kind: "datarate",
  units: {
    bps: { aliases: alias("bps"), symbol: "bps" },
    kbps: { aliases: alias("kbps"), symbol: "kbps" },
    mbps: { aliases: alias("mbps"), symbol: "Mbps" },
    gbps: { aliases: alias("gbps"), symbol: "Gbps" },
    tbps: { aliases: alias("tbps"), symbol: "Tbps" },
  },
});
