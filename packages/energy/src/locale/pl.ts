import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

/**
 * Derived aliases this vocabulary must not register **in Polish**, and the one
 * entry is the calorie's international symbol.
 *
 * "cal" is the ordinary Polish noun for the *inch*, and
 * `@smartput/length/locale/pl` both lists it and **prints** it: it is that
 * unit's `nom-one` row, so `formatValue` writes "1 cal" on the default word
 * path, not merely under `symbols: true`. `buildRegistry`'s alias index is one
 * flat map with no kind in the key, so a calorie entry for "cal" beside it gives
 * the surface two readings of equal score, and the solver does what it is
 * supposed to do with a tie: `createEngine({ kinds: BUILTIN_KINDS, locales: [pl]
 * })` threw `AmbiguityError: "1 cal" is ambiguous between energy:cal, length:in`
 * on the length vocabulary's own output. A printer that cannot read what it just
 * wrote is the failure `assertLocaleContract`'s printable check exists for, and
 * that check misses this one because it asks only whether the surface *reaches*
 * the unit, never whether it reaches it alone.
 *
 * The collision is real Polish rather than a wiring accident, so one of the two
 * has to give, and it is this one. The inch cannot: "cal" is the correct
 * nominative singular and dropping it would leave `length:in` printing a form it
 * does not read, which is the very thing being fixed. The calorie can, because
 * Polish has an ordinary word for it — the `kaloria` paradigm below, which
 * nothing else claims — and because "cal" is a laboratory abbreviation where the
 * inch is everyday speech: a Polish reader who types "500 cal" means inches, and
 * one who means energy writes "500 kcal", which does not collide with anything.
 *
 * The cost, stated rather than hidden: `alias("cal")` no longer contributes the
 * international symbol, so a Polish engine reads "cal" as a length. The English
 * spellings `calorie`/`calories` are derived and stay, and every Polish form
 * stays, so nothing a Polish sentence contains is lost. `symbol` moves to the
 * spelled nominative singular for the same reason `@smartput/length/locale/pl`
 * spells `cal`/`stopa`/`jard`/`mila` out: R8 wants an explicit symbol, and the
 * conventional one is not available to this unit in this language.
 *
 * An engine that installs `en` beside `pl` is a different question and is not
 * fixable here — English lists "cal" for the calorie and Polish must list it for
 * the inch, so the two languages genuinely disagree about one surface and
 * `EngineOptions.weights` is where a bilingual caller settles it. What this file
 * can do is keep a *monolingual* Polish engine from being ambiguous against
 * itself, which is what it now does.
 */
const RESERVED = new Set(["cal"]);

