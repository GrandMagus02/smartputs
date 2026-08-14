import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Russian words for the energy units.
 *
 * Same shape as `en.ts` next door, same kind named by **id string** rather than
 * imported, and the same explicit `symbol` on every unit (ruling R8). What is
 * different is the size of a `forms` table: English answers `selectForm` on one
 * axis and needs two entries, while `russian.selectForm` answers on two —
 * `` `${case}-${category}` `` — and needs eight.
 *
 * The four `nom-*` rows are the numeral agreement Russian requires after a bare
 * count, and two of them are worth naming:
 *
 *   `nom-few`   the 2/3/4 row      "2 килоджоуля" — a genitive **singular**,
 *                                  where Ukrainian's same cell is a nominative
 *                                  plural ("2 кілоджоулі"). In Russian it
 *                                  therefore coincides with the fractional row
 *                                  rather than standing apart from it.
 *   `nom-other` the fractional row "1,5 килоджоуля" — genitive singular again.
 *                                  Writing a plural here prints
 *                                  "1,5 килоджоулей", which is a real Russian
 *                                  word in a cell that wants a different real
 *                                  Russian word, so nothing in this repo catches
 *                                  it on shape alone.
 *
 * The four `loc-*` rows are the prepositional case, because "в" governs it —
 * "в 5 килоджоулях", never "в 5 килоджоулей" — and `loc-other` is the countless
 * conversion target ("1 кДж в джоулях"), the row the old one-dimensional
 * `display` table had no way to express. The label is `loc` and not the
 * accurate Russian `prep` by a deliberate borrowing from `uk`, so the two
 * Slavic vocabularies stay portable one into the other;
 * `@smartput/core/locale/ru` records the reasoning.
 *
 * `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, then appends the Cyrillic ones. Both scripts are
 * deliberate: a Russian keyboard writes "2 кДж" and a Russian datasheet writes
 * "2 kJ", and a vocabulary that reads only one of them makes the other a parse
 * error. The inflected forms are written out rather than left to `russian`'s
 * suffix stripper — the stripper is what the analyzer falls back *from*, at a
 * `-2` penalty, and every form listed here is one it never has to guess at.
 *
 * Three units carry no `forms` at all, matching the call `en.ts` makes for the
 * same three: the watt-hour family is written as a symbol ("кВт·ч") and its
 * spelled-out compound ("киловатт-час") is hyphenated, so it cannot lex as one
 * unit token in either language. Absent `forms` keeps the formatter on the
 * symbol instead of printing a word that will not read back.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "energy",
  units: {
    // джоуль — masculine, soft stem. Genitive singular "джоуля", genitive plural
    // "джоулей" (soft -ей, not the hard -ов that `power`'s "ватт" family would
    // take if it took an ending at all), prepositional singular "джоуле".
    j: {
      aliases: [
        ...alias("j"),
        "Дж",
        "джоуль",
        "джоуля",
        "джоулю",
        "джоуле",
        "джоулем",
        "джоули",
        "джоулей",
        "джоулям",
        "джоулях",
        "джоулями",
      ],
      symbol: "Дж",
      forms: {
        "nom-one": "джоуль",
        "nom-few": "джоуля",
        "nom-many": "джоулей",
        "nom-other": "джоуля",
        "loc-one": "джоуле",
        "loc-few": "джоулях",
        "loc-many": "джоулях",
        "loc-other": "джоулях",
      },
    },
    kj: {
      aliases: [
        ...alias("kj"),
        "кДж",
        "килоджоуль",
        "килоджоуля",
        "килоджоулю",
        "килоджоуле",
        "килоджоулем",
        "килоджоули",
        "килоджоулей",
        "килоджоулям",
        "килоджоулях",
        "килоджоулями",
      ],
      symbol: "кДж",
      forms: {
        "nom-one": "килоджоуль",
        "nom-few": "килоджоуля",
        "nom-many": "килоджоулей",
        "nom-other": "килоджоуля",
        "loc-one": "килоджоуле",
        "loc-few": "килоджоулях",
        "loc-many": "килоджоулях",
        "loc-other": "килоджоулях",
      },
    },
    mj: {
      aliases: [
        ...alias("mj"),
        "МДж",
        "мегаджоуль",
        "мегаджоуля",
        "мегаджоулю",
        "мегаджоуле",
        "мегаджоулем",
        "мегаджоули",
        "мегаджоулей",
        "мегаджоулям",
        "мегаджоулях",
        "мегаджоулями",
      ],
      symbol: "МДж",
      forms: {
        "nom-one": "мегаджоуль",
        "nom-few": "мегаджоуля",
        "nom-many": "мегаджоулей",
        "nom-other": "мегаджоуля",
        "loc-one": "мегаджоуле",
        "loc-few": "мегаджоулях",
        "loc-many": "мегаджоулях",
        "loc-other": "мегаджоулях",
      },
    },
    // The Russian symbol for the watt-hour family is "Вт·ч" — the interpunct is
    // the standard multiplication sign between a unit of power and a unit of
    // time, not decoration, and `parse/lex.ts` reads U+00B7 as a spelling of
    // `*`. So "5 кВт·ч" reaches the resolver as "кВт", `*`, "ч", and this kind's
    // own `* | power | duration` signature multiplies kilowatts by hours into
    // joules — the route English's "m/s" has always taken, where the symbol is
    // likewise no alias and re-reads as arithmetic. It needs both operands
    // registered, which is why `ru.test.ts` proves it on an engine wired with
    // `@smartput/power` and `@smartput/duration` rather than on this kind alone.
    //
    // The interpunct spellings stay listed anyway, as documentation of what the
    // printer emits rather than as a working alias: "·" ends a word token, so no
    // alias containing one can ever match. Inventing a run-together "кВтч" to
    // make one match would put a spelling nobody writes into the vocabulary.
    wh: { aliases: [...alias("wh"), "Вт·ч"], symbol: "Вт·ч" },
    kwh: { aliases: [...alias("kwh"), "кВт·ч"], symbol: "кВт·ч" },
    mwh: { aliases: [...alias("mwh"), "МВт·ч"], symbol: "МВт·ч" },
    // калория — feminine in -ия, and the reason this file is worth reading
    // beside `power`'s: gender changes every row. Genitive singular, dative
    // singular and prepositional singular all land on "калории", three
    // grammatically distinct cells sharing one spelling, so "1,5 калории" and
    // "в 1 калории" are the same string for different reasons. The genitive
    // plural is the soft "калорий" — an -ия noun's ending, not the bare stem a
    // hard feminine like `mass`'s "тонн" would show.
    cal: {
      aliases: [
        ...alias("cal"),
        "кал",
        "калория",
        "калории",
        "калорию",
        "калорией",
        "калорий",
        "калориям",
        "калориях",
        "калориями",
      ],
      symbol: "кал",
      forms: {
        "nom-one": "калория",
        "nom-few": "калории",
        "nom-many": "калорий",
        "nom-other": "калории",
        "loc-one": "калории",
        "loc-few": "калориях",
        "loc-many": "калориях",
        "loc-other": "калориях",
      },
    },
    kcal: {
      aliases: [
        ...alias("kcal"),
        "ккал",
        "килокалория",
        "килокалории",
        "килокалорию",
        "килокалорией",
        "килокалорий",
        "килокалориям",
        "килокалориях",
        "килокалориями",
      ],
      symbol: "ккал",
      forms: {
        "nom-one": "килокалория",
        "nom-few": "килокалории",
        "nom-many": "килокалорий",
        "nom-other": "килокалории",
        "loc-one": "килокалории",
        "loc-few": "килокалориях",
        "loc-many": "килокалориях",
        "loc-other": "килокалориях",
      },
    },
    // BTU is a borrowed initialism and Russian leaves those invariant, so all
    // eight keys carry one string. That is the answer rather than a placeholder
    // for a translation still to come: there is nothing to decline. The `forms`
    // table is here rather than omitted because it is what puts a space between
    // the number and the label ("5 БТЕ"); the symbol branch sets them tight.
    //
    // Where this departs from `uk.ts` is in printing Cyrillic at all. Ukrainian
    // has no settled abbreviation — "БТО" and "БТЕ" both appear — so that file
    // registers none and prints the Latin "BTU". Russian does have one: "БТЕ",
    // for "британская тепловая единица", is what an air-conditioner spec sheet
    // in Russian writes, and R8 asks for the language's own abbreviation
    // wherever the language actually abbreviates. The Latin spellings stay
    // readable through `alias("btu")`, so a datasheet pasted in still parses;
    // only the printed side moves.
    btu: {
      aliases: [...alias("btu"), "БТЕ"],
      symbol: "БТЕ",
      forms: {
        "nom-one": "БТЕ",
        "nom-few": "БТЕ",
        "nom-many": "БТЕ",
        "nom-other": "БТЕ",
        "loc-one": "БТЕ",
        "loc-few": "БТЕ",
        "loc-many": "БТЕ",
        "loc-other": "БТЕ",
      },
    },
  },
});
