import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Japanese words for the tempo units.
 *
 * `ja` is the bare tag, modern standard Japanese in its ordinary mixed
 * orthography. Shaped exactly like `en.ts` beside it, down to naming `tempo` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the reciprocal bridge to
 * `duration`, and it is the seam `composeLocale` closes. `aliases` still derives
 * the Latin set from `units.ts` — a Japanese producer types "120 bpm" as readily
 * as anything — and the Japanese spellings are appended, so a `ja` engine reads
 * both scripts.
 *
 * **`hz` declares one form where `en.ts` needed two identical ones**, and that
 * is the whole `ja` contract in a single row. `japanese.selectForm` returns the
 * constant `"other"` for every count and every slot: Japanese nouns do not
 * inflect for number — 一ヘルツ and 五ヘルツ differ in the numeral and nowhere
 * else — and CLDR agrees, `Intl.PluralRules("ja")` declaring the single category
 * `other`. English happened to need two rows holding the same word because
 * "hertz" is its own plural; Japanese needs one row because there is no plural
 * to hold.
 *
 * 「ヘルツ」 is printable as well as readable, which in a `ja` vocabulary is a
 * measurement rather than an assumption. Japanese is unspaced, so
 * `japanese.segment` hands every letter run to `Intl.Segmenter` and ICU's
 * dictionary decides where a katakana word breaks; it returns ヘルツ whole, the
 * way it returns ノット and カロリー whole and unlike キロジュール or
 * ギガワット, which it cuts at the SI prefix. So 「50ヘルツ」 prints and reads
 * straight back. `ja.test.ts` re-runs that segmentation rather than trusting
 * this paragraph.
 *
 * The symbol is "Hz" — the SI spelling, which Japanese writes unchanged on every
 * appliance nameplate in the country (東日本 50Hz, 西日本 60Hz). It never
 * reaches output, since a form outranks a symbol in `renderQuantity`, and it is
 * recorded because R8 wants every unit's written abbreviation on the unit; case
 * folds in the alias index, so "Hz" and "hz" are one key and the casing costs
 * nothing.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` gives and one of its own.**
 * English refuses them because "beats per minute" is a compound the lexer cannot
 * read back; the Japanese is 「毎分…拍」 — literally "per-minute … beats" — which
 * is worse than a compound, because it is *discontinuous*: the rate word comes
 * before the number and the counter after it, and no vocabulary entry can put a
 * label on both sides of its own quantity. What Japanese writes instead is
 * "BPM", in Latin, and that is what this file prints.
 *
 * 「拍」 is listed as an alias, and it is the same elision `datarate`'s ビット
 * and Ukrainian's уд rest on: the counter standing for the whole rate, with the
 * per-minute understood. It is one kanji, so the lexer takes it and ICU returns
 * it whole, and 「120拍」 is what a Japanese score or drum thread writes. Only
 * "bpm" comes back out, because a symbol must be the spelling that is
 * unambiguous with no context around it, and a bare 拍 is a count of beats as
 * readily as a tempo.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "tempo",
  units: {
    bpm: { aliases: [...alias("bpm"), "拍"], symbol: "bpm" },
    hz: {
      aliases: [...alias("hz"), "ヘルツ"],
      symbol: "Hz",
      forms: { other: "ヘルツ" },
    },
  },
});
