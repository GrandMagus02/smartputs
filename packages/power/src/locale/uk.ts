import { aliasesFor, defineVocabulary } from "@smartput/kind";
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
 * Four of the five units carry that table. `ват` and its SI prefixes are
 * masculine hard stems, so they decline identically and only the stem changes —
 * genitive singular in -а, nominative plural in -и, genitive plural in -ів,
 * locative singular in -і, locative plural in -ах. Writing them out four times
 * rather than generating them from a stem is deliberate: the next unit added
 * here may not be a hard-stem masculine, and a generator would quietly inflect
 * it wrong. The fifth, `hp`, carries no `forms` at all and renders through its
 * symbol; the entry below says why at length, and `uk.test.ts` holds the
 * invariant that caught it — every string any `forms` table here can print is
 * also a string this file's `aliases` can read.
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
    // **No `forms`, and the symbol is "кс".** This is the one unit in the kind
    // Ukrainian abbreviates rather than declines, and it took a measurement to
    // admit it.
    //
    // Ukrainian says "кінська сила" — an adjective agreeing with a feminine
    // noun, so *both* words inflect ("5 кінських сил", "1,5 кінської сили").
    // An earlier version of this file wrote all eight of those rows out and
    // shipped them. They print beautifully and none of them can be read back:
    // `parse/lex.ts` builds a word token from a run of letters plus trailing
    // digits, so a space ends the token and "2 кінські сили" reaches the
    // resolver as "кінські" then "сили" — a two-token unit no alias can claim.
    // Registering the first word does not rescue it either; that was tried and
    // measured, and the stranded "сили" turns the whole input into `Cannot
    // parse "2 кінські сили" as a quantity`. So every string that table emitted
    // was one the engine could not read, which is precisely the property §9
    // asks a locale to have, and the table is gone rather than annotated.
    //
    // "к.с." is the abbreviation Ukrainian actually writes, and it is *not* the
    // symbol for the same lexer reason one step down: "." is not a letter, so
    // it is skipped as an unrecognized character and "150 к.с." arrives as "к"
    // then "с" — measured, `Unknown unit "к"`. A symbol the printer emits and
    // the lexer cannot return is the bug this entry just removed, so the symbol
    // is the dotless contraction "кс": one letter run, one token, and listed in
    // `aliases` so the round trip closes. It is the one Cyrillic spelling of
    // this unit a Ukrainian can type today, and before this it had none at all
    // — `aliases` was the Latin pair and nothing else.
    //
    // What that gives up is real: `150 hp` now prints "150кс", tight against
    // the number the way `area`'s "3м²" and `temperature`'s "20°C" do, instead
    // of the fully inflected phrase. That is the same trade those two kinds
    // already make, and it is the right way round — a unit whose written form
    // is an abbreviation legitimately has no word forms, while a unit whose
    // printed words cannot be read is just broken output. When P5's
    // `compoundSplitter` can route two tokens back to one unit, the phrase can
    // come back as `forms` *and* as aliases together; until then it is not
    // ready and pretending otherwise cost this kind its round trip.
    hp: {
      aliases: [...alias("hp"), "кс"],
      symbol: "кс",
    },
  },
});
