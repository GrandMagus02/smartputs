import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Polish words for the volume units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Polish engine and the
 * micro path (`parseVolume`) cannot drift from it. The Polish spellings are
 * appended, in every inflected form a reader is likely to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper is penalised (weight -2) precisely so an exact entry here
 * outranks anything it guesses. Every string this file *prints* is therefore
 * also a string it reads: "litrze" and "pincie" are listed because no suffix
 * rule recovers either of them — the r→rz and t→ć alternations leave stems
 * spelled differently from the ones the aliases are built on.
 *
 * **`m3` carries no `forms`, exactly as `en` carries none.** Polish calls it
 * "metr sześcienny", two words, and the printer's spelled path only ever emits a
 * word the parser can read back; `assertLocaleContract` refuses a printed
 * surface containing a space outright, because `lex` ends a word token there.
 * `m3` renders through its symbol instead — and in Polish that is a *spaced*
 * "3 m³", because `polish.renderQuantity` follows PN-EN ISO 80000 rather than
 * the default template's tight `3m³`. Nor does it gain a one-word colloquial
 * alias the way Ukrainian's "кубометр" does: the building-site "kubik" is a
 * different word for a different thing depending on trade, and inventing a
 * reading for it would be this file making up Polish rather than recording it.
 *
 * Eight `forms` keys on the other four, because `polish.selectForm` keys on
 * `` `${case}-${category}` ``: the case from the slot, the category from CLDR's
 * four. Three rows deserve naming:
 *
 *   `nom-few`   the 2/3/4 row      "2 litry" — nominative plural.
 *   `nom-many`  the 0/5-21/teens   "5 litrów" — genitive plural, and the row
 *                                  that reaches **21**. "21 litrów" in Polish
 *                                  against "21 літр" in Ukrainian: every -1
 *                                  above twenty parts the two languages, so a
 *                                  table ported from `uk.ts` prints a
 *                                  nominative singular there.
 *   `nom-other` the *fractional*   "1,5 litra" — genitive **singular**, not a
 *                                  plural at all. Writing a plural here prints
 *                                  "1,5 litrów", which no test in this repo
 *                                  would catch on shape alone.
 *   `loc-other` the count-free conversion target, "w litrach" — locative
 *                                  plural, which is what `w` governs ("w 5
 *                                  litrach", never "w 5 litrów"), and a
 *                                  different word from `nom-other` above.
 *
 * Gender splits the four declined units. `litr`, `mililitr` and `galon` are
 * masculine hard stems: genitive singular in -a (the fractional row), nominative
 * plural in -y, genitive plural in -ów. `pinta` is feminine, so its genitive
 * singular is "pinty" — spelled like its nominative plural, and identical for a
 * different reason — its genitive plural is the **bare stem** "pint" with no
 * ending at all, and its locative singular takes t→ć and comes out "pincie".
 * Nothing can strip its way to a bare-stem genitive plural, which is why that
 * form has to appear in the alias list rather than being left to the analyzer.
 *
 * `symbol` is Polish where Polish actually abbreviates (`l`, `ml`, `m³`, and
 * `gal` in technical writing, all of them spelled exactly as in English) and the
 * spelled nominative singular where it does not: `pinta` has no Polish
 * abbreviation, the same choice `en` makes for units it writes out. R8 wants an
 * explicit symbol on every unit, not an invented one.
 *
 * Like `en`, this file names `volume` by id string and never imports the kind,
 * which is what lets `@smartput/volume/locale/pl` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "volume",
  units: {
    l: {
      aliases: [
        ...alias("l"),
        "litr",
        "litra",
        "litrowi",
        "litrze",
        "litrem",
        "litry",
        "litrów",
        "litrom",
        "litrach",
        "litrami",
      ],
      symbol: "l",
      forms: {
        "nom-one": "litr",
        "nom-few": "litry",
        "nom-many": "litrów",
        "nom-other": "litra",
        "loc-one": "litrze",
        "loc-few": "litrach",
        "loc-many": "litrach",
        "loc-other": "litrach",
      },
    },
    ml: {
      aliases: [
        ...alias("ml"),
        "mililitr",
        "mililitra",
        "mililitrowi",
        "mililitrze",
        "mililitrem",
        "mililitry",
        "mililitrów",
        "mililitrom",
        "mililitrach",
        "mililitrami",
      ],
      symbol: "ml",
      forms: {
        "nom-one": "mililitr",
        "nom-few": "mililitry",
        "nom-many": "mililitrów",
        "nom-other": "mililitra",
        "loc-one": "mililitrze",
        "loc-few": "mililitrach",
        "loc-many": "mililitrach",
        "loc-other": "mililitrach",
      },
    },
    // No Polish aliases to append: "m3" and "m³" are written with the same
    // characters everywhere, so `units.ts`'s pair is already the Polish pair.
    m3: { aliases: alias("m3"), symbol: "m³" },
    // Masculine, but with an -n stem rather than an -r one, so its locative
    // singular is "galonie" and not the r→rz "litrze" three units up.
    gal: {
      aliases: [
        ...alias("gal"),
        "galon",
        "galona",
        "galonowi",
        "galonie",
        "galonem",
        "galony",
        "galonów",
        "galonom",
        "galonach",
        "galonami",
      ],
      symbol: "gal",
      forms: {
        "nom-one": "galon",
        "nom-few": "galony",
        "nom-many": "galonów",
        "nom-other": "galona",
        "loc-one": "galonie",
        "loc-few": "galonach",
        "loc-many": "galonach",
        "loc-other": "galonach",
      },
    },
    // Feminine, so every ending differs from the three masculine units above.
    // The genitive plural is the bare stem — "5 pint", no suffix — the
    // fractional row is "1,5 pinty" (genitive singular, spelled like the 2/3/4
    // row and identical for a different reason), and the locative singular takes
    // t→ć: "w 1 pincie".
    pint: {
      aliases: [
        ...alias("pint"),
        "pinta",
        "pinty",
        "pincie",
        "pintę",
        "pintą",
        // The bare-stem genitive plural is already in `alias("pint")` — it is
        // the unit key, spelled exactly like the Polish form — so it is not
        // repeated here. That coincidence is why "5 pint" reads at all.
        "pintom",
        "pintach",
        "pintami",
      ],
      symbol: "pinta",
      forms: {
        "nom-one": "pinta",
        "nom-few": "pinty",
        "nom-many": "pint",
        "nom-other": "pinty",
        "loc-one": "pincie",
        "loc-few": "pintach",
        "loc-many": "pintach",
        "loc-other": "pintach",
      },
    },
  },
});
