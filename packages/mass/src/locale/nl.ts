import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Dutch words for the mass units — the same six `en`, `uk` and `de` name, and
 * the same answer to "does this unit have words at all?": all six do.
 *
 * **Two `forms` keys, not German's four.** `dutch.selectForm` returns the bare
 * CLDR plural category, so the key set is exactly `one` and `other` (rule 6).
 * Modern Dutch has no case marking left on common nouns, so `in`, `naar` and
 * `van` govern nothing and "in gram" is spelled like "twee gram" — where
 * `@smartput/mass/locale/de` needs a second axis to hold "in Tonnen".
 *
 * **And not one of the six moves on the number axis.** A Dutch measure noun
 * stays singular after a numeral: "vijf kilo", "twee gram", "drie ton". So both
 * rows of every table below hold the same word, and a table that wrote a plural
 * into `other` would be inventing Dutch. The free nouns do have plurals —
 * `grammen`, `kilogrammen`, `tonnen`, `ponden` — and each is listed as an alias
 * so a reader who types one is understood; none is printed. The contrast is
 * `@smartput/angle/locale/nl`, where `graad`/`graden` marks its plural because
 * an angle is counted rather than measured out.
 *
 * Those plurals have to be written out here rather than left to morphology, and
 * that is a Dutch-specific finding rather than thoroughness.
 * `@smartput/core/locale/nl` deliberately does **not** strip `-en`, because the
 * Dutch plural is not a suffix: it doubles the stem consonant (*gram* →
 * *grammen*, *ton* → *tonnen*) or shortens an open syllable, so stripping `en`
 * would yield *gramm* and *tonn* — stems that are not the singular in exactly
 * the cases the rule would be needed for. The vocabulary is where those forms
 * belong.
 *
 * **`ons` is deliberately not listed, and `pond` deliberately is.** They are the
 * same hazard at two different sizes, and they get opposite answers:
 *
 *   `een ons` is **100 g** in Dutch — not a colloquialism but the legal metric
 *   *ons* the Netherlands has used since 1869, and what every Dutch butcher and
 *   recipe means by the word. This unit is the avoirdupois ounce, 28.35 g.
 *   Claiming `ons` for it would answer a number 3.5× wrong for the one word a
 *   Dutch cook is likeliest to type, and the kind has no 100 g unit for the
 *   right reading to land on — so the word stays out entirely. A refusal
 *   (`NoCandidateError`) says "this engine does not know *ons*"; a 3.5× error
 *   says nothing at all. Dutch has an ordinary word for the imperial unit,
 *   `ounce`, which `units.ts` already declares, so the omission costs nothing.
 *   This is `@smartput/measure/locale/de`'s reasoning about `Cicero`, applied to
 *   a bigger discrepancy.
 *
 *   `een pond` is **500 g** colloquially and *is* the Dutch word for the
 *   imperial pound — "het Engelse pond" is what the full name shortens from — so
 *   the two readings are 10 % apart rather than 3.5× apart, and refusing the
 *   word would not remove the ambiguity, only make it unreadable. Same decision
 *   `@smartput/mass/locale/de` takes for `Pfund`, at the same stated cost: "5
 *   pond" typed by a Dutch cook means 2.5 kg and this engine answers 2.268 kg.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Dutch engine and the
 * micro path (`parseMass`) cannot drift from it. That map already carries
 * `gram`, `kilo` and `kilos`, which are the Dutch words unchanged — Dutch spells
 * `gram` with one `m`, where German writes `Gramm` — so what this file adds is
 * the doubled-consonant plurals, the apostrophe plural `kilo's`, `ton` and
 * `pond`.
 *
 * `kilograms` stays out, deliberately and for `units.ts`'s reason rather than a
 * Dutch one: it is not in the alias map at all, because `packages/core`'s
 * `engine.test.ts` pins "1.5 kilograms" as the example of a word reached only
 * through a suffix stripper. Nothing here puts it back.
 *
 * **No capitals.** Dutch capitalises no noun, so the aliases below are the
 * spellings a Dutch reader types and the `forms` print the same strings — where
 * `de.ts` prints `Gramm` and indexes `gramm`, and needs a fold between the two.
 *
 * `symbol` is the international abbreviation on the four SI units, which is what
 * Dutch itself writes, `oz` on the ounce (Dutch recipes translated from English
 * keep it), and the spelled singular on the pound, which Dutch does not
 * abbreviate at all. R8 wants an explicit symbol on every unit, never an
 * invented one.
 *
 * Like `en`, this file names `mass` by **id string** and never imports the kind,
 * which is what lets `@smartput/mass/locale/nl` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "milligrammen"],
      symbol: "mg",
      forms: { one: "milligram", other: "milligram" },
    },
    // `gram` with one `m` is the Dutch spelling — the German `Gramm` is a
    // different string and no analyzer bridges the two — and it is the head
    // `@smartput/core/locale/nl` keeps in its compound list, at the stated cost
    // of *diagram* and *telegram*, because Dutch never writes "kilo gram" apart.
    g: {
      aliases: [...alias("g"), "grammen"],
      symbol: "g",
      forms: { one: "gram", other: "gram" },
    },
    // `kilo's` earns its place: Dutch writes the plural of a noun ending in a
    // single vowel with an apostrophe, so the vowel stays long, and `lex` keeps
    // an apostrophe that stands between two letters. The language's stripper
    // lists `'s` for exactly this, but a form a reader will type belongs in the
    // vocabulary rather than behind a penalty.
    kg: {
      aliases: [...alias("kg"), "kilogrammen", "kilo's"],
      symbol: "kg",
      forms: { one: "kilogram", other: "kilogram" },
    },
    // `de ton` is the metric tonne in Dutch as well, so nothing is being
    // stretched here. `tonnen` doubles its `n` in the plural, which is why it is
    // written out rather than left to a stripper that does not take `-en` off.
    t: {
      aliases: [...alias("t"), "ton", "tonnen"],
      symbol: "t",
      forms: { one: "ton", other: "ton" },
    },
    // The unit `ons` is *not* claimed for; see the header. `ounce` and `ounces`
    // come from `units.ts` and are what a Dutch reader writes for the imperial
    // unit, so this entry adds no word of its own.
    oz: {
      aliases: [...alias("oz")],
      symbol: "oz",
      forms: { one: "ounce", other: "ounce" },
    },
    // `het pond`, plural `ponden` for the free noun and bare `pond` after a
    // numeral. The 500 g reading is the ambiguity the header states rather than
    // hides: this kind has no 500 g unit for it to resolve to.
    lb: {
      aliases: [...alias("lb"), "pond", "ponden"],
      symbol: "pond",
      forms: { one: "pond", other: "pond" },
    },
  },
});
