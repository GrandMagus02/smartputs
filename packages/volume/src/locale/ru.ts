import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Russian words for the volume units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Russian engine and
 * the micro path (`parseVolume`) cannot drift from it. The Cyrillic spellings
 * are appended, in every inflected form a reader is likely to type — a
 * vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, and the stripper is penalised (weight -2) precisely so an exact
 * entry here outranks anything it guesses. Every string this file *prints* is
 * therefore also a string it reads: the prepositional singulars ("литре",
 * "галлоне") are listed even though the `е` suffix rule would recover them,
 * because a word the printer emits should never come back through the penalised
 * path.
 *
 * **`m3` carries no `forms`, exactly as `en` carries none.** The reason is the
 * same in both languages: "кубических метров" is two words, `lex` builds a word
 * token out of a run of letters and so never hands a phrase to any analyzer, and
 * the printer's spelled path only ever emits a word the parser can read back. So
 * `m3` renders through its symbol instead, tight against the number (`3м³`). It
 * still *reads* the one-word colloquial "кубометр" in its cases, because that is
 * what a Russian types — reading a word and printing it are separate decisions,
 * and only the printing one is constrained by round-tripping.
 *
 * Eight `forms` keys on the other four, because `russian.selectForm` keys on
 * `` `${case}-${category}` ``: the case from the slot, the category from CLDR's
 * four. The key names are `uk`'s, `loc` standing for the case Russian grammar
 * calls the prepositional, and `@smartput/core/locale/ru` records that ruling.
 * Three rows deserve naming:
 *
 *   `nom-few`   the 2/3/4 row      "2 литра" — genitive SINGULAR. Ukrainian puts
 *                                  a nominative plural in this cell ("2 літри"),
 *                                  so the two languages group the four
 *                                  nominative rows differently and a stem-swap
 *                                  port of `uk.ts` is wrong here first.
 *   `nom-many`  the 5+/0/teens row "5 литров"  — genitive plural in -ов on a
 *                                  masculine stem, the bare stem on a feminine.
 *   `nom-other` the *fractional*   "1,5 литра" — genitive singular again. A
 *                                  plural here prints "1,5 литров", which no
 *                                  test in this repo would catch on shape alone.
 *   `loc-other` the count-free conversion target, "в литрах" — prepositional,
 *                                  which is what `в` governs ("в 5 литрах",
 *                                  never "в 5 литров").
 *
 * Gender splits the four declined units. `литр`, `миллилитр` and `галлон` are
 * masculine hard stems: genitive singular -а, genitive plural -ов, prepositional
 * singular -е. `пинта` is feminine in -а, so its genitive singular is "пинты",
 * its genitive plural is the *bare stem* "пинт" with no ending at all, and its
 * prepositional singular is "пинте" — which is why the four tables below are not
 * one table with the stem swapped.
 *
 * `галлон` is spelled with two `л`, unlike Ukrainian's single-`л` `галон`; the
 * one-letter difference is exactly the kind of thing a port carries across
 * unnoticed, so it is named here.
 *
 * `symbol` is Russian where Russian actually abbreviates (`л`, `мл`, `м³`, and
 * `гал` in technical writing) and the spelled nominative singular where it does
 * not: `пинта` has no Russian abbreviation, the same choice `en` makes for units
 * it writes out. R8 wants an explicit symbol on every unit, not an invented one.
 *
 * Like `en`, this file names `volume` by id string and never imports the kind,
 * which is what lets `@smartput/volume/locale/ru` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "volume",
  units: {
    l: {
      aliases: [
        ...alias("l"),
        "л",
        "литр",
        "литра",
        "литру",
        "литре",
        "литром",
        "литры",
        "литров",
        "литрам",
        "литрах",
        "литрами",
      ],
      symbol: "л",
      forms: {
        "nom-one": "литр",
        "nom-few": "литра",
        "nom-many": "литров",
        "nom-other": "литра",
        "loc-one": "литре",
        "loc-few": "литрах",
        "loc-many": "литрах",
        "loc-other": "литрах",
      },
    },
    ml: {
      aliases: [
        ...alias("ml"),
        "мл",
        "миллилитр",
        "миллилитра",
        "миллилитру",
        "миллилитре",
        "миллилитром",
        "миллилитры",
        "миллилитров",
        "миллилитрам",
        "миллилитрах",
        "миллилитрами",
      ],
      symbol: "мл",
      forms: {
        "nom-one": "миллилитр",
        "nom-few": "миллилитра",
        "nom-many": "миллилитров",
        "nom-other": "миллилитра",
        "loc-one": "миллилитре",
        "loc-few": "миллилитрах",
        "loc-many": "миллилитрах",
        "loc-other": "миллилитрах",
      },
    },
    // The digit-3 spellings are what a keyboard without a superscript produces,
    // and both scripts are listed because Russians type both. "кубометр" is the
    // one-word colloquial name and declines like any masculine hard stem, so its
    // cases are listed too — as aliases only, never as `forms`: the symbol is
    // what gets printed.
    m3: {
      aliases: [
        ...alias("m3"),
        "м3",
        "м³",
        "кубометр",
        "кубометра",
        "кубометру",
        "кубометре",
        "кубометром",
        "кубометры",
        "кубометров",
        "кубометрам",
        "кубометрах",
        "кубометрами",
      ],
      symbol: "м³",
    },
    gal: {
      aliases: [
        ...alias("gal"),
        "гал",
        "галлон",
        "галлона",
        "галлону",
        "галлоне",
        "галлоном",
        "галлоны",
        "галлонов",
        "галлонам",
        "галлонах",
        "галлонами",
      ],
      symbol: "гал",
      forms: {
        "nom-one": "галлон",
        "nom-few": "галлона",
        "nom-many": "галлонов",
        "nom-other": "галлона",
        "loc-one": "галлоне",
        "loc-few": "галлонах",
        "loc-many": "галлонах",
        "loc-other": "галлонах",
      },
    },
    // Feminine, so every ending differs from the three masculine units above.
    // The genitive plural is the bare stem — "5 пинт", no suffix — and the
    // fractional row is "1,5 пинты", the genitive singular, which is spelled
    // identically to the 2/3/4 row because in Russian that row *is* a genitive
    // singular; here the two cells agree for one reason rather than by accident.
    pint: {
      aliases: [
        ...alias("pint"),
        "пинта",
        "пинты",
        "пинте",
        "пинту",
        "пинтой",
        "пинт",
        "пинтам",
        "пинтах",
        "пинтами",
      ],
      symbol: "пинта",
      forms: {
        "nom-one": "пинта",
        "nom-few": "пинты",
        "nom-many": "пинт",
        "nom-other": "пинты",
        "loc-one": "пинте",
        "loc-few": "пинтах",
        "loc-many": "пинтах",
        "loc-other": "пинтах",
      },
    },
  },
});
