import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Dutch words for the angle units — the same four `en`, `uk` and `de` name, and
 * all four have words: Dutch writes every one of them out.
 *
 * **Two `forms` keys, and no case axis at all.** `dutch.selectForm` returns the
 * bare CLDR plural category, so the key set is exactly `one` and `other` (rule
 * 6) — English's shape, not German's. Modern Dutch has no case marking left on
 * common nouns, so `in`, `naar` and `van` govern nothing and "in graden" is
 * spelled with the same word as "twee graden". `@smartput/angle/locale/de`
 * needs four cells to say that; this file needs two, and the reason it needs
 * only two is grammar rather than an unfinished table.
 *
 * **This is the one kind of the six where the number axis genuinely moves,
 * on three units out of four.** Dutch keeps a measure noun in the singular
 * after a numeral — "tien meter", "vijf kilo", "drie liter" — and that rule is
 * why almost every `forms` table in this language writes one word twice. It
 * does not reach here: an angle in degrees is *counted*, not measured out, and
 * Dutch writes "een hoek van 90 graden" and "de hoek in radialen" with no
 * exception anybody would recognise. So `graad`/`graden`,
 * `radiaal`/`radialen` and `omwenteling`/`omwentelingen` all mark their
 * plurals, and `gon` — a coined symbol-word, invariant like every other
 * abbreviation-turned-noun — is the single unit here that does not.
 *
 * **Dutch does not have to take `grad` away from the gradian, and German did.**
 * `@smartput/angle/locale/de` spends its whole header on that reservation: the
 * German word for an angular degree *is* `Grad`, which is exactly the string
 * `units.ts` declares as the English abbreviation for the **gradian**, so one of
 * the two units had to yield. The Dutch word is `graad`, with the long vowel
 * Dutch spells `aa`, and `graad` is a string nothing else in this kind claims.
 * Both units therefore keep everything `units.ts` gave them.
 *
 * That escape is narrower than it looks, and it is the language's doing rather
 * than this file's. `@smartput/core/locale/nl` deliberately does **not** strip
 * `-en`, because Dutch's main plural shortens an open syllable rather than
 * appending an ending. Had it stripped `-en`, `graden` would have been offered
 * as `grad` — the gradian — and every Dutch degree in the language would have
 * carried a penalised reading of the wrong unit inside the same kind, which is
 * the one collision `assertLocaleContract` cannot resolve by weight. The
 * stripper's `-n` gives `grade` instead, which nothing claims.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in a Dutch engine and
 * the micro path (`parseAngle`) cannot drift from it. What this file adds is the
 * four Dutch nouns, their plurals, and the two signs a Dutch reader types.
 *
 * **No capitals anywhere, and that is the German stress this language does not
 * share.** Dutch capitalises no noun, so the `forms` print `graden` exactly as
 * the aliases list it and there is no fold between the two halves of this file
 * — where `de.ts` prints `Grad` and indexes `grad`. A translator arriving from
 * German and capitalising these tables would produce words no Dutch reader
 * would ever type.
 *
 * `symbol` is what Dutch itself writes: `rad` and `gon` are the international
 * abbreviations Dutch technical prose uses unchanged, `°` is the only short form
 * an angular degree has ever had, and `omw` is the Dutch abbreviation for a
 * revolution — the `omw` of "omw/min", which is how a Dutch tachometer is
 * labelled. Each is also an alias, so a printed symbol reads back. R8 wants an
 * explicit symbol on every unit, never an invented one.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/nl` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "angle",
  units: {
    // `de radiaal`, plural `radialen`. Dutch physics writes "een hoek in
    // radialen" rather than the bare stem, so this unit marks its plural like an
    // ordinary noun — the measure-noun invariance rule covers metric magnitudes,
    // not counted angles.
    rad: {
      aliases: [...alias("rad"), "radiaal", "radialen"],
      symbol: "rad",
      forms: { one: "radiaal", other: "radialen" },
    },
    // `de graad`, plural `graden`, and the unit that would have collided with
    // the gradian in a language that stripped `-en`. `°` is listed as an alias
    // because it is the symbol this table prints and `units.ts` does not declare
    // it — a printed string that is not a readable one is what
    // `assertLocaleContract` fails on.
    deg: {
      aliases: [...alias("deg"), "graad", "graden", "°"],
      symbol: "°",
      forms: { one: "graad", other: "graden" },
    },
    // `de gon` — the ISO name, invariant after a numeral ("400 gon") the way
    // every abbreviation-turned-noun is in Dutch. `nieuwe graad` and `decimale
    // graad` are the older descriptive names and are two words each, so neither
    // is listable: `lex` ends a word token at a space, and a phrase no single
    // analyzer is ever handed is not an alias.
    grad: {
      aliases: [...alias("grad")],
      symbol: "gon",
      forms: { one: "gon", other: "gon" },
    },
    // `de omwenteling`, plural `omwentelingen`, with `toer`/`toeren` beside it
    // as the everyday spoken word — a Dutch rev counter reads in "toeren per
    // minuut". Only the formal noun is printed, because it is the one that is
    // unambiguously a full rotation; `toer` also means a trip and a knitting
    // round.
    turn: {
      aliases: [
        ...alias("turn"),
        "omwenteling",
        "omwentelingen",
        "toer",
        "toeren",
        "omw",
      ],
      symbol: "omw",
      forms: { one: "omwenteling", other: "omwentelingen" },
    },
  },
});
