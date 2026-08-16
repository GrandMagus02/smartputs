import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Hindi words for the energy units.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are
 * a second numbering system this vocabulary cannot reach — a decision
 * `@smartput/core/locale/hi` documents and reports, not one a word list could
 * take.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind — that is what lets this file be imported without linking
 * the ratio table or the four power/duration/energy signatures), `aliases`
 * derived from `units.ts` rather than retyped, and an explicit `symbol` on every
 * unit (ruling R8).
 *
 * **Two `forms` keys, and on every unit that has them the two hold the same
 * string.** `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing else
 * — no case axis crossed with the plural the way `uk` and `ru` have one, because
 * Hindi's unit nouns are consonant-final masculine loanwords whose direct and
 * oblique *singular* are the same word. Then the plural collapses too, for a
 * second reason specific to counting: a Hindi measure noun stays in the direct
 * singular after a numeral, "पाँच किलोजूल" and never "पाँच किलोजूलें". So the
 * repetition below is the correct table rather than a half-finished one.
 * `@smartput/duration/locale/hi` is where that stops being true — घंटा is
 * ā-final masculine and its plural really is घंटे — which is why this file says
 * *why* its rows agree instead of assuming they must.
 *
 * The boundary is not English's either: Hindi's `one` is CLDR's `i = 0 or n = 1`,
 * so 0, 0.5 and 1 all take `one` while 1.5 and 2 take `other`, where English puts
 * 0 in `other`. Invisible while the rows agree, and pinned in `hi.test.ts` so it
 * stays a fact rather than a coincidence.
 *
 * **The watt-hour family carries no `forms` and prints an interpunct.** Hindi
 * writes it "किलोवाट-घंटा" or "किलोवाट घंटा" — a compound, and `parse/lex.ts`
 * ends a word token at the space and at the hyphen alike, so neither spelling can
 * be one unit token. What ships instead is "किलोवाट·घंटा", and the middle
 * character is not decoration: U+00B7 is the SI multiplication sign between a
 * unit of power and a unit of time, and `lex` reads it as a spelling of `*`. So
 * the printed symbol reaches the resolver as किलोवाट, `*`, घंटा, and this kind's
 * own `* | power | duration` signature multiplies kilowatts by hours back into
 * joules — the route English's "m/s" has always taken. It needs
 * `@smartput/power`'s and `@smartput/duration`'s Hindi vocabularies installed
 * beside this one, which is why `hi.test.ts` proves it on an engine wired with
 * all three rather than on this kind alone.
 *
 * The interpunct spellings are listed as aliases anyway, exactly as `uk.ts` and
 * `ar.ts` list theirs: documentation of what the printer emits, never a working
 * alias, because "·" ends a word token and no alias containing one can match.
 * Inventing a run-together "किलोवाटघंटा" to make one match would put a spelling
 * nobody writes into an index every engine consults.
 *
 * **Symbols elsewhere are the spelled singulars, with one exception.** Hindi
 * abbreviates जूल and कैलोरी with full stops (जू., कै.) and a full stop is not a
 * letter, so `lex` would end the token at the first dot — the same wall
 * `@smartput/mass/locale/hi` hits with कि.ग्रा., but without that file's escape
 * hatch, since no dotless remnant of these is in circulation. R8 asks for the
 * abbreviation a language actually uses or else the spelled nominative singular,
 * never an invented one, so the nouns themselves ship. बीटीयू is the exception
 * and it is not an invention: it is the Latin initialism transliterated letter by
 * letter, and it is what an Indian air-conditioner advertisement prints ("1.5 टन
 * / 18000 बीटीयू"). `uk.ts` kept the Latin "BTU" here because Ukrainian has no
 * such transliteration in circulation; Hindi does.
 *
 * `hindi.renderQuantity` sets a Devanagari symbol off from the number with a
 * space and leaves a Latin one tight, branching on the script of the symbol
 * rather than on the language — so the watt-hour family prints "5 किलोवाट·घंटा"
 * where English prints "5kwh".
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "5 kwh" keeps working in a Hindi engine and the micro path (`parseEnergy`)
 * cannot drift from it.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "energy",
  units: {
    // जूल, किलोजूल and मेगाजूल are consonant-final masculine borrowings: the
    // direct plural is spelled exactly like the singular, so both rows carry one
    // word for the ordinary reason rather than by the measure-noun rule alone.
    j: {
      aliases: [...alias("j"), "जूल"],
      symbol: "जूल",
      forms: { one: "जूल", other: "जूल" },
    },
    kj: {
      aliases: [...alias("kj"), "किलोजूल"],
      symbol: "किलोजूल",
      forms: { one: "किलोजूल", other: "किलोजूल" },
    },
    mj: {
      aliases: [...alias("mj"), "मेगाजूल"],
      symbol: "मेगाजूल",
      forms: { one: "मेगाजूल", other: "मेगाजूल" },
    },
    // See the header: the interpunct is read as `*` and the product is computed
    // by this kind's own `* | power | duration` signature, so these three
    // symbols re-read as energy in any engine that also speaks Hindi power and
    // Hindi duration. The aliases beside them can never match and are here to
    // record what is printed.
    wh: { aliases: [...alias("wh"), "वाट·घंटा"], symbol: "वाट·घंटा" },
    kwh: { aliases: [...alias("kwh"), "किलोवाट·घंटा"], symbol: "किलोवाट·घंटा" },
    mwh: { aliases: [...alias("mwh"), "मेगावाट·घंटा"], symbol: "मेगावाट·घंटा" },
    // कैलोरी is the one feminine noun in this file, and it is ī-final, so its
    // grammatical plural is कैलोरियाँ — a substitution of the ending, not a
    // suffix, which no stripper could undo. It is listed and never printed,
    // because the measure-noun rule outranks the gender rule after a numeral:
    // "500 कैलोरी" is what a nutrition label prints. The same call
    // `@smartput/mass/locale/hi` makes for औंस.
    cal: {
      aliases: [...alias("cal"), "कैलोरी", "कैलोरियाँ"],
      symbol: "कैलोरी",
      forms: { one: "कैलोरी", other: "कैलोरी" },
    },
    // किलोकैलोरी, written as one word on the pattern of किलोग्राम and किलोमीटर.
    // The bare कैलोरी is deliberately not an alias of it, even though a Hindi
    // food label means kilocalories when it prints कैलोरी: that surface already
    // belongs to `cal` above, and claiming it twice inside one kind is a silent
    // factor of 1000. It is the ruling `units.ts` records for English's food
    // "Calorie", restated in the language where the elision is commonest.
    kcal: {
      aliases: [...alias("kcal"), "किलोकैलोरी"],
      symbol: "किलोकैलोरी",
      forms: { one: "किलोकैलोरी", other: "किलोकैलोरी" },
    },
    // "ब्रिटिश थर्मल यूनिट" is the spelled-out name and it is three words, so it
    // can never be a token. बीटीयू is the initialism Hindi actually writes.
    btu: {
      aliases: [...alias("btu"), "बीटीयू"],
      symbol: "बीटीयू",
      forms: { one: "बीटीयू", other: "बीटीयू" },
    },
  },
});
