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
 * Ukrainian tempo prints "120уд/хв" — the same tight shape English prints
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
 * sentence. "уд/хв" is the standard abbreviation for beats per minute, and it
 * carries "/", an operator character, so the printed tempo does not lex back.
 * `uk.test.ts` pins that rather than papering over it: `PrintOptions` already
 * documents that a symbol need not round-trip, and inventing a slash-free
 * spelling to make one test greener would be inventing Ukrainian.
 *
 * The Cyrillic aliases are inflected on purpose — the vocabulary is what the
 * language's suffix stripper falls back *from*, not a stem list, so the genitive
 * plural a reader actually types after a numeral is listed rather than guessed
 * at. Every one of `hz`'s eight `forms` values is in that list, the locative
 * singular `герці` included: a form the printer can emit is a form the parser
 * must read back at full weight, not one the stripper happens to recover with a
 * `-2` penalty. `уд` and `бпм` are slash-free ways in to a unit whose only symbol is not:
 * `бпм` is what a Ukrainian music thread writes, and `уд` is the numerator of
 * the abbreviation standing for the whole of it, by the same elision that lets
 * English "bpm" be typed for a tempo and `datarate`'s "мбіт" for a rate.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "бпм", "уд", "удар", "удари", "ударів", "ударах"],
      symbol: "уд/хв",
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
