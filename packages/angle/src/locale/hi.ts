import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Hindi words for the angle units — the same four units `en` next door names,
 * and all four have words: Hindi writes every one of them out.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi in
 * Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are a
 * second numbering system that `@smartput/core/locale/hi` reports as
 * unreachable; nothing a word list could do would change that.
 *
 * **Two `forms` keys, and on three of the four units they hold the same
 * string.** `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing
 * else, with no case axis crossed with it — the direct and oblique *singular* of
 * a consonant-final masculine loanword are the same word, so an axis would
 * double every table in the repo to record one cell, and the oblique plural
 * (रेडियनों) is read by `hindi`'s suffix stripper instead. Then the plural
 * collapses too, for a reason specific to counting: a Hindi measure noun stays
 * in the direct singular after a numeral. "नब्बे डिग्री" is ninety degrees;
 * "नब्बे डिग्रियाँ" is not what anyone writes, even though डिग्रियाँ is the
 * regular plural of a feminine ी-final noun and is perfectly good Hindi in a
 * sentence about qualifications. It is listed below as an alias — read, never
 * written — which is the honest way to record a form that exists and is not
 * idiomatic here.
 *
 * **फेरा is the exception, and it is the one native Hindi noun in the kind.**
 * रेडियन, डिग्री and ग्रेडियन are all borrowings and all consonant- or
 * vowel-invariant; फेरा is a masculine ा-final Hindi noun, and those take -े in
 * the direct plural whatever else is going on: एक फेरा, दो फेरे, and सात फेरे is
 * the phrase every Hindi speaker knows from a wedding. So this is the row on
 * which `selectForm`'s answer is observable at all, and therefore the row on
 * which Hindi's plural *boundary* becomes visible: `one` here is CLDR's `i = 0
 * or n = 1`, so 0 and 0.5 take फेरा while 1.5 takes फेरे. English puts 0 in
 * `other` and would have printed the plural for zero. `hi.test.ts` pins all four
 * counts on this unit, because on the other three the rows agree and the
 * boundary cannot be seen.
 *
 * **Symbols are the spelled nominative singulars, and that is a finding rather
 * than a default.** Hindi abbreviates the metric length and mass units heavily
 * (मिमी, किग्रा) and abbreviates none of these: an angle is written out, and the
 * one short form in circulation is the Latin-script `°`, which is not a letter
 * and so is not a token `lex` could hand to an alias index at all. R8 wants an
 * explicit symbol on every unit, not an invented one, so each unit's symbol is
 * its own noun — the same choice `en` makes for `turn`.
 *
 * Every string this file *prints* is also a string it reads. That is a rule
 * about the penalised path rather than about coverage: `hindi`'s stripper would
 * recover a printed फेरे at `weight: -2` by taking it back to the non-word फेर,
 * and a word the printer emits should never come back through a guess.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "90 deg" keeps working in a Hindi engine and
 * the micro path (`parseAngle`) cannot drift from it.
 *
 * Like `en`, this file names `angle` by id string and never imports the kind,
 * which is what lets `@smartput/angle/locale/hi` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "angle",
  units: {
    rad: {
      aliases: [...alias("rad"), "रेडियन", "रैडियन"],
      symbol: "रेडियन",
      forms: { one: "रेडियन", other: "रेडियन" },
    },
    // अंश is the Sanskritic term, and it is what a geometry textbook prints;
    // डिग्री is the everyday borrowing and is what a protractor, a weather
    // report and a spoken direction use. Both are read and डिग्री is written,
    // because recognition is many-to-one and only generation has to choose.
    //
    // डिग्रियाँ (chandrabindu) and डिग्रियां (anusvara) are the regular plural
    // spelled with the two marks two keyboards produce; NFKC folds neither onto
    // the other, so a reader who inflects reaches the unit either way.
    deg: {
      aliases: [...alias("deg"), "डिग्री", "डिग्रियाँ", "डिग्रियां", "अंश"],
      symbol: "डिग्री",
      forms: { one: "डिग्री", other: "डिग्री" },
    },
    // गॉन is the gon under its own name, matching the `gon` alias `units.ts`
    // already carries. ग्रेड is the clipping, and it is listed rather than
    // printed: it is one letter away from ग्रेडियन and collides with nothing in
    // this kind, but "100 ग्रेड" reads as a school grade to anyone who has not
    // been told otherwise.
    grad: {
      aliases: [...alias("grad"), "ग्रेडियन", "ग्रेड", "गॉन"],
      symbol: "ग्रेडियन",
      forms: { one: "ग्रेडियन", other: "ग्रेडियन" },
    },
    // The native noun, and the only inflecting row here. चक्कर is the commoner
    // everyday word for a full revolution ("दो चक्कर लगाओ") and is invariant —
    // consonant-final masculine — so it is read and not written: printing it
    // would throw away the one place this kind has a plural to show.
    // परिक्रमा is the formal astronomical term for the same thing.
    //
    // फेरों is listed and none of the other units' oblique plurals are, because
    // this is the one place `hindi`'s stripper cannot reach. It removes ों and
    // never substitutes, which is enough for a consonant-final noun — चक्करों
    // strips to चक्कर, an alias — but an ा-final noun *replaces* its final vowel
    // to go oblique, so फेरों strips to फेर and फेर is not a word. "दो फेरों
    // में" is exactly the position `hindi.keywords.in` puts a unit in, so the
    // form has to be readable, and here that means listing it.
    turn: {
      aliases: [...alias("turn"), "फेरा", "फेरे", "फेरों", "चक्कर", "परिक्रमा"],
      symbol: "फेरा",
      forms: { one: "फेरा", other: "फेरे" },
    },
  },
});
