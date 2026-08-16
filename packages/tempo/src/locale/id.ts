import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Indonesian words for the tempo units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Shaped
 * exactly like `en.ts`, `nl.ts` and `uk.ts` beside it, down to naming `tempo` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the reciprocal bridge to
 * `duration`, and it is the seam `composeLocale` closes. `aliases` still derives
 * the Latin set from `units.ts` — an Indonesian musician types "120 bpm" and
 * nothing else — and the one Indonesian noun is appended to it.
 *
 * **`bpm` keeps no `forms`, and Indonesian has no escape from that.** `en.ts`
 * refuses them because "beats per minute" is a compound the lexer cannot read
 * back; Dutch and German would normally answer by closing the compound up, and
 * `@smartput/energy/locale/nl` prints *kilowattuur* on exactly that strength.
 * Indonesian never had that move: it does not glue nouns, and its name for this
 * quantity is "ketukan per menit" — three words, with *per* a borrowed
 * preposition between two free nouns. `parse/lex.ts` builds a unit word out of
 * letters plus trailing digits, so the space ends the token however the phrase
 * is spelled. Absent forms keep the renderer on the symbol.
 *
 * **The symbol is "bpm", and there is no Indonesian abbreviation competing for
 * the slot.** The one an Indonesian metronome or a scoresheet might print is
 * "ket/mnt", and it carries "/", which lexes as division — so "120 ket/mnt"
 * would reach the resolver as `tempo ÷ duration`, a signature no kind declares
 * and none should. `energy` and `speed` survive that same shape by making the
 * arithmetic true (`km/jam` really is a length over a duration); the escape is
 * closed here because tempo's canonical *is* beats per minute — there is no
 * "beat" kind for the numerator to be a quantity of, and `index.ts` declares
 * only the two reciprocal `in` bridges, no `/` at all. So the requirement
 * collapses to one line: the symbol must be a single token that is already an
 * alias, and "bpm" is what an Indonesian music forum writes and the only
 * spelling that is both.
 *
 * **`ketukan` is a second way in and never a way out.** It is the ordinary
 * Indonesian noun for a musical beat — "empat ketukan dalam satu birama" — and
 * standing for the whole abbreviation it is the same elision that lets an
 * English speaker type "bpm" for a tempo, or a Dutch one "slagen". Only "bpm"
 * comes back out, because rule 5 asks that every printed form be a readable one
 * and says nothing about the reverse. The bare root *ketuk* is deliberately not
 * claimed: it is a verb ("to knock"), it is not what a musician writes after a
 * numeral, and `indonesian.analyze` is `[identity()]` with no stripper that
 * could confuse the two — which means claiming the root would be a decision
 * rather than an accident, and there is no reason to take it.
 *
 * **`hz` declares its one key, and that key holds `hertz`.**
 * `indonesian.selectForm` returns the constant `"other"` for every count and
 * every slot, so where `de.ts` writes four identical rows and `nl.ts` two, this
 * writes one. It is worth being clear about why that is not the same claim they
 * are making: German and Dutch each have a live number axis and argue that *this
 * noun* sits on the invariant side of it, so their repeated rows are a fact
 * about *Hertz*. Indonesian has no axis at all — plurality is reduplication and
 * reduplication does not survive a numeral — so the single row is a fact about
 * the language, and it would look exactly the same for a noun that inflects
 * everywhere else in Europe. `@smartput/duration`'s Indonesian file is where
 * that is measured rather than asserted: *jam*, *hari* and *minggu* are the six
 * time words a Dutch file has to sort into marked and invariant, and Indonesian
 * gives one answer six times.
 *
 * The symbol `Hz` is SI's and is what Indonesian writes; its capital is the
 * initial of Hertz the person, not a noun capital, which Indonesian has none of.
 * It folds onto the derived alias `hz`, which is the mechanism by which a
 * `symbols: true` print parses back.
 *
 * One consequence of the split table is visible in the output and is recorded
 * rather than patched: `hz` carries a word so `formatValue` spaces it ("2
 * hertz"), while `bpm` falls to the symbol branch, which
 * `defaultRenderQuantity` sets tight ("120bpm"). Indonesian typography wants the
 * space in both. `@smartput/core/locale/id` declines a `renderQuantity` on the
 * reasoning that every translated Indonesian unit carries a `forms` row; this
 * kind, `@smartput/datarate` and `@smartput/speed` are where that runs out, and
 * the repair belongs in the language file.
 */
export default defineVocabulary({
  locale: "id",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "ketukan"],
      symbol: "bpm",
    },
    hz: {
      aliases: alias("hz"),
      symbol: "Hz",
      forms: { other: "hertz" },
    },
  },
});
