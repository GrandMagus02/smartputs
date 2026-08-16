import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { POWER_UNITS, type PowerUnit } from "../units";

/**
 * Aliases the engine's lexer can never hand back as a word **in Polish**.
 *
 * "w" is the watt's SI symbol and it is also this language's conversion
 * preposition — `@smartput/core/locale/pl` lists it first under `keywords.in`,
 * because the locative `selectForm` chooses is the case that one word governs.
 * `lex` emits a keyword token for it, so a vocabulary entry for "w" is
 * unreachable on the engine path: "500 w" parses as five hundred *converted
 * into* nothing and fails, and no alias index can rescue it.
 *
 * This is English `length:in` exactly — core's conversion keyword colliding with
 * a unit's conventional abbreviation — and it is handled the same way, by
 * filtering the derived alias rather than by leaving a dead entry in the index.
 * The entry would not merely be dead: `MatchCtx.isUnitAlias` reads
 * `registry.aliasIndex` directly, and `@smartput/datetime`'s accept-gate refuses
 * any phrase whose words are *all* unit aliases, so registering "w" would make
 * "w 3 dni" look like an all-units phrase and kill a date literal in a package
 * this one has never heard of.
 *
 * `units.ts` keeps "w" regardless, and must: the micro path has no keyword
 * grammar, so `formatPower(v, "w")` → `"5w"` still parses back there. The
 * registry's R2 pass knows about omissions like this one too — a kind some
 * language has spoken for is indexed by its vocabulary's aliases alone, never by
 * its unit keys, precisely so a deliberate gap is not filled back in.
 *
 * The consequence, stated rather than hidden: a Polish engine cannot read
 * "5 W", and `pl.test.ts` names `power:w` in `skipPrintable` for it. Nothing
 * printed by `formatValue` is affected — this unit declares `forms`, so it
 * writes "5 watów" — and the loss is confined to a `symbols: true` print. The
 * words are the way in: "5 wat", "5 watów" and the derived "5 watt" all read.
 */
const RESERVED = new Set(["w"]);