const alias = (unit: EnergyUnit) =>
  aliasesFor(ENERGY_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Polish words for the energy units.
 *
 * Same shape as `en.ts` next door, same kind named by **id string** rather than
 * imported, and the same explicit `symbol` on every unit (ruling R8). What is
 * different is the size of a `forms` table: English answers `selectForm` on one
 * axis and needs two entries, while `polish.selectForm` answers on two —
 * `` `${case}-${category}` `` — and needs eight.
 *
 * The four `nom-*` rows are the numeral agreement Polish requires after a bare
 * count, and three of them are worth naming:
 *
 *   `nom-few`   the 2/3/4 row      "2 dżule" — a real nominative **plural**,
 *                                  where Russian's same cell holds a genitive
 *                                  singular ("2 килоджоуля"). In Polish it
 *                                  therefore stands apart from the fractional
 *                                  row rather than coinciding with it.
 *   `nom-many`  the 5+ row         "5 dżuli" — and it reaches **21**. Polish
 *                                  counts "dwadzieścia jeden dżuli" by the
 *                                  genitive plural where Ukrainian and Russian
 *                                  agree 21 with the singular. Every -1 above
 *                                  twenty goes that way, so a table ported from
 *                                  either Slavic neighbour prints a nominative
 *                                  singular at 21, 31 and 101.
 *   `nom-other` the fractional row "1,5 dżula" — a genitive **singular**, and
 *                                  the one cell no integer count can reach.
 *                                  Writing a plural here prints "1,5 dżuli",
 *                                  which is a real Polish word in a cell that
 *                                  wants a different real Polish word, so
 *                                  nothing in this repo catches it on shape
 *                                  alone.
 *
 * The four `loc-*` rows are the locative case, because "w" governs it — "w 5
 * dżulach", never "w 5 dżuli" — and "w" is the word generation actually emits,
 * being the first this language declares under `in`. `loc-other` is the
 * countless conversion target ("1 kJ w dżulach"), the row the old
 * one-dimensional `display` table had no way to express. It is **not** the same
 * word as `nom-other`: that one is a genitive singular reached only by a
 * fraction, this one a locative plural reached only without a count at all.
 *
 * `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, then appends the Polish ones. Both are deliberate:
 * a Polish datasheet writes "2 kJ" and a Polish sentence writes "2 kilodżule",
 * and a vocabulary that reads only one of them makes the other a parse error.
 * The inflected forms are written out rather than left to `polish`'s suffix
 * stripper — the stripper is what the analyzer falls back *from*, at a `-2`
 * penalty, and every form listed here is one it never has to guess at.
 *
 * **The watt-hour family declares forms here, where `en.ts`, `de.ts` and `ru.ts`
 * all refuse them.** That is not a disagreement about the rule; it is the same
 * rule reaching a different answer because the Polish word is different. Those
 * three languages have no single token for the unit: English writes "watt hour"
 * as two words, Russian writes "киловатт-час" with a hyphen and prints "кВт·ч"
 * with an interpunct that lexes as multiplication. Polish fuses it into one
 * ordinary feminine noun — `watogodzina`, `kilowatogodzina`, `megawatogodzina`
 * — which is a run of letters, therefore one word token, therefore something the
 * lexer reads straight back. So the reason to omit `forms` is simply absent and
 * the words ship. The symbols stay the international `Wh`/`kWh`/`MWh`, which are
 * what a Polish electricity bill prints and which case-fold onto the derived
 * aliases, so a `symbols: true` print parses back too.
 *
 * **`cal` is a homograph of the Polish inch, and here the inch wins.** "cal"
 * means *inch* in ordinary Polish and `@smartput/length/locale/pl` prints it as
 * that unit's `nom-one`, so leaving the derived alias in place made a
 * monolingual Polish engine ambiguous against a word it writes itself. The
 * `RESERVED` set above is where that is settled and why; the Polish words below
 * are all built on `kaloria` and none of them goes anywhere near the inch's
 * paradigm.
 *
 * `btu` carries no `forms`, and in Polish that costs nothing visible. It is a
 * borrowed initialism Polish leaves invariant, so there would be nothing to
 * decline; and where `ru.ts` had to declare eight identical rows just to get a
 * space between the number and the label, `polish.renderQuantity` already spaces
 * the symbol branch (PN-EN ISO 80000), so "5 BTU" comes out right with no table
 * at all.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "energy",
  units: {
    // dżul — masculine, soft `l` stem. Genitive singular "dżula", nominative
    // plural "dżule", genitive plural "dżuli" (the soft -i, not the hard -ów
    // that `power`'s "wat" takes), locative singular "dżulu" (not the -e that
    // would soften the stem, because a soft stem has nothing left to soften).
    j: {
      aliases: [
        ...alias("j"),
        "dżul",
        "dżula",
        "dżulowi",
        "dżulu",
        "dżulem",
        "dżule",
        "dżuli",
        "dżulom",
        "dżulach",
        "dżulami",
      ],
      symbol: "J",
      forms: {
        "nom-one": "dżul",
        "nom-few": "dżule",
        "nom-many": "dżuli",
        "nom-other": "dżula",
        "loc-one": "dżulu",
        "loc-few": "dżulach",
        "loc-many": "dżulach",
        "loc-other": "dżulach",
      },
    },
    kj: {
      aliases: [
        ...alias("kj"),
        "kilodżul",
        "kilodżula",
        "kilodżulowi",
        "kilodżulu",
        "kilodżulem",
        "kilodżule",
        "kilodżuli",
        "kilodżulom",
        "kilodżulach",
        "kilodżulami",
      ],
      symbol: "kJ",
      forms: {
        "nom-one": "kilodżul",
        "nom-few": "kilodżule",
        "nom-many": "kilodżuli",
        "nom-other": "kilodżula",
        "loc-one": "kilodżulu",
        "loc-few": "kilodżulach",
        "loc-many": "kilodżulach",
        "loc-other": "kilodżulach",
      },
    },
    mj: {
      aliases: [
        ...alias("mj"),
        "megadżul",
        "megadżula",
        "megadżulowi",
        "megadżulu",
        "megadżulem",
        "megadżule",
        "megadżuli",
        "megadżulom",
        "megadżulach",
        "megadżulami",
      ],
      symbol: "MJ",
      forms: {
        "nom-one": "megadżul",
        "nom-few": "megadżule",
        "nom-many": "megadżuli",
        "nom-other": "megadżula",
        "loc-one": "megadżulu",
        "loc-few": "megadżulach",
        "loc-many": "megadżulach",
        "loc-other": "megadżulach",
      },
    },
    // The watt-hour family, fused into one feminine noun and therefore
    // declinable here. `watogodzina` follows `godzina` exactly — bare-stem
    // genitive plural ("5 watogodzin"), locative singular in -ie
    // ("w 1 watogodzinie") — so this group and `@smartput/duration`'s `h` share
    // a paradigm without sharing a single surface: no alias here is a prefix
    // boundary away from "godzina", so nothing folds the two kinds together.
    wh: {
      aliases: [
        ...alias("wh"),
        "watogodzina",
        "watogodziny",
        "watogodzinę",
        "watogodzinie",
        "watogodziną",
        "watogodzin",
        "watogodzinom",
        "watogodzinach",
        "watogodzinami",
      ],
      symbol: "Wh",
      forms: {
        "nom-one": "watogodzina",
        "nom-few": "watogodziny",
        "nom-many": "watogodzin",
        "nom-other": "watogodziny",
        "loc-one": "watogodzinie",
        "loc-few": "watogodzinach",
        "loc-many": "watogodzinach",
        "loc-other": "watogodzinach",
      },
    },
    kwh: {
      aliases: [
        ...alias("kwh"),
        "kilowatogodzina",
        "kilowatogodziny",
        "kilowatogodzinę",
        "kilowatogodzinie",
        "kilowatogodziną",
        "kilowatogodzin",
        "kilowatogodzinom",
        "kilowatogodzinach",
        "kilowatogodzinami",
      ],
      symbol: "kWh",
      forms: {
        "nom-one": "kilowatogodzina",
        "nom-few": "kilowatogodziny",
        "nom-many": "kilowatogodzin",
        "nom-other": "kilowatogodziny",
        "loc-one": "kilowatogodzinie",
        "loc-few": "kilowatogodzinach",
        "loc-many": "kilowatogodzinach",
        "loc-other": "kilowatogodzinach",
      },
    },
    mwh: {
      aliases: [
        ...alias("mwh"),
        "megawatogodzina",
        "megawatogodziny",
        "megawatogodzinę",
        "megawatogodzinie",
        "megawatogodziną",
        "megawatogodzin",
        "megawatogodzinom",
        "megawatogodzinach",
        "megawatogodzinami",
      ],
      symbol: "MWh",
      forms: {
        "nom-one": "megawatogodzina",
        "nom-few": "megawatogodziny",
        "nom-many": "megawatogodzin",
        "nom-other": "megawatogodziny",
        "loc-one": "megawatogodzinie",
        "loc-few": "megawatogodzinach",
        "loc-many": "megawatogodzinach",
        "loc-other": "megawatogodzinach",
      },
    },
    // kaloria — feminine in -ia, and the reason this file is worth reading
    // beside `power`'s: gender changes every row. Genitive singular, dative
    // singular, locative singular *and* genitive plural all land on "kalorii",
    // four grammatically distinct cells sharing one spelling, so "1,5 kalorii",
    // "5 kalorii" and "w 1 kalorii" are the same string for three different
    // reasons. Only `nom-few` stands out, with the -ie nominative plural
    // ("2 kalorie"). The genitive plural is *not* the bare stem a hard feminine
    // like `duration`'s "godzin" shows; an -ia noun keeps its -i.
    //
    // This is the unit `RESERVED` takes the international "cal" away from, so
    // `alias("cal")` contributes "calorie"/"calories" and nothing else, and the
    // `symbol` is the spelled nominative singular — the same answer
    // `@smartput/length/locale/pl` gives for the units Polish writes out.
    cal: {
      aliases: [
        ...alias("cal"),
        "kaloria",
        "kalorii",
        "kalorię",
        "kalorią",
        "kalorie",
        "kaloriom",
        "kaloriach",
        "kaloriami",
      ],
      symbol: "kaloria",
      forms: {
        "nom-one": "kaloria",
        "nom-few": "kalorie",
        "nom-many": "kalorii",
        "nom-other": "kalorii",
        "loc-one": "kalorii",
        "loc-few": "kaloriach",
        "loc-many": "kaloriach",
        "loc-other": "kaloriach",
      },
    },
    kcal: {
      aliases: [
        ...alias("kcal"),
        "kilokaloria",
        "kilokalorii",
        "kilokalorię",
        "kilokalorią",
        "kilokalorie",
        "kilokaloriom",
        "kilokaloriach",
        "kilokaloriami",
      ],
      symbol: "kcal",
      forms: {
        "nom-one": "kilokaloria",
        "nom-few": "kilokalorie",
        "nom-many": "kilokalorii",
        "nom-other": "kilokalorii",
        "loc-one": "kilokalorii",
        "loc-few": "kilokaloriach",
        "loc-many": "kilokaloriach",
        "loc-other": "kilokaloriach",
      },
    },
    // BTU is a borrowed initialism and Polish leaves those invariant — an
    // air-conditioner spec sheet in Polish prints "12 000 BTU" and declines
    // nothing — so there is no paradigm to write down. Unlike `ru.ts`, this file
    // does not declare eight identical rows to buy a space: `polish`'s own
    // `renderQuantity` spaces the symbol branch, so the symbol alone prints
    // "5 BTU". "BTU" case-folds onto the derived alias "btu", which is how the
    // printed symbol parses back.
    btu: { aliases: alias("btu"), symbol: "BTU" },
  },
});
