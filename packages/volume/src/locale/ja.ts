import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Japanese words for the volume units — the same five `en`, `uk` and `de` name,
 * and **the same answer German gives** to the one question that divides them:
 * all five carry `forms`, `m3` included.
 *
 * **`m3` is printable here, where `en` and `uk` both refuse it.** Their reason
 * was never that the unit is unspeakable; it was that the spoken name is a
 * phrase — "cubic metres", "кубічних метрів" — and `lex` ends a word token at a
 * space, so no single analyzer is ever handed the whole thing. A printed phrase
 * is text the parser cannot read back, and `assertLocaleContract` fails it by
 * name. Japanese writes 立方メートル with no space in it, so the reason does not
 * apply — and `japanese.segment` was **measured** rather than trusted here,
 * because ICU is free to cut at the Han/Katakana boundary in the middle of the
 * word and does not return it whole by decree. `ja.test.ts` beside this file
 * pins the run. That check is not ceremonial: ICU cuts ラジアン into ラジ + アン,
 * which is why `@smartput/angle/locale/ja` cannot print the word for a radian
 * at all.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `japanese.selectForm` returns the constant `"other"` for every count and
 * every slot — Japanese has no grammatical number, and CLDR's
 * `Intl.PluralRules("ja")` declares the single category `"other"` — so rule 6's
 * closed key set is one row per unit. This table is `en`'s with the `"one"` row
 * deleted; nothing was renamed.
 *
 * 立米 is the colloquial reading of the same unit — a Japanese builder writes it
 * where an engineer writes 立方メートル — so it is listed as an alias and never
 * printed, on the same split `@smartput/area/locale/ja` makes for 平米. The
 * traditional 合 and 升 are **different units** (0.18039 ℓ and 1.8039 ℓ, the
 * measures rice and sake are still sold in) and this kind has no unit for them
 * to resolve to, so they stay out entirely rather than being approximated.
 *
 * `symbol` is what Japanese itself writes: `l` and `ml` are the SI
 * abbreviations, used unchanged, `m³` is the superscript a Japanese page sets
 * exactly as an English one does, and the two imperial units get their spelled
 * katakana nouns because Japanese has no short form for either — ガロン and
 * パイント appear only in translation, and the English `gal` that `units.ts`
 * already registers is not the *Japanese* abbreviation for anything. R8 wants
 * an explicit symbol on every unit, never an invented one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Japanese engine and
 * the micro path (`parseVolume`) cannot drift from it.
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/ja` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "リットル"],
      symbol: "l",
      forms: { other: "リットル" },
    },
    ml: {
      aliases: [...alias("ml"), "ミリリットル"],
      symbol: "ml",
      forms: { other: "ミリリットル" },
    },
    // The unit `en` and `uk` could not print. 立方メートル is one token, it is
    // listed exactly below, and it round-trips — so a Japanese engine answers
    // 「1.5立方メートル」 where an English one answers "1.5m³".
    m3: {
      aliases: [...alias("m3"), "立方メートル", "立米"],
      symbol: "m³",
      forms: { other: "立方メートル" },
    },
    gal: {
      aliases: [...alias("gal"), "ガロン"],
      symbol: "ガロン",
      forms: { other: "ガロン" },
    },
    pint: {
      aliases: [...alias("pint"), "パイント"],
      symbol: "パイント",
      forms: { other: "パイント" },
    },
  },
});
