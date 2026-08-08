import { aliasesFor, defineVocabulary } from "@smartput/core";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Ukrainian words for the tempo units.
 *
 * Shaped exactly like `en.ts` beside it, down to naming `tempo` by **id string**
 * rather than importing the kind: that is what lets this file be imported
 * without linking the ratio table or the reciprocal bridge to `duration`, and
 * it is the seam `composeLocale` closes. `aliases` still derives the Latin set
 * from `units.ts` — a Ukrainian speaker types "120 bpm" as readily as "120 уд" —
 * and the Cyrillic spellings are appended, so a uk engine reads both scripts.
 *
 * **`bpm` keeps no `forms`, for the same reason twice over.** `en.ts` refuses
 * them because "beats per minute" is a compound the lexer cannot read back; the
 * Ukrainian phrase is "ударів на хвилину", four words, one of which ("на") is
 * already the `by` keyword. A `forms` table here would be eight keys of prose no
 * input could reach. Absent forms keep the renderer on the symbol, so a
 * Ukrainian tempo prints "120бпм" — the same tight shape English prints
 * "120bpm" through.
 *
 * **`hz` declares all eight**, where `en.ts` needed two identical ones. This is
 * the whole argument for a language-defined form key in two units' worth of
 * space: English "hertz" is its own plural, so one word covered every count,
 * while Ukrainian needs four numbers in the nominative and a locative on top of
 * them. `герц` is a hard-stem masculine measure noun and declines like `палац`
 * and `кварц` — nominative plural in -и, genitive plural in -ів, locative plural
 * in -ах — except in the genitive *singular*, where measure nouns take -а
 * (`герца`, as `метра` and `грама`) rather than the -у an ordinary inanimate
 * would. That `герца` is `nom-other`: the fractional row, "1,5 герца", genitive
 * singular and not a plural at all. Writing `герців` there would print
 * "1,5 герців", which no test in this repo can see.
 *
 * **Symbols.** "Гц" is the Ukrainian SI symbol for hertz and is not optional —
 * unlike `datarate`'s Latin fallbacks, nobody writes "5 Hz" in a Ukrainian
 * sentence. `bpm`'s symbol is "бпм", and that choice gave something up. "уд/хв"
 * is the abbreviation printed on a metronome and the one a Ukrainian reader
 * expects to see, but it cannot be a symbol here, and the reason is the lexer
 * rather than an opinion about Ukrainian. It carries "/", which lexes as
 * division — the same fact `units.ts` gives for refusing a "spb" unit — so
 * "120уд/хв" reaches the engine as tempo ÷ duration, a signature no kind
 * declares, and the printed tempo throws instead of reading back.
 *
 * `energy` and `datarate` survive that same shape by making the arithmetic true:
 * "кВт·год" computes as power × duration, "Мбіт/с" as datasize ÷ duration. That
 * escape is closed here, because tempo's canonical *is* beats per minute — there
 * is no "beat" kind for "уд" to be a quantity of, and `index.ts` declares only
 * the two reciprocal `in` bridges, no `/` at all. So the division has nothing to
 * compute and the requirement collapses to one line: the symbol must be a single
 * token that is already an alias. "бпм" is what a Ukrainian music thread writes,
 * and it is the only spelling that is both. "уд/хв" is absent from this file
 * entirely rather than demoted to an alias, since a "/" is just as unreadable
 * there.
 *
 * The Cyrillic aliases are inflected on purpose — the vocabulary is what the
 * language's suffix stripper falls back *from*, not a stem list, so the genitive
 * plural a reader actually types after a numeral is listed rather than guessed
 * at. Every one of `hz`'s eight `forms` values is in that list, the locative
 * singular `герці` included: a form the printer can emit is a form the parser
 * must read back at full weight, not one the stripper happens to recover with a
 * `-2` penalty. It is the same rule that decided `bpm`'s symbol: what the
 * printer emits, the parser reads back by declaration. `уд` stays alongside
 * `бпм` as a second way in — the numerator of the abbreviation standing for the
 * whole of it, by the same elision that lets English "bpm" be typed for a tempo
 * and `datarate`'s "мбіт" for a rate — but only `бпм` also comes back out.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "бпм", "уд", "удар", "удари", "ударів", "ударах"],
      symbol: "бпм",
    },
    hz: {
      aliases: [
        ...alias("hz"),
        "гц",
        "герц",
        "герца",
        "герци",
        "герців",
        "герці",
        "герцах",
      ],
      symbol: "Гц",
      forms: {
        "nom-one": "герц",
        "nom-few": "герци",
        "nom-many": "герців",
        "nom-other": "герца",
        "loc-one": "герці",
        "loc-few": "герцах",
        "loc-many": "герцах",
        "loc-other": "герцах",
      },
    },
  },
});
