import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Ukrainian words for the energy units.
 *
 * Same shape as `en.ts` next door, same kind named by **id string** rather than
 * imported, and the same explicit `symbol` on every unit (ruling R8). What is
 * different is the size of a `forms` table: English needs two entries and
 * Ukrainian needs eight, because `ukrainian.selectForm` answers on two axes —
 * `` `${case}-${category}` `` — where English answers on one.
 *
 * The four `nom-*` rows are the ordinary numeral agreement Ukrainian requires
 * after a bare count, and the one that is easy to get wrong is `nom-other`:
 * that category is the *fractional* one, and it takes the genitive **singular**
 * ("1,5 кілоджоуля"), not any plural. The four `loc-*` rows are the locative,
 * because "в"/"у" governs it — "в 5 кілоджоулях", never "в 5 кілоджоулів" — and
 * `loc-other` is the countless conversion target ("1 кДж в джоулях"), the row
 * the old one-dimensional `display` table had no way to express.
 *
 * `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, then appends the Cyrillic ones. Both scripts are
 * deliberate: a Ukrainian keyboard writes "2 кДж" and a Ukrainian datasheet
 * writes "2 kJ", and a vocabulary that reads only one of them makes the other a
 * parse error. The inflected forms are written out rather than left to
 * `ukrainian`'s suffix stripper — the stripper is what the analyzer falls back
 * *from*, and every form listed here is one it never has to guess at.
 *
 * Three units carry no `forms` at all, matching the call `en.ts` makes for the
 * same three: the watt-hour family is written as a symbol ("кВт·год") and its
 * spelled-out compound ("кіловат-година") is hyphenated, so it cannot lex as
 * one unit token in either language. Absent `forms` keeps the formatter on the
 * symbol instead of printing a word that will not read back.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "energy",
  units: {
    // джоуль — masculine, soft stem. Locative singular is "у джоулі", which is
    // also the nominative plural; one alias covers both readings.
    j: {
      aliases: [
        ...alias("j"),
        "Дж",
        "джоуль",
        "джоуля",
        "джоулю",
        "джоулі",
        "джоулем",
        "джоулів",
        "джоулям",
        "джоулями",
        "джоулях",
      ],
      symbol: "Дж",
      forms: {
        "nom-one": "джоуль",
        "nom-few": "джоулі",
        "nom-many": "джоулів",
        "nom-other": "джоуля",
        "loc-one": "джоулі",
        "loc-few": "джоулях",
        "loc-many": "джоулях",
        "loc-other": "джоулях",
      },
    },
    kj: {
      aliases: [
        ...alias("kj"),
        "кДж",
        "кілоджоуль",
        "кілоджоуля",
        "кілоджоулю",
        "кілоджоулі",
        "кілоджоулем",
        "кілоджоулів",
        "кілоджоулям",
        "кілоджоулями",
        "кілоджоулях",
      ],
      symbol: "кДж",
      forms: {
        "nom-one": "кілоджоуль",
        "nom-few": "кілоджоулі",
        "nom-many": "кілоджоулів",
        "nom-other": "кілоджоуля",
        "loc-one": "кілоджоулі",
        "loc-few": "кілоджоулях",
        "loc-many": "кілоджоулях",
        "loc-other": "кілоджоулях",
      },
    },
    mj: {
      aliases: [
        ...alias("mj"),
        "МДж",
        "мегаджоуль",
        "мегаджоуля",
        "мегаджоулю",
        "мегаджоулі",
        "мегаджоулем",
        "мегаджоулів",
        "мегаджоулям",
        "мегаджоулями",
        "мегаджоулях",
      ],
      symbol: "МДж",
      forms: {
        "nom-one": "мегаджоуль",
        "nom-few": "мегаджоулі",
        "nom-many": "мегаджоулів",
        "nom-other": "мегаджоуля",
        "loc-one": "мегаджоулі",
        "loc-few": "мегаджоулях",
        "loc-many": "мегаджоулях",
        "loc-other": "мегаджоулях",
      },
    },
    // The Ukrainian symbol for the watt-hour family is "Вт·год" — the interpunct
    // is the standard multiplication sign between a unit of power and a unit of
    // time, not decoration. It is listed as an alias so the printed symbol is a
    // registered spelling of the unit it came from, but `parse/lex.ts` builds a
    // unit word out of letters plus trailing digits, so "·" ends the token and
    // "5 кВт·год" reaches the resolver as "кВт" followed by "год" — neither of
    // which is an alias. The Latin "kwh" is the spelling that reads back today;
    // splitting the Cyrillic compound is P5's `compoundSplitter`, not this file's
    // job, and inventing a run-together "кВтгод" to work around it would put a
    // spelling nobody writes into the vocabulary.
    wh: { aliases: [...alias("wh"), "Вт·год"], symbol: "Вт·год" },
    kwh: { aliases: [...alias("kwh"), "кВт·год"], symbol: "кВт·год" },
    mwh: { aliases: [...alias("mwh"), "МВт·год"], symbol: "МВт·год" },
    // калорія — feminine, and the reason this file is worth reading beside
    // `mass`'s: gender changes every row. Genitive singular and nominative
    // plural are both "калорії", so `nom-few` (2 калорії) and `nom-other`
    // (1,5 калорії) coincide here where the masculine джоуль keeps them apart
    // ("2 джоулі" against "1,5 джоуля"). Genitive plural loses the ending
    // entirely: "5 калорій".
    cal: {
      aliases: [
        ...alias("cal"),
        "кал",
        "калорія",
        "калорії",
        "калорію",
        "калорією",
        "калорій",
        "калоріям",
        "калоріями",
        "калоріях",
      ],
      symbol: "кал",
      forms: {
        "nom-one": "калорія",
        "nom-few": "калорії",
        "nom-many": "калорій",
        "nom-other": "калорії",
        "loc-one": "калорії",
        "loc-few": "калоріях",
        "loc-many": "калоріях",
        "loc-other": "калоріях",
      },
    },
    kcal: {
      aliases: [
        ...alias("kcal"),
        "ккал",
        "кілокалорія",
        "кілокалорії",
        "кілокалорію",
        "кілокалорією",
        "кілокалорій",
        "кілокалоріям",
        "кілокалоріями",
        "кілокалоріях",
      ],
      symbol: "ккал",
      forms: {
        "nom-one": "кілокалорія",
        "nom-few": "кілокалорії",
        "nom-many": "кілокалорій",
        "nom-other": "кілокалорії",
        "loc-one": "кілокалорії",
        "loc-few": "кілокалоріях",
        "loc-many": "кілокалоріях",
        "loc-other": "кілокалоріях",
      },
    },
    // BTU keeps its Latin spelling and does not decline: it is a borrowed
    // abbreviation, and Ukrainian leaves those invariant ("у 5 BTU"), so all
    // eight keys carry the same string. That is not a placeholder for a
    // translation still to come — it is the answer. The `forms` table is here
    // rather than omitted because it is what puts a space between the number
    // and the label ("5 BTU"); the symbol branch sets them tight.
    //
    // No Cyrillic alias. The Ukrainian expansion is "британська теплова
    // одиниця", and the abbreviation for it is not settled — "БТО" and the
    // Russian-borrowed "БТЕ" both appear — so no initialism is registered
    // rather than one guessed at.
    btu: {
      aliases: alias("btu"),
      symbol: "BTU",
      forms: {
        "nom-one": "BTU",
        "nom-few": "BTU",
        "nom-many": "BTU",
        "nom-other": "BTU",
        "loc-one": "BTU",
        "loc-few": "BTU",
        "loc-many": "BTU",
        "loc-other": "BTU",
      },
    },
  },
});
