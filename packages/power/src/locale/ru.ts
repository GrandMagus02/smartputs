import { aliasesFor, defineVocabulary } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Russian words for the power units — the same five units `en.ts` names, the
 * same kind named by **id string** rather than imported, and the same explicit
 * `symbol` on every unit (ruling R8). What differs is the size of a `forms`
 * table: English answers `selectForm` on one axis and needs two entries, while
 * `russian.selectForm` answers on two — `` `${case}-${category}` `` — and needs
 * eight.
 *
 * **The genitive plural of `ватт` is `ватт`.** This is the row that makes the
 * kind worth reading. Units named after people — ватт, ампер, вольт, герц — take
 * a zero-ending counting form (счётная форма) after a numeral, so "5 ватт" is
 * the norm and "5 ваттов" is not. `nom-one` and `nom-many` are therefore the
 * same string, which looks like a table with a hole in it and is not: "1 ватт"
 * and "5 ватт" really are spelled alike. `mass` next door makes the opposite
 * call for exactly the same-looking cell — there the bare "5 килограмм" is the
 * colloquialism and "5 килограммов" is the written norm — which is why neither
 * file can be generated from the other by an ending table.
 *
 * The rest of the paradigm is the ordinary masculine hard stem: genitive
 * singular in -а ("2 ватта", and the fractional "1,5 ватта" with it),
 * prepositional singular in -е ("в 1 ватте"), prepositional plural in -ах ("в 5
 * ваттах"). `nom-few` is a genitive **singular** and not a nominative plural,
 * which is where Russian parts company with Ukrainian's "2 вати"; in Russian it
 * therefore coincides with the fractional row instead of standing apart from it.
 *
 * The four `loc-*` rows are the prepositional case, because "в" governs it, and
 * `loc-other` is the count-free conversion target ("1 кВт в ваттах") — the row
 * the old one-dimensional `display` table had no way to express at all. The
 * label is `loc` rather than the accurate Russian `prep` by a deliberate
 * borrowing from `uk`, so the two Slavic vocabularies stay portable one into the
 * other; `@smartput/core/locale/ru` records the reasoning.
 *
 * Four of the five units carry that table. `ватт` and its SI prefixes decline
 * identically and only the stem changes; writing them out four times rather than
 * generating them from a stem is deliberate, because the next unit added here
 * may not be a hard-stem masculine and a generator would quietly inflect it
 * wrong. The fifth, `hp`, carries no `forms` at all and renders through its
 * symbol; the entry below says why.
 *
 * `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * instead of retyping them, then appends the Cyrillic ones. Both scripts are
 * deliberate: a Russian keyboard writes "2 кВт" and a Russian datasheet writes
 * "2 kW", and a vocabulary that reads only one of them turns the other into a
 * parse error. The inflected spellings are listed rather than left to `russian`'s
 * suffix stripper — the stripper is what the analyzer falls back *from*, at a
 * `-2` penalty, and every form written here is one it never has to guess at.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "power",
  units: {
    w: {
      // "ваттов" is listed and never printed. It is the genitive plural a
      // speaker reaches for when the noun is not being counted ("сумма
      // ваттов"), and it is what a reader who has not read Rosenthal will type
      // after a numeral too. Recognition is many-to-one (I6); only generation
      // has to pick, and it picks the counting form above.
      aliases: [
        ...alias("w"),
        "Вт",
        "ватт",
        "ватта",
        "ватту",
        "ватте",
        "ваттом",
        "ватты",
        "ваттов",
        "ваттам",
        "ваттах",
        "ваттами",
      ],
      symbol: "Вт",
      forms: {
        "nom-one": "ватт",
        "nom-few": "ватта",
        "nom-many": "ватт",
        "nom-other": "ватта",
        "loc-one": "ватте",
        "loc-few": "ваттах",
        "loc-many": "ваттах",
        "loc-other": "ваттах",
      },
    },
    kw: {
      aliases: [
        ...alias("kw"),
        "кВт",
        "киловатт",
        "киловатта",
        "киловатту",
        "киловатте",
        "киловаттом",
        "киловатты",
        "киловаттов",
        "киловаттам",
        "киловаттах",
        "киловаттами",
      ],
      symbol: "кВт",
      forms: {
        "nom-one": "киловатт",
        "nom-few": "киловатта",
        "nom-many": "киловатт",
        "nom-other": "киловатта",
        "loc-one": "киловатте",
        "loc-few": "киловаттах",
        "loc-many": "киловаттах",
        "loc-other": "киловаттах",
      },
    },
    // The megawatt, matching `units.ts`: the milliwatt has no spelling in this
    // kind in either language, and "МВт" folds to the same key as "мвт" the way
    // "MW" folds to "mw".
    mw: {
      aliases: [
        ...alias("mw"),
        "МВт",
        "мегаватт",
        "мегаватта",
        "мегаватту",
        "мегаватте",
        "мегаваттом",
        "мегаватты",
        "мегаваттов",
        "мегаваттам",
        "мегаваттах",
        "мегаваттами",
      ],
      symbol: "МВт",
      forms: {
        "nom-one": "мегаватт",
        "nom-few": "мегаватта",
        "nom-many": "мегаватт",
        "nom-other": "мегаватта",
        "loc-one": "мегаватте",
        "loc-few": "мегаваттах",
        "loc-many": "мегаваттах",
        "loc-other": "мегаваттах",
      },
    },
    gw: {
      aliases: [
        ...alias("gw"),
        "ГВт",
        "гигаватт",
        "гигаватта",
        "гигаватту",
        "гигаватте",
        "гигаваттом",
        "гигаватты",
        "гигаваттов",
        "гигаваттам",
        "гигаваттах",
        "гигаваттами",
      ],
      symbol: "ГВт",
      forms: {
        "nom-one": "гигаватт",
        "nom-few": "гигаватта",
        "nom-many": "гигаватт",
        "nom-other": "гигаватта",
        "loc-one": "гигаватте",
        "loc-few": "гигаваттах",
        "loc-many": "гигаваттах",
        "loc-other": "гигаваттах",
      },
    },
    // **No `forms`, and the symbol is "лс".** This is the one unit in the kind
    // Russian abbreviates rather than declines, and the reason is the lexer
    // rather than an opinion about Russian.
    //
    // Russian says "лошадиная сила" — an adjective agreeing with a feminine
    // noun, so *both* words inflect ("5 лошадиных сил", "1,5 лошадиной силы").
    // Every one of those eight rows prints beautifully and none of them can be
    // read back: `parse/lex.ts` builds a word token from a run of letters plus
    // trailing digits, so a space ends the token and "2 лошадиные силы" reaches
    // the resolver as "лошадиные" then "силы" — a two-token unit no alias can
    // claim. Registering the first word does not rescue it either; the stranded
    // "силы" turns the whole input into a parse failure. `uk.ts` shipped that
    // table, measured it and removed it, and this file does not re-introduce it.
    //
    // "л.с." is the abbreviation Russian actually writes, and it is *not* the
    // symbol for the same lexer reason one step down: "." is not a letter, so it
    // is skipped as an unrecognized character and "150 л.с." arrives as "л" then
    // "с" — and "с" is already the second. So the symbol is the dotless
    // contraction "лс": one letter run, one token, listed in `aliases` so the
    // round trip closes.
    //
    // What that gives up is real: "150 hp" prints "150лс", tight against the
    // number the way `area`'s "3м²" does, instead of the fully inflected phrase.
    // That is the same trade `area` and `temperature` already make, and it is
    // the right way round — a unit whose written form is an abbreviation
    // legitimately has no word forms, while a unit whose printed words cannot be
    // read is just broken output.
    hp: {
      aliases: [...alias("hp"), "лс"],
      symbol: "лс",
    },
  },
});