const alias = (unit: PowerUnit) =>
  aliasesFor(POWER_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Polish words for the power units — the same five units `en.ts` names, the same
 * kind named by **id string** rather than imported, and the same explicit
 * `symbol` on every unit (ruling R8). What differs is the size of a `forms`
 * table: English answers `selectForm` on one axis and needs two entries, while
 * `polish.selectForm` answers on two — `` `${case}-${category}` `` — and needs
 * eight.
 *
 * **The genitive plural of `wat` is `watów`, with the ending on.** This is the
 * row that makes the kind worth reading beside its Slavic neighbours. Russian
 * and Ukrainian give units named after people a zero-ending counting form —
 * "5 ватт", "5 ват", no suffix at all — and Polish does not have that rule:
 * "5 watów", the ordinary masculine genitive plural, exactly as for any other
 * hard-stem noun. So `nom-one` and `nom-many` are *different* strings here where
 * `ru.ts` has them identical, and a Polish table transliterated from `ru.ts`
 * prints "5 wat", which is not a Polish word.
 *
 * The rest of the paradigm is the ordinary masculine hard stem, and two rows are
 * still worth naming:
 *
 *   `nom-few`   "2 waty"  — a real nominative **plural**, where Russian's same
 *                           cell holds a genitive singular. It therefore stands
 *                           apart from the fractional row rather than coinciding
 *                           with it.
 *   `nom-other` "1,5 wata" — the fractional row, a genitive **singular**, and
 *                           the one cell no integer count can reach. CLDR's name
 *                           for the category sounds like a plural, which is why
 *                           it gets written as one.
 *
 * `nom-many` also **reaches 21**: Polish says "dwadzieścia jeden watów" where
 * both Slavic neighbours agree 21 with the singular, and every -1 above twenty
 * goes the same way. `polish.selectForm` records the boundary; this table is
 * keyed against it and `pl.test.ts` pins it.
 *
 * The four `loc-*` rows are the locative, because "w" governs it, and `loc-one`
 * is the row nothing could have guessed: the stem-final `t` softens to `ci`
 * before the locative -e, so "wacie" shares no suffix boundary with "wat" and no
 * ending table could have produced it. It is listed as an alias for that reason.
 * `loc-other` is the count-free conversion target ("1 kW w watach") — the row
 * the old one-dimensional `display` table had no way to express at all — and it
 * is not the same word as `nom-other`, which is only ever reached with a
 * fraction in hand.
 *
 * Four of the five units carry that table. `wat` and its SI prefixes decline
 * identically and only the stem changes; writing them out four times rather than
 * generating them from a stem is deliberate, because the next unit added here
 * may not be a hard-stem masculine and a generator would quietly inflect it
 * wrong. The fifth, `hp`, carries no `forms` at all and renders through its
 * symbol; the entry below says why, and it is the one place this file
 * deliberately declines to write Polish.
 *
 * **One derived alias is filtered out, and it is the base unit's own symbol.**
 * "w" is a keyword in Polish, so the lexer never hands it over as a word; the
 * `RESERVED` set above says what that costs and why leaving the entry in the
 * index would cost more. It is the only such collision across this language's
 * keyword table and these five units.
 *
 * `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * instead of retyping them, then appends the Polish ones. Both are deliberate: a
 * Polish datasheet writes "2 kW" and a Polish sentence writes "2 kilowaty", and
 * a vocabulary that reads only one of them turns the other into a parse error.
 * The inflected spellings are listed rather than left to `polish`'s suffix
 * stripper — the stripper is what the analyzer falls back *from*, at a `-2`
 * penalty, and every form written here is one it never has to guess at.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "power",
  units: {
    w: {
      aliases: [
        ...alias("w"),
        "wat",
        "wata",
        "watowi",
        "wacie",
        "watem",
        "waty",
        "watów",
        "watom",
        "watach",
        "watami",
      ],
      symbol: "W",
      forms: {
        "nom-one": "wat",
        "nom-few": "waty",
        "nom-many": "watów",
        "nom-other": "wata",
        "loc-one": "wacie",
        "loc-few": "watach",
        "loc-many": "watach",
        "loc-other": "watach",
      },
    },
    kw: {
      aliases: [
        ...alias("kw"),
        "kilowat",
        "kilowata",
        "kilowatowi",
        "kilowacie",
        "kilowatem",
        "kilowaty",
        "kilowatów",
        "kilowatom",
        "kilowatach",
        "kilowatami",
      ],
      symbol: "kW",
      forms: {
        "nom-one": "kilowat",
        "nom-few": "kilowaty",
        "nom-many": "kilowatów",
        "nom-other": "kilowata",
        "loc-one": "kilowacie",
        "loc-few": "kilowatach",
        "loc-many": "kilowatach",
        "loc-other": "kilowatach",
      },
    },
    // The megawatt, matching `units.ts`: the milliwatt has no spelling in this
    // kind in any language, and "MW" folds to the same key as "mw".
    mw: {
      aliases: [
        ...alias("mw"),
        "megawat",
        "megawata",
        "megawatowi",
        "megawacie",
        "megawatem",
        "megawaty",
        "megawatów",
        "megawatom",
        "megawatach",
        "megawatami",
      ],
      symbol: "MW",
      forms: {
        "nom-one": "megawat",
        "nom-few": "megawaty",
        "nom-many": "megawatów",
        "nom-other": "megawata",
        "loc-one": "megawacie",
        "loc-few": "megawatach",
        "loc-many": "megawatach",
        "loc-other": "megawatach",
      },
    },
    gw: {
      aliases: [
        ...alias("gw"),
        "gigawat",
        "gigawata",
        "gigawatowi",
        "gigawacie",
        "gigawatem",
        "gigawaty",
        "gigawatów",
        "gigawatom",
        "gigawatach",
        "gigawatami",
      ],
      symbol: "GW",
      forms: {
        "nom-one": "gigawat",
        "nom-few": "gigawaty",
        "nom-many": "gigawatów",
        "nom-other": "gigawata",
        "loc-one": "gigawacie",
        "loc-few": "gigawatach",
        "loc-many": "gigawatach",
        "loc-other": "gigawatach",
      },
    },
    // **No `forms`, no Polish alias, and the symbol stays the Latin "hp".** This
    // is the one unit in the kind where writing Polish would break something,
    // and the something is not this package.
    //
    // Polish says "koń mechaniczny" — an adjective agreeing with a masculine
    // noun, so *both* words inflect ("5 koni mechanicznych", "1,5 konia
    // mechanicznego"). Every one of those eight rows prints beautifully and none
    // of them can be read back: `parse/lex.ts` builds a word token from a run of
    // letters plus trailing digits, so a space ends the token and "5 koni
    // mechanicznych" reaches the resolver as two words no alias can claim.
    // Registering only the head does not rescue it either; the stranded
    // "mechanicznych" turns the whole input into a parse failure. `uk.ts` shipped
    // that table for its own "кінська сила", measured it and removed it.
    //
    // **The abbreviation is worse, and this is the interesting half.** Polish
    // writes "KM", and "KM" case-folds to "km" — which is the kilometre.
    // `buildRegistry`'s alias index is one flat map with no kind in the key, so
    // registering it here would give "5 km" a second reading in any engine that
    // installs `@smartput/length` beside this one, which is exactly what the
    // `@smartput/kinds` barrel does. That collision would not stay inside this
    // package, and it would land on the commoner of the two readings by far. It
    // is the same reasoning `@smartput/speed`'s Slavic vocabularies give for
    // leaving "километров"/"kilometrów" to `length`: a vocabulary may not claim
    // a surface another kind already owns. So "KM" is refused outright rather
    // than demoted to an alias, since an alias is precisely what would collide.
    //
    // What is left is the Latin "hp", which `units.ts` already declares, which
    // Polish technical writing does use beside "KM", and which collides with
    // nothing. The cost is stated rather than hidden: a Polish reader who types
    // "150 KM" gets 150 kilometres, and there is no spelling of horsepower in
    // this file they can reach in their own language. That is the lesser of the
    // two harms, and it is the kind of thing R8 means by "never invent one".
    hp: { aliases: alias("hp"), symbol: "hp" },
  },
});
