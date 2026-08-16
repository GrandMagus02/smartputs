import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Japanese words for the datasize units.
 *
 * `ja` is the bare tag, modern standard Japanese in its ordinary mixed
 * orthography. The shape is `en.ts`'s: the same `kind` named by **id string**
 * rather than imported, `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). Two things differ, and
 * both come from the language rather than from this kind.
 *
 * **One form key, not two.** `japanese.selectForm` returns the constant
 * `"other"` for every count and every slot, because Japanese nouns do not
 * inflect for number — 一バイト and 五バイト differ in the numeral and nowhere
 * else — and CLDR agrees (`Intl.PluralRules("ja")` declares the single category
 * `other`). A table translated from `en.ts` would need no key renamed; it would
 * need its `"one"` row deleted.
 *
 * **No unit declares that row, and the measurement below is why.** Japanese is
 * unspaced, so `japanese.segment` hands every letter run to `Intl.Segmenter` and
 * ICU's Japanese dictionary decides where a katakana compound breaks. It knows
 * some of these words and not others:
 *
 * ```
 * バイト     → ["バイト"]           キロバイト → ["キロバイト"]
 * メガバイト → ["メガバイト"]        ギガバイト → ["ギガバイト"]
 * テラバイト → ["テラ", "バイト"]    キビバイト → ["キビ", "バイト"]
 * メビバイト → ["メビバイト"]        ギビバイト → ["ギビバイト"]
 * テビバイト → ["テビバイト"]
 * ```
 *
 * A `forms` entry of 「テラバイト」 would print 「2テラバイト」 and then reach
 * the resolver as テラ + バイト — two tokens, of which the first is nobody's
 * unit — so the printed size would not read back. That is the one property a
 * vocabulary must have and the one `assertLocaleContract` cannot check for
 * itself: it walks the alias index, and the alias index never sees the
 * segmenter.
 *
 * The rule this repo's `ja` vocabularies follow is therefore **by family rather
 * than by unit — a family spells itself out only when every member of it
 * survives**. Seven of these nine words do; テラバイト and キビバイト do not,
 * and they are not the marginal two. テラバイト is the *decimal* family's top
 * unit and the one a Japanese storefront writes most often, so spelling the
 * family would print 「512バイト」 and 「1.5ギガバイト」 beside 「2TB」 — one
 * kind speaking two registers, with which register you get decided by an ICU
 * dictionary rather than by Japanese. Symbols throughout instead, which is what
 * a Japanese product page prints anyway: 「1.5GB」, 「2TB」, 「512MB」.
 *
 * The seven readable words stay in `aliases`, where they cost nothing and where
 * a reader who types 「5ギガバイト」 is understood. The two ICU breaks are absent
 * from `aliases` as well — an alias the lexer can never hand to the index is
 * dead weight, not documentation — and `ja.test.ts` re-runs the measurement, so
 * a dictionary that later learns テラバイト surfaces as a failing test rather
 * than as a gap nobody notices.
 *
 * **Symbols are the Latin ones, and that is Japanese.** A Japanese page writes
 * 「1.5GB」 and 「512MB」 exactly as an English one does; there is no kana
 * abbreviation for a data size, and R8 forbids inventing one. The IEC binary
 * prefixes keep their `i` — KiB, MiB, GiB, TiB — because the decimal and binary
 * families are separate units and never two names for one (1kB is 1000 bytes,
 * 1KiB is 1024), and the symbol is where that distinction stays visible. Case
 * folds in the alias index, so "GB" and "gb" are one key and the casing costs
 * nothing.
 *
 * **Both scripts read.** The Latin spellings come from `units.ts` through
 * `aliasesFor`, so the micro path (`parseDatasize`) and the engine path agree by
 * construction, and the katakana names are appended to them. Nobody switches
 * input mode to type a unit: 「5ギガバイト」 and "5 gb" are the same sentence,
 * and a `ja` engine has to take both.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "datasize",
  units: {
    b: { aliases: [...alias("b"), "バイト"], symbol: "B" },
    kb: { aliases: [...alias("kb"), "キロバイト"], symbol: "kB" },
    mb: { aliases: [...alias("mb"), "メガバイト"], symbol: "MB" },
    gb: { aliases: [...alias("gb"), "ギガバイト"], symbol: "GB" },
    // No katakana: ICU cuts テラバイト into テラ + バイト, and テラ is nobody's
    // unit, so the word could never reach the index however it were listed.
    tb: { aliases: alias("tb"), symbol: "TB" },
    // Same measurement, same answer — キビバイト cuts into キビ + バイト.
    kib: { aliases: alias("kib"), symbol: "KiB" },
    mib: { aliases: [...alias("mib"), "メビバイト"], symbol: "MiB" },
    gib: { aliases: [...alias("gib"), "ギビバイト"], symbol: "GiB" },
    tib: { aliases: [...alias("tib"), "テビバイト"], symbol: "TiB" },
  },
});
