import { aliasesFor, defineVocabulary } from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Japanese words for the area units — the same five `en`, `uk` and `de` name,
 * and **the same answer German gives** to the question the squared units pose:
 * all five carry `forms`.
 *
 * **The squared units are printable here, where `en` and `uk` refuse them.**
 * Their reason was never that the unit is unspeakable; it was that the spoken
 * name is a *phrase* — "square metres", "квадратних метрів" — and `lex` ends a
 * word token at a space, so no single analyzer is ever handed the whole thing.
 * A printed phrase is text the parser cannot read back, and
 * `assertLocaleContract` fails it by name. Japanese writes the same concept
 * with no space in it at all — 平方メートル — so the reason simply does not
 * apply. German reached the same place from the other side, by compounding;
 * Japanese reaches it by never having separated the words to begin with.
 *
 * That is a claim about ICU rather than about orthography, though, and it was
 * **measured before it was relied on**: `japanese.segment` hands each letter
 * run to `Intl.Segmenter`, which is free to cut at the Han/Katakana boundary in
 * the middle of 平方メートル and does not — it returns all three of
 * 平方メートル, 平方センチメートル and 平方キロメートル whole. `ja.test.ts`
 * beside this file pins that, and `@smartput/core/locale/ja.test.ts` reports
 * the same run as measured rather than as intended. The check earns its keep:
 * ICU cuts ラジアン into ラジ + アン, which is why `@smartput/angle/locale/ja`
 * cannot print the word for a radian at all.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `japanese.selectForm` returns the constant `"other"` for every count and
 * every slot — Japanese has no grammatical number, and CLDR's
 * `Intl.PluralRules("ja")` declares the single category `"other"` — so rule 6's
 * closed key set is one row per unit.
 *
 * `symbol` is what Japanese itself writes. The three squared units keep the SI
 * superscripts, which a Japanese page sets exactly as an English one does;
 * `ha` is the hectare's international abbreviation and is what Japanese
 * agricultural writing uses; and the acre gets its spelled katakana noun,
 * because Japanese has no short form for a unit it only ever meets in
 * translation. R8 wants an explicit symbol on every unit, never an invented
 * one.
 *
 * 平米 and 坪 are the two words a Japanese estate agent actually writes, and
 * only the first of them is here. 平米 is a *spelling* of the square metre —
 * same unit, colloquial reading — so it is listed as an alias of `m2`, though
 * never printed: 平方メートル is the form that pairs with 平方センチメートル and
 * 平方キロメートル, and a table that printed one of the three in a different
 * register would read as an accident. 坪 is a **different unit** — 3.30578 m²,
 * the traditional tatami-based measure — and this kind has no unit for it to
 * resolve to, so it stays out entirely rather than being approximated, on the
 * same reasoning that keeps `Cicero` out of `@smartput/measure/locale/de`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Japanese engine and
 * the micro path (`parseArea`) cannot drift from it. That map already carries
 * the superscript spellings `m²`, `cm²` and `km²`, which Japanese writes
 * unchanged.
 *
 * Like `en`, this file names `area` by **id string** and never imports the
 * kind, which is what lets `@smartput/area/locale/ja` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "area",
  units: {
    m2: {
      aliases: [...alias("m2"), "平方メートル", "平米"],
      symbol: "m²",
      forms: { other: "平方メートル" },
    },
    cm2: {
      aliases: [...alias("cm2"), "平方センチメートル"],
      symbol: "cm²",
      forms: { other: "平方センチメートル" },
    },
    km2: {
      aliases: [...alias("km2"), "平方キロメートル"],
      symbol: "km²",
      forms: { other: "平方キロメートル" },
    },
    hectare: {
      aliases: [...alias("hectare"), "ヘクタール"],
      symbol: "ha",
      forms: { other: "ヘクタール" },
    },
    acre: {
      aliases: [...alias("acre"), "エーカー"],
      symbol: "エーカー",
      forms: { other: "エーカー" },
    },
  },
});
