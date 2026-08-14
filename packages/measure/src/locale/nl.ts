import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Dutch words for the typographic units — the same six `en`, `uk` and `de` name,
 * with the same answer to "does this unit have words at all?". All six do: Dutch
 * writes every one of them out.
 *
 * **Two `forms` keys, not German's four.** `dutch.selectForm` returns the bare
 * CLDR plural category, so the key set is exactly `one` and `other` (rule 6).
 * Modern Dutch has no case marking left on common nouns, so `in`, `naar` and
 * `van` govern nothing and "in pixels" is spelled with the same word as "1920
 * pixels" — where `@smartput/measure/locale/de` needs a second axis to hold the
 * dative "in Pixeln".
 *
 * **This kind is where the Dutch measure rule and its exception sit side by
 * side, which is why it is worth reading before the others.** A Dutch measure
 * noun stays singular after a numeral — "twee inch", "twaalf punt", "zes pica" —
 * so five of the six tables below write one word twice. `pixel` is the
 * exception, and not an arbitrary one: a pixel is a *thing you can count*, not a
 * magnitude you measure out, and Dutch marks that difference. "een afbeelding
 * van 800 bij 600 pixels" is what everyone writes, and "600 pixel" is what
 * nobody does. The same split runs through `@smartput/angle/locale/nl`
 * (`graden`, counted) and `@smartput/length/locale/nl` (`meter`, measured), and
 * here both halves of it are inside one kind.
 *
 * **`cicero` and `augustijn` are deliberately not listed.** They are the Dutch
 * typographic words a translator reaches for first, and they name a *different
 * unit*: both are twelve **Didot** points, about 4.512 mm, where a pica is
 * 4.233 mm. Listing either would make this vocabulary quietly answer a wrong
 * number for a word a Dutch typesetter really does type. The kind has no Didot
 * unit for the right reading to resolve to, so both stay out entirely rather
 * than being approximated — a refusal (`NoCandidateError`) says "this engine
 * does not know *augustijn*", and a 6 % error says nothing at all. This is
 * `@smartput/measure/locale/de`'s ruling about `Cicero`, and Dutch inherits both
 * the trap and a second name for it.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in a Dutch engine and
 * the micro path (`parseMeasure`) cannot drift from it. That map already carries
 * the US spellings `millimeter` and `centimeter`, which are the Dutch words
 * unchanged — Dutch spells the prefix with a `c`, where German writes
 * `Zentimeter` — so what this file adds is `punt`, `duim` and the apostrophe
 * plural `pica's`.
 *
 * **No capitals, and that is the German stress Dutch does not share.** Dutch
 * capitalises no noun, so the `forms` print `punt` exactly as the aliases list
 * it — where `de.ts` prints `Punkt`, indexes `punkt`, and has to fold both sides
 * to compare them.
 *
 * `symbol` follows `uk`'s split for `uk`'s reason. The three typographic units
 * keep their Latin abbreviations — `pt`, `pc` and `px` are what a Dutch designer
 * writes in a stylesheet, and inventing a Dutch short form would be a word this
 * file made up rather than one anybody types. The two metric units get the SI
 * abbreviations Dutch itself writes. The inch gets its noun: Dutch abbreviates
 * it with a double prime (`5″`), which `lex` cannot read, so the spelled `inch`
 * is the only short form that round-trips — R8 wants an explicit symbol on every
 * unit, never an unreadable one.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/nl` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "measure",
  units: {
    // `de inch` is the word a Dutch reader recognises on sight and `de duim` is
    // the older native one, still current in Belgium and in carpentry. Both are
    // read; only `inch` is printed. `@smartput/core/locale/nl` keeps `duim` out
    // of its compound heads on purpose — a `duim` is a thumb before it is a unit
    // — so this unit is reachable through the aliases written here and not
    // through morphology.
    inch: {
      aliases: [...alias("inch"), "duim", "duimen"],
      symbol: "inch",
      forms: { one: "inch", other: "inch" },
    },
    mm: {
      aliases: [...alias("mm")],
      symbol: "mm",
      forms: { one: "millimeter", other: "millimeter" },
    },
    // Dutch writes `centimeter` with a `c`, so `units.ts`'s US spelling is the
    // Dutch word and nothing has to be added — where
    // `@smartput/measure/locale/de` has to add `Zentimeter`.
    cm: {
      aliases: [...alias("cm")],
      symbol: "cm",
      forms: { one: "centimeter", other: "centimeter" },
    },
    // `het punt` declines freely (`punten`) and is invariant as a measure: Dutch
    // sets type "in 12 punt", where "12 punten" would be twelve items on a list.
    // The plural is listed as an alias so the other reading is still understood
    // if someone types it.
    pt: {
      aliases: [...alias("pt"), "punt", "punten"],
      symbol: "pt",
      forms: { one: "punt", other: "punt" },
    },
    // A loan Dutch keeps unchanged, and the unit whose Dutch near-synonyms are
    // the trap — see the note on `cicero` and `augustijn` above. `pica's` is the
    // Dutch plural, written with an apostrophe so the final vowel stays long,
    // and `lex` keeps an apostrophe standing between two letters.
    pc: {
      aliases: [...alias("pc"), "pica's"],
      symbol: "pc",
      forms: { one: "pica", other: "pica" },
    },
    // The one unit in this kind whose number axis moves. A pixel is counted
    // rather than measured out, so Dutch marks its plural like any ordinary
    // noun: "1920 pixels", "een afbeelding in pixels".
    px: {
      aliases: [...alias("px")],
      symbol: "px",
      forms: { one: "pixel", other: "pixels" },
    },
  },
});
