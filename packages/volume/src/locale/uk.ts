import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Ukrainian words for the volume units — the same five units `en` next door
 * names, and the same per-unit decision about whether a unit has words at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Ukrainian engine and
 * the micro path (`parseVolume`) cannot drift from it. The Cyrillic spellings
 * are appended, in every inflected form a reader is likely to type — a
 * vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, and the stripper is penalised (weight -2) precisely so an exact
 * entry here outranks anything it guesses. Every string this file *prints* is
 * therefore also a string it reads: the locative singulars ("літрі", "галоні")
 * are listed even though the `і` suffix rule would recover them, because a word
 * the printer emits should never come back through the penalised path.
 *
 * **`m3` carries no `forms`, exactly as `en` carries none.** The reason is the
 * same in both languages: "кубічних метрів" is two words, and the printer's
 * spelled path only ever emits a word the parser can read back, so a form here
 * would hand completion text that fails to evaluate. `m3` renders through its
 * symbol instead, tight against the number (`3м³`). It still *reads* the
 * one-word colloquial "кубометр" in its cases, because that is what a Ukrainian
 * types — reading a word and printing it are separate decisions, and only the
 * printing one is constrained by round-tripping.
 *
 * Eight `forms` keys on the other four, because `ukrainian.selectForm` keys on
 * `` `${case}-${category}` ``: the case from the slot, the category from CLDR's
 * four. Three rows deserve naming:
 *
 *   `nom-few`   the 2/3/4 row      "2 літри"
 *   `nom-many`  the 5+/0/teens row "5 літрів"  — genitive plural
 *   `nom-other` the *fractional*   "1,5 літра" — genitive **singular**, not a
 *                                  plural at all. Writing a plural here prints
 *                                  "1,5 літрів", which no test in this repo
 *                                  would catch on shape alone.
 *   `loc-other` the count-free conversion target, "в літрах" — locative, which
 *                                  is what `в` governs ("в 5 літрах", never
 *                                  "в 5 літрів").
 *
 * Gender splits the four declined units. `літр`, `мілілітр` and `галон` are
 * masculine hard stems: genitive singular in -а (the fractional row), genitive
 * plural in -ів, locative singular in -і. `пінта` is feminine in -а, so its
 * genitive singular is "пінти", its genitive plural is the *bare stem* "пінт"
 * with no suffix at all, and its locative singular is "пінті" — which is why
 * the four tables below are not one table with the stem swapped.
 *
 * `symbol` is Ukrainian where Ukrainian actually abbreviates (`л`, `мл`, `м³`,
 * and `гал` in technical writing) and the spelled nominative singular where it
 * does not: `пінта` has no Ukrainian abbreviation, the same choice `en` makes
 * for units it writes out. R8 wants an explicit symbol on every unit, not an
 * invented one.
 *
 * Like `en`, this file names `volume` by id string and never imports the kind,
 * which is what lets `@smartput/volume/locale/uk` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "volume",
  units: {
    l: {
      aliases: [
        ...alias("l"),
        "л",
        "літр",
        "літра",
        "літру",
        "літрі",
        "літри",
        "літрів",
        "літрам",
        "літрах",
        "літром",
        "літрами",
      ],
      symbol: "л",
      forms: {
        "nom-one": "літр",
        "nom-few": "літри",
        "nom-many": "літрів",
        "nom-other": "літра",
        "loc-one": "літрі",
        "loc-few": "літрах",
        "loc-many": "літрах",
        "loc-other": "літрах",
      },
    },
    ml: {
      aliases: [
        ...alias("ml"),
        "мл",
        "мілілітр",
        "мілілітра",
        "мілілітру",
        "мілілітрі",
        "мілілітри",
        "мілілітрів",
        "мілілітрам",
        "мілілітрах",
        "мілілітром",
        "мілілітрами",
      ],
      symbol: "мл",
      forms: {
        "nom-one": "мілілітр",
        "nom-few": "мілілітри",
        "nom-many": "мілілітрів",
        "nom-other": "мілілітра",
        "loc-one": "мілілітрі",
        "loc-few": "мілілітрах",
        "loc-many": "мілілітрах",
        "loc-other": "мілілітрах",
      },
    },
    // The digit-3 spellings are what a keyboard without a superscript produces,
    // and both scripts are listed because Ukrainians type both. "кубометр" is
    // the one-word colloquial name and declines like any masculine hard stem,
    // so its cases are listed too — as aliases only, never as `forms`: the
    // symbol is what gets printed.
    m3: {
      aliases: [
        ...alias("m3"),
        "м3",
        "м³",
        "кубометр",
        "кубометра",
        "кубометру",
        "кубометрі",
        "кубометри",
        "кубометрів",
        "кубометрам",
        "кубометрах",
        "кубометром",
        "кубометрами",
      ],
      symbol: "м³",
    },
    gal: {
      aliases: [
        ...alias("gal"),
        "гал",
        "галон",
        "галона",
        "галону",
        "галоні",
        "галони",
        "галонів",
        "галонам",
        "галонах",
        "галоном",
        "галонами",
      ],
      symbol: "гал",
      forms: {
        "nom-one": "галон",
        "nom-few": "галони",
        "nom-many": "галонів",
        "nom-other": "галона",
        "loc-one": "галоні",
        "loc-few": "галонах",
        "loc-many": "галонах",
        "loc-other": "галонах",
      },
    },
    // Feminine, so every ending differs from the three masculine units above.
    // The genitive plural is the bare stem — "5 пінт", no suffix — and the
    // fractional row is "1,5 пінти", the genitive singular, which is spelled
    // identically to the 2/3/4 row and identical for a different reason.
    pint: {
      aliases: [
        ...alias("pint"),
        "пінта",
        "пінти",
        "пінті",
        "пінту",
        "пінтою",
        "пінт",
        "пінтам",
        "пінтах",
        "пінтами",
      ],
      symbol: "пінта",
      forms: {
        "nom-one": "пінта",
        "nom-few": "пінти",
        "nom-many": "пінт",
        "nom-other": "пінти",
        "loc-one": "пінті",
        "loc-few": "пінтах",
        "loc-many": "пінтах",
        "loc-other": "пінтах",
      },
    },
  },
});
