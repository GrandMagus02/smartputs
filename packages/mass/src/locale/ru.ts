import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Russian words for the mass units — the same six units `en` next door names,
 * and the same per-unit decision: all six are nouns a Russian speaker writes
 * out, so all six carry `forms`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Russian engine and
 * the micro path (`parseMass`) cannot drift from it. The Cyrillic spellings are
 * appended, in every inflected form a reader is likely to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper is penalised (weight -2) precisely so an exact entry here
 * outranks anything it guesses. Every string this file *prints* is therefore
 * also a string it reads: the prepositional singulars ("килограмме", "грамме")
 * are listed even though the `е` suffix rule would recover them, because a word
 * the printer emits should never come back through the penalised path.
 *
 * Eight `forms` keys per unit, not two, because `russian.selectForm` keys on
 * `` `${case}-${category}` ``: the case from the slot, the category from CLDR's
 * four. The key set is `uk`'s by deliberate borrowing — the case Russian grammar
 * calls the *prepositional* is labelled `loc` here so the two Slavic
 * vocabularies stay portable one into the other; `@smartput/core/locale/ru` says
 * so at length. Three rows deserve naming:
 *
 *   `nom-few`   the 2/3/4 row      "2 килограмма" — genitive SINGULAR, where
 *                                  Ukrainian's same row is a nominative plural
 *                                  ("2 кілограми"). The two languages differ on
 *                                  what this cell even is, which is why porting
 *                                  `uk.ts` by swapping stems produces Russian
 *                                  that is wrong in a way that still looks
 *                                  Slavic.
 *   `nom-many`  the 5+/0/teens row "5 килограммов" — genitive plural, `-ов` on a
 *                                  masculine hard stem and the BARE STEM on a
 *                                  feminine ("5 тонн", no ending at all).
 *   `nom-other` the *fractional*   "1,5 килограмма" — genitive **singular**, not
 *                                  a plural. Writing a plural here prints
 *                                  "1,5 килограммов", which no test in this repo
 *                                  would catch on shape alone: it is a real
 *                                  Russian word in a cell that wants a different
 *                                  real Russian word.
 *   `loc-other` the count-free conversion target, "в граммах" — prepositional,
 *                                  which is what `в` governs ("в 5 килограммах",
 *                                  never "в 5 килограммов").
 *
 * Gender drives the endings, and this kind happens to carry both. `мг`/`г`/`кг`
 * and `фунт` are masculine hard stems: genitive singular in -а, genitive plural
 * in -ов, prepositional singular in -е. `тонна` is feminine hard: genitive
 * singular "тонны", genitive plural the bare stem "тонн", prepositional singular
 * "тонне". `унция` is feminine in -ия, the one paradigm where three
 * grammatically distinct cells collapse onto one spelling — genitive singular,
 * dative singular and prepositional singular are all "унции" — and whose
 * genitive plural is "унций". That is why the six tables below are not one table
 * with the stem swapped.
 *
 * The -ов plurals are the written norm and are what this file prints. The
 * colloquial zero-ending genitive plural — "5 килограмм", "5 грамм", heard
 * constantly and accepted by nobody's style guide — needs no entry of its own,
 * because it is spelled exactly like the nominative singular that is already an
 * alias. So a reader who types it is understood while the printer stays
 * literate, which is the ordinary asymmetry: recognition is many-to-one and only
 * generation has to pick.
 *
 * `symbol` is Russian where Russian actually abbreviates (`мг`, `г`, `кг`, `т`)
 * and the spelled nominative singular where it does not: `унция` and `фунт` have
 * no accepted Russian abbreviation, which is the same choice `en` makes for
 * units it writes out. R8 wants an explicit symbol on every unit, not an
 * invented one.
 *
 * Like `en`, this file names `mass` by id string and never imports the kind,
 * which is what lets `@smartput/mass/locale/ru` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "mass",
  units: {
    mg: {
      aliases: [
        ...alias("mg"),
        "мг",
        "миллиграмм",
        "миллиграмма",
        "миллиграмму",
        "миллиграмме",
        "миллиграммом",
        "миллиграммы",
        "миллиграммов",
        "миллиграммам",
        "миллиграммах",
        "миллиграммами",
      ],
      symbol: "мг",
      forms: {
        "nom-one": "миллиграмм",
        "nom-few": "миллиграмма",
        "nom-many": "миллиграммов",
        "nom-other": "миллиграмма",
        "loc-one": "миллиграмме",
        "loc-few": "миллиграммах",
        "loc-many": "миллиграммах",
        "loc-other": "миллиграммах",
      },
    },
    g: {
      aliases: [
        ...alias("g"),
        "г",
        "грамм",
        "грамма",
        "грамму",
        "грамме",
        "граммом",
        "граммы",
        "граммов",
        "граммам",
        "граммах",
        "граммами",
      ],
      symbol: "г",
      forms: {
        "nom-one": "грамм",
        "nom-few": "грамма",
        "nom-many": "граммов",
        "nom-other": "грамма",
        "loc-one": "грамме",
        "loc-few": "граммах",
        "loc-many": "граммах",
        "loc-other": "граммах",
      },
    },
    kg: {
      // "кило" is the colloquial clipping, indeclinable in Russian, and it is
      // listed for the same reason `units.ts` lists "kilo": people type it.
      aliases: [
        ...alias("kg"),
        "кг",
        "кило",
        "килограмм",
        "килограмма",
        "килограмму",
        "килограмме",
        "килограммом",
        "килограммы",
        "килограммов",
        "килограммам",
        "килограммах",
        "килограммами",
      ],
      symbol: "кг",
      forms: {
        "nom-one": "килограмм",
        "nom-few": "килограмма",
        "nom-many": "килограммов",
        "nom-other": "килограмма",
        "loc-one": "килограмме",
        "loc-few": "килограммах",
        "loc-many": "килограммах",
        "loc-other": "килограммах",
      },
    },
    // Feminine hard stem, so every ending differs from the three grams above.
    // The genitive plural is the bare stem — "5 тонн", no suffix — and the
    // fractional row is "1,5 тонны", the genitive singular, which is spelled
    // identically to the 2/3/4 row and identical for a different reason: there
    // the ending is genitive singular after a small numeral, here it is genitive
    // singular after a fraction.
    t: {
      aliases: [
        ...alias("t"),
        "т",
        "тонна",
        "тонны",
        "тонне",
        "тонну",
        "тонной",
        "тонн",
        "тоннам",
        "тоннах",
        "тоннами",
      ],
      symbol: "т",
      forms: {
        "nom-one": "тонна",
        "nom-few": "тонны",
        "nom-many": "тонн",
        "nom-other": "тонны",
        "loc-one": "тонне",
        "loc-few": "тоннах",
        "loc-many": "тоннах",
        "loc-other": "тоннах",
      },
    },
    // Feminine in -ия, the paradigm where the genitive singular, the dative
    // singular and the prepositional singular all land on "унции" — three
    // grammatically distinct cells sharing one spelling, so "1,5 унции" and
    // "в 1 унции" are the same string for different reasons. The genitive plural
    // is "унций", not a bare stem: the soft -ий ending is what an -ия noun takes.
    oz: {
      aliases: [
        ...alias("oz"),
        "унция",
        "унции",
        "унцию",
        "унцией",
        "унций",
        "унциям",
        "унциях",
        "унциями",
      ],
      symbol: "унция",
      forms: {
        "nom-one": "унция",
        "nom-few": "унции",
        "nom-many": "унций",
        "nom-other": "унции",
        "loc-one": "унции",
        "loc-few": "унциях",
        "loc-many": "унциях",
        "loc-other": "унциях",
      },
    },
    lb: {
      aliases: [
        ...alias("lb"),
        "фунт",
        "фунта",
        "фунту",
        "фунте",
        "фунтом",
        "фунты",
        "фунтов",
        "фунтам",
        "фунтах",
        "фунтами",
      ],
      symbol: "фунт",
      forms: {
        "nom-one": "фунт",
        "nom-few": "фунта",
        "nom-many": "фунтов",
        "nom-other": "фунта",
        "loc-one": "фунте",
        "loc-few": "фунтах",
        "loc-many": "фунтах",
        "loc-other": "фунтах",
      },
    },
  },
});
