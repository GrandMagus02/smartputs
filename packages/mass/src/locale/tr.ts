import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Turkish words for the mass units — the same six `en`, `uk` and `de` name, and
 * all six have a Turkish word.
 *
 * **One `forms` key per unit, keyed `other`, and that is the entire grammar of
 * this file.** `turkish.selectForm` is the constant `() => "other"`, because
 * Turkish does not agree a noun with the number in front of it: "1 kilogram",
 * "5 kilogram", "1,5 kilogram" — the noun is bare every time, and "5
 * kilogramlar" is not a plural but a mistake. `Intl.PluralRules("tr")` does
 * declare `one` and `other` (CLDR describes the language, not this engine's
 * question), and `@smartput/core/locale/tr` records at length why routing
 * through it was rejected: two rows that must always hold the same string hide a
 * typo in the row that only fires at count 1. So rule 6's "exactly the keys
 * `selectForm` can produce" is one row per unit here, where
 * `@smartput/mass/locale/de` needs four cells for the dative "in Kilogramm" and
 * `uk` needs eight.
 *
 * **Everything is lowercase, and that is a decision about the dotted i.**
 * Turkish capitalises no common noun, so the string this table prints is exactly
 * the string the alias index holds and no `de`-style fold is needed on either
 * side of rule 5. That matters more here than the one sentence suggests:
 * `buildRegistry` folds every alias key with `toLocaleLowerCase("tr")`, under
 * which `I` becomes `ı` rather than `i`, so an alias written with a capital
 * would be indexed under a *different letter* than the one a reader typed. A
 * lowercase table cannot get that wrong. The reader who types "KİLOGRAM" or the
 * ASCII "KILOGRAM" is served by `turkish.analyze`'s `caseFolds`, which is the
 * language's business and not this file's.
 *
 * **Behind these aliases there is a suffix stripper, and it is a fallback and
 * not a substitute.** Turkish is agglutinative, so a unit noun in running text
 * carries a case ending chosen by vowel harmony — "kilograma", "kilogramda",
 * "gramdan" — and `@smartput/core/locale/tr` enumerates every harmonic variant
 * because a flat stripper cannot express the rule. That list recovers what this
 * file did not think to list, at a −2 penalty; a form this file *prints* must
 * still be one of its own aliases, which is rule 5 and is what `tr.test.ts`
 * asserts verbatim.
 *
 * **`ons` is claimed, with the gold market stated rather than hidden.** TDK's
 * headword for `ons` is the avoirdupois ounce this kind's `oz` is — 28,35 g —
 * which is the whole difference from `@smartput/mass/locale/id`, where the same
 * inherited word means one hectogram and had to be refused for a 3,5× error.
 * The residual Turkish ambiguity is much smaller and lives in one register:
 * "ons altın" in the financial press is the *troy* ounce, 31,1035 g, about 10 %
 * away. This kind declares no troy ounce for that reading to resolve to, and
 * the everyday and dictionary reading is the one claimed — the same trade
 * `@smartput/mass/locale/nl` records for `pond`.
 *
 * **`libre` is the pound, and it carries the same kind of residue.** It is the
 * standard Turkish rendering of the imperial pound (a boxing weight class, an
 * imported sack), and TDK also records an older Ottoman reckoning of roughly
 * 500 g. That sense survives in historical prose rather than in anything typed
 * at a converter, this kind has no 500 g unit either way, and the modern
 * reading is what is claimed.
 *
 * **Turkish spelling is not English spelling, on one unit.** A milligram is
 * `miligram` with a single `l` — Turkish simplifies the doubled consonants of
 * its European loans — where `units.ts` declares the English `milligram`. Both
 * are listed: the English one came free and people type it, the Turkish one is
 * what this file prints. `gram` and `kilogram` are already the Turkish words
 * unchanged, and `units.ts`'s colloquial `kilo` is the Turkish clipping
 * unchanged too ("iki kilo domates"), so this file adds no word for it.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Turkish engine and
 * the micro path (`parseMass`) cannot drift from it.
 *
 * `symbol` is the SI abbreviation on the four metric units — which is what
 * Turkish itself writes, and TDK's own abbreviation list — and the spelled
 * nominative singular on the two Turkish does not abbreviate. Where a short
 * form for those two appears at all it is the English `oz`/`lb`, which
 * `units.ts` already registers for reading; claiming one as the *Turkish*
 * symbol would print `3oz` at a reader who wrote `ons`. R8 wants an explicit
 * symbol on every unit, never an invented one. `turkish.renderQuantity` spaces
 * a symbol from its number, following TSE and SI, so the symbol branch answers
 * "3 ons" rather than English's tight "3oz".
 *
 * Like `en`, this file names `mass` by **id string** and never imports the kind,
 * which is what lets `@smartput/mass/locale/tr` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "miligram"],
      symbol: "mg",
      forms: { other: "miligram" },
    },
    g: {
      aliases: [...alias("g")],
      symbol: "g",
      forms: { other: "gram" },
    },
    // `kilo` comes from `units.ts` and is the Turkish clipping unchanged. It is
    // ambiguous in Turkish exactly as it is in English — a kilometre is clipped
    // the same way — and this file inherits the alias map's claim rather than
    // making a new one.
    kg: {
      aliases: [...alias("kg")],
      symbol: "kg",
      forms: { other: "kilogram" },
    },
    // The metric tonne, `ton` in Turkish. No ambiguity with the imperial ton:
    // Turkish never adopted it, and the long/short ton reaches Turkish only as
    // an English phrase with the qualifier spelled out.
    t: {
      aliases: [...alias("t"), "ton"],
      symbol: "t",
      forms: { other: "ton" },
    },
    // See the header for the troy reading of `ons` in the gold market.
    oz: {
      aliases: [...alias("oz"), "ons"],
      symbol: "ons",
      forms: { other: "ons" },
    },
    lb: {
      aliases: [...alias("lb"), "libre"],
      symbol: "libre",
      forms: { other: "libre" },
    },
  },
});
