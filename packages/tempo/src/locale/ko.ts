import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Korean words for the tempo units.
 *
 * `ko` is the bare tag, modern standard Korean in South Korean orthography.
 * Shaped exactly like `en.ts` beside it, down to naming `tempo` by **id string**
 * rather than importing the kind: that is what lets this file be imported without
 * linking the ratio table or the reciprocal bridge to `duration`, and it is the
 * seam `composeLocale` closes. `aliases` still derives the Latin set from
 * `units.ts` — a Korean producer types "120 bpm" as readily as anything — and the
 * Korean spelling is appended, so a `ko` engine reads both scripts.
 *
 * **`hz` declares one form where `en.ts` needed two identical ones**, and that is
 * the whole `ko` contract in a single row. `korean.selectForm` returns the
 * constant `"other"` for every count and every slot: Korean marks number nowhere
 * on a noun — 일 헤르츠 and 오 헤르츠 differ in the numeral and nowhere else — and
 * CLDR agrees, `Intl.PluralRules("ko")` declaring the single category `other`.
 * English happened to need two rows holding the same word because "hertz" is its
 * own plural; Korean needs one row because there is no plural to hold.
 *
 * 헤르츠 is printable as well as readable, and unlike `ja.ts` next door that
 * costs no measurement to establish. Korean has been spaced since 1896,
 * `korean.segment` is undefined, and `lex` has already cut at every space, so a
 * compound written as one word reaches the alias index as one token by
 * construction — where `ja.ts` had to check ICU's dictionary before it could
 * claim ヘルツ, and had to drop キロジュール and ギガワット elsewhere when the same
 * check went the other way. 「50헤르츠」 prints and reads straight back.
 *
 * The symbol is "Hz" — the SI spelling, which Korean writes unchanged on every
 * appliance nameplate in the country. It never reaches output, since a form
 * outranks a symbol in `renderQuantity`, and it is recorded because R8 wants
 * every unit's written abbreviation on the unit; case folds in the alias index,
 * so "Hz" and "hz" are one key and the casing costs nothing.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` gives and one of its own.**
 * English refuses them because "beats per minute" is a compound the lexer cannot
 * read back; the Korean is 「분당 박수」 — "per-minute beat-count" — which is
 * worse, because 분당 is a *prefix*: it arrives before the number, at a position
 * `lex` can never bind a unit label to, since a unit word attaches to the number
 * on its left. What Korean writes instead is "BPM", in Latin, and that is what
 * this file prints.
 *
 * **And unlike every other `ko` vocabulary here, `bpm` gets no Korean alias
 * either.** Both candidates were considered and both are refused on the flat
 * alias index rather than on doubt about the usage:
 *
 * - 박 is the counter Korean music uses for a beat (「4박자」), and it is also the
 *   counter for *nights away* — 「2박 3일」 is a two-night trip and is one of the
 *   commonest collocations in the language. Claiming it would read an idiom as a
 *   tempo, which is the ground `ja.ts` gives for refusing は and this file gives
 *   for refusing this.
 * - 비트 is the ordinary loanword for a musical beat and is already
 *   `@smartput/datarate`'s word for a bit. The alias index is one flat map with
 *   no kind in the key, and the `@smartput/kinds` barrel installs both, so
 *   「120비트」 would have two readings of two different kinds. `datarate`'s
 *   `ko.ts` records the same split from its side, so the decision is visible from
 *   either file rather than only from the one that won.
 *
 * The elision `ja.ts` could afford — 拍 standing for the whole rate with the
 * per-minute understood — is therefore not available in Korean, and "bpm" is left
 * to carry the unit on its own. That is no loss in practice: a Korean score, DAW
 * and DJ thread all write BPM.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "tempo",
  units: {
    bpm: { aliases: alias("bpm"), symbol: "bpm" },
    hz: {
      aliases: [...alias("hz"), "헤르츠"],
      symbol: "Hz",
      forms: { other: "헤르츠" },
    },
  },
});
