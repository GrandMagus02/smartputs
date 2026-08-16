import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Russian words for the tempo units.
 *
 * Shaped exactly like `en.ts` beside it, down to naming `tempo` by **id string**
 * rather than importing the kind: that is what lets this file be imported without
 * linking the ratio table or the reciprocal bridge to `duration`, and it is the
 * seam `composeLocale` closes. `aliases` still derives the Latin set from
 * `units.ts` — a Russian speaker types "120 bpm" as readily as "120 уд" — and the
 * Cyrillic spellings are appended, so a `ru` engine reads both scripts.
 *
 * **`bpm` keeps no `forms`, for the same reason twice over.** `en.ts` refuses
 * them because "beats per minute" is a compound the lexer cannot read back; the
 * Russian phrase is "ударов в минуту", three words, and the middle one is core's
 * `in` keyword. A `forms` table here would be eight keys of prose no input could
 * reach — and the one word in the middle of it would arrive as an operator even
 * if the lexer joined the rest. Absent forms keep the renderer on the symbol, so
 * a Russian tempo prints "120бпм" — the same tight shape English prints "120bpm"
 * through.
 *
 * **`hz` declares all eight**, where `en.ts` needed two identical ones. This is
 * the whole argument for a language-defined form key in two units' worth of
 * space: English "hertz" is its own plural, so one word covered every count,
 * while Russian needs four numbers in the nominative and a prepositional on top
 * of them. Two of those four rows are worth naming:
 *
 *   `nom-many`  "5 герц" — the counting form (счётная форма), which for a unit
 *               named after a person is the bare stem. Ампер, вольт, ватт and
 *               герц all behave this way after a numeral, so `nom-one` and
 *               `nom-many` are the same string here. That is a fact about
 *               Russian rather than a table with a hole in it: "1 герц" and
 *               "5 герц" really are spelled alike. "герцев" is listed as an
 *               alias, because recognition is many-to-one (I6) and it is what a
 *               reader who has not read Rosenthal will type; nothing prints it.
 *   `nom-other` "1,5 герца" — the fractional row, and a genitive **singular**.
 *               Measure nouns take -а there rather than the -у an ordinary
 *               inanimate masculine would, which is the same ending "2 герца"
 *               shows: in Russian `nom-few` is a genitive singular too, where
 *               Ukrainian's same cell is a nominative plural ("2 герци").
 *               Writing "герцев" in either row prints a plural at a fraction,
 *               and no test in this repo can see it.
 *
 * The `loc-*` rows are the prepositional case, because "в" governs it — "в 5
 * герцах", never "в 5 герц" — and `loc-other` is the count-free conversion
 * target ("120 bpm в герцах"). The label is `loc` rather than the accurate
 * Russian `prep` by a deliberate borrowing from `uk`, argued at length in
 * `@smartput/core/locale/ru`.
 *
 * **Symbols.** "Гц" is the Russian SI symbol for hertz and is not optional —
 * unlike `datarate`'s Latin fallbacks, nobody writes "5 Hz" in a Russian
 * sentence. `bpm`'s symbol is "бпм", and that choice gave something up. "уд/мин"
 * is the abbreviation printed on a metronome and the one a Russian reader expects
 * to see, but it cannot be a symbol here, and the reason is the lexer rather than
 * an opinion about Russian. It carries "/", which lexes as division — the same
 * fact `units.ts` gives for refusing an "spb" unit — so "120уд/мин" reaches the
 * engine as tempo ÷ duration, a signature no kind declares, and the printed tempo
 * throws instead of reading back.
 *
 * `energy` and `datarate` survive that same shape by making the arithmetic true:
 * "кВт·ч" computes as power × duration. That escape is closed here, because
 * tempo's canonical *is* beats per minute — there is no "beat" kind for "уд" to
 * be a quantity of, and `index.ts` declares only the two reciprocal `in` bridges,
 * no `/` at all. So the division has nothing to compute and the requirement
 * collapses to one line: the symbol must be a single token that is already an
 * alias. "бпм" is what a Russian music thread writes, and it is the only spelling
 * that is both. "уд/мин" is absent from this file entirely rather than demoted to
 * an alias, since a "/" is just as unreadable there.
 *
 * The Cyrillic aliases are inflected on purpose — the vocabulary is what the
 * language's suffix stripper falls back *from*, not a stem list, so the genitive
 * plural a reader actually types after a numeral is listed rather than guessed
 * at. Every one of `hz`'s eight `forms` values is in that list, the prepositional
 * singular "герце" included: a form the printer can emit is a form the parser
 * must read back at full weight, not one the stripper happens to recover with a
 * `-2` penalty. `уд` stays alongside `бпм` as a second way in — the numerator of
 * the abbreviation standing for the whole of it, by the same elision that lets
 * English "bpm" be typed for a tempo and `datarate`'s "мбит" for a rate — but
 * only `бпм` also comes back out.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [
        ...alias("bpm"),
        "бпм",
        "уд",
        "удар",
        "удара",
        "удары",
        "ударов",
        "ударах",
      ],
      symbol: "бпм",
    },
    hz: {
      aliases: [
        ...alias("hz"),
        "гц",
        "герц",
        "герца",
        "герцу",
        "герце",
        "герцем",
        "герцы",
        "герцев",
        "герцам",
        "герцах",
        "герцами",
      ],
      symbol: "Гц",
      forms: {
        "nom-one": "герц",
        "nom-few": "герца",
        "nom-many": "герц",
        "nom-other": "герца",
        "loc-one": "герце",
        "loc-few": "герцах",
        "loc-many": "герцах",
        "loc-other": "герцах",
      },
    },
  },
});
