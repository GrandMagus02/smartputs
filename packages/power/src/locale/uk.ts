import { aliasesFor, defineVocabulary } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Ukrainian words for the power units — the same five units `en.ts` names, the
 * same kind named by **id string** rather than imported, and the same explicit
 * `symbol` on every unit (ruling R8). What differs is the size of a `forms`
 * table: English answers `selectForm` on one axis and needs two entries, while
 * `ukrainian.selectForm` answers on two — `` `${case}-${category}` `` — and
 * needs eight.
 *
 * The four `nom-*` rows are the numeral agreement Ukrainian requires after a
 * bare count, and `nom-other` is the row worth naming twice: that category is
 * the *fractional* one, and it takes the genitive **singular** ("1,5 кіловата"),
 * not a plural. Writing a plural there prints "1,5 кіловатів", which reads wrong
 * to a native speaker and which nothing in this repo would catch on shape alone.
 * The four `loc-*` rows are the locative, because "в"/"у" governs it — "в 5
 * кіловатах", never "в 5 кіловатів" — and `loc-other` is the count-free
 * conversion target ("1 кВт у ватах"), the row the old one-dimensional `display`
 * table had no way to express at all.
 *
 * Four of the five units are one word: `ват` and its SI prefixes are masculine
 * hard stems, so they decline identically and only the stem changes — genitive
 * singular in -а, nominative plural in -и, genitive plural in -ів, locative
 * singular in -і, locative plural in -ах. Writing them out four times rather
 * than generating them from a stem is deliberate: the next unit added here may
 * not be a hard-stem masculine, and a generator would quietly inflect it wrong.
 *
 * `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * instead of retyping them, then appends the Cyrillic ones. Both scripts are
 * deliberate: a Ukrainian keyboard writes "2 кВт" and a Ukrainian datasheet
 * writes "2 kW", and a vocabulary that reads only one of them turns the other
 * into a parse error. The inflected spellings are listed rather than left to
 * `ukrainian`'s suffix stripper — the stripper is what the analyzer falls back
 * *from*, and every form written here is one it never has to guess at.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "power",
  units: {
    // "вата" is also the ordinary Ukrainian word for cotton wool. Inside one
    // kind that is not an ambiguity — nothing else in `power` claims it — and
    // dropping the genitive singular of the canonical unit to avoid a homonym
    // would cost the reading of "1,5 вата", which is the form the fractional row
    // prints.
    w: {
      aliases: [
        ...alias("w"),
        "Вт",
        "ват",
        "вата",
        "вату",
        "ваті",
        "вати",
        "ватів",
        "ватам",
        "ватах",
        "ватом",
        "ватами",
      ],
      symbol: "Вт",
      forms: {
        "nom-one": "ват",
        "nom-few": "вати",
        "nom-many": "ватів",
        "nom-other": "вата",
        "loc-one": "ваті",
        "loc-few": "ватах",
        "loc-many": "ватах",
        "loc-other": "ватах",
      },
    },
    kw: {
      aliases: [
        ...alias("kw"),
        "кВт",
        "кіловат",
        "кіловата",
        "кіловату",
        "кіловаті",
        "кіловати",
        "кіловатів",
        "кіловатам",
        "кіловатах",
        "кіловатом",
        "кіловатами",
      ],
      symbol: "кВт",
      forms: {
        "nom-one": "кіловат",
        "nom-few": "кіловати",
        "nom-many": "кіловатів",
        "nom-other": "кіловата",
        "loc-one": "кіловаті",
        "loc-few": "кіловатах",
        "loc-many": "кіловатах",
        "loc-other": "кіловатах",
      },
    },
    // The megawatt, matching `units.ts`: the milliwatt has no spelling in this
    // kind in either language, and "МВт" folds to the same key as "мвт" the way
    // "MW" folds to "mw".
    mw: {
      aliases: [
        ...alias("mw"),
        "МВт",
        "мегават",
        "мегавата",
        "мегавату",
        "мегаваті",
        "мегавати",
        "мегаватів",
        "мегаватам",
        "мегаватах",
        "мегаватом",
        "мегаватами",
      ],
      symbol: "МВт",
      forms: {
        "nom-one": "мегават",
        "nom-few": "мегавати",
        "nom-many": "мегаватів",
        "nom-other": "мегавата",
        "loc-one": "мегаваті",
        "loc-few": "мегаватах",
        "loc-many": "мегаватах",
        "loc-other": "мегаватах",
      },
    },
    gw: {
      aliases: [
        ...alias("gw"),
        "ГВт",
        "гігават",
        "гігавата",
        "гігавату",
        "гігаваті",
        "гігавати",
        "гігаватів",
        "гігаватам",
        "гігаватах",
        "гігаватом",
        "гігаватами",
      ],
      symbol: "ГВт",
      forms: {
        "nom-one": "гігават",
        "nom-few": "гігавати",
        "nom-many": "гігаватів",
        "nom-other": "гігавата",
        "loc-one": "гігаваті",
        "loc-few": "гігаватах",
        "loc-many": "гігаватах",
        "loc-other": "гігаватах",
      },
    },
    // The unit this row exists for. English says "horsepower", one word and its
    // own plural; Ukrainian says "кінська сила" — an adjective agreeing with a
    // feminine noun, so *both* words inflect, and the whole phrase moves to the
    // genitive plural after 5 ("5 кінських сил") and to the genitive singular in
    // the fractional row ("1,5 кінської сили").
    //
    // The phrase can be *printed* but not *read*: `parse/lex.ts` builds a word
    // token out of a run of letters (plus trailing digits), so a space ends the
    // token and "2 кінські сили" reaches the resolver as "кінські" followed by
    // "сили" — a two-token unit no alias can claim. The same is true of the real
    // Ukrainian abbreviation, "к.с.", whose periods are skipped as unrecognized
    // characters and which therefore arrives as "к" then "с". Neither is
    // registered as an alias: an alias the lexer cannot produce is dead weight
    // that reads as coverage, and `uk.test.ts` records the gap as a live
    // assertion instead. Multi-token unit words are P5's `compoundSplitter`;
    // inventing a run-together "кінськасила" or "кс" to work around it would put
    // a spelling nobody writes into the vocabulary.
    //
    // So `aliases` here is the Latin pair from `units.ts` and nothing else, and
    // `symbol` is "к.с." — the abbreviation Ukrainian actually uses — which R8
    // wants recorded even though the eight `forms` rows mean the formatter never
    // reaches for it.
    hp: {
      aliases: alias("hp"),
      symbol: "к.с.",
      forms: {
        "nom-one": "кінська сила",
        "nom-few": "кінські сили",
        "nom-many": "кінських сил",
        "nom-other": "кінської сили",
        "loc-one": "кінській силі",
        "loc-few": "кінських силах",
        "loc-many": "кінських силах",
        "loc-other": "кінських силах",
      },
    },
  },
});
