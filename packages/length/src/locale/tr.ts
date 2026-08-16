import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `de`, `nl`, `ja` and `id` next door make,
 * kept here for only the second of their two reasons — and that reason is
 * enough on its own.
 *
 * Turkish's own conversion keyword is the verb `çevir` (plus its diacritic-free
 * `cevir`, and English's `to`, which `buildKeywords` folds into the same entry).
 * `@smartput/core/locale/tr` claims no word spelled `in`, so in a tr-only
 * engine `lex` would emit no keyword token for it and an `in` alias would be
 * perfectly reachable. It stays out anyway, because `registry.aliasIndex` is one
 * flat map that `MatchCtx.isUnitAlias` reads without consulting a locale: a
 * Turkish entry for `in` would put the word back in front of
 * `@smartput/datetime`'s accept-gate — which refuses any phrase whose words are
 * *all* unit aliases — for any engine that also speaks English, and make "in 3
 * days" an all-units phrase again.
 *
 * A Turkish reader types `inç`, so the omission costs this vocabulary nothing —
 * and unlike English, which has to keep `in` as its *symbol* and buy a
 * `skipPrintable` waiver for it, this file has a short form of its own to print.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Turkish words for the length units — the same eight `en`, `uk` and `de` name,
 * and all eight have a Turkish word: the four metric ones are the international
 * words with Turkish orthography, and the four imperial ones were all borrowed
 * as single nouns.
 *
 * **One `forms` key per unit, keyed `other`, and that is the entire grammar of
 * this file.** `turkish.selectForm` is the constant `() => "other"`. Turkish
 * does not agree a counted noun with its numeral — "bir metre", "beş metre",
 * "1,5 metre" differ in the numeral and nowhere else, and "beş metreler" is not
 * a plural but a mistake — so there is one row per unit where
 * `@smartput/length/locale/de` needs four cells for the dative "in Metern" and
 * `uk` needs eight.
 *
 * **The conversion target has no row of its own, and that is the one omission a
 * reader should be told about rather than left to notice.** Turkish genuinely
 * marks the target of a conversion with the dative — "metreye çevir" — so a
 * `conversion-target` key looks like it belongs here the way `dat` belongs in
 * German. `@smartput/core/locale/tr` rejects the axis for two reasons this file
 * inherits: the ending is mechanically derivable from the noun by vowel harmony,
 * so every vocabulary in the repo would carry a second row no human judgement
 * went into, and on a *symbol* target Turkish glues the ending on with an
 * apostrophe ("km'ye") — punctuation a `forms` table cannot reach. What the
 * dative costs is only the printed side: "1 kilometre çevir metre" answers
 * "1.000 metre" rather than the "metreye" a Turkish sentence would use. Reading
 * is unaffected, because the stripper takes the ending off.
 *
 * **Everything is lowercase**, because Turkish capitalises no common noun — so
 * the string this table prints is the string the alias index holds, and rule 5
 * needs none of the folding `de.test.ts` does. That is worth being deliberate
 * about in *this* language: `buildRegistry` folds alias keys with
 * `toLocaleLowerCase("tr")`, under which `I` becomes `ı` and not `i`, so an
 * alias written with a capital would be indexed under a different letter than
 * the one the reader typed. Incoming capitals are `turkish.analyze`'s job — its
 * `caseFolds` offers both the Turkish and the ASCII reading of an i-shaped
 * letter — not this file's.
 *
 * **`inç`, `fit`, `yarda` and `mil` are all real Turkish nouns**, which is why
 * this kind has no wordless unit the way `@smartput/area/locale/id` does. Two of
 * them carry notes:
 *
 * `ayak` is the literal translation of *foot* and is deliberately **not**
 * listed. It is first the body part and the leg, then a stair tread, then a
 * verse foot, then the base of a hill; a bare "ayak" is not a quantity and
 * claiming it would put a measure reading in front of the commonest register the
 * word has. `fit` is the borrowed unit noun and is unambiguous — aviation says
 * "otuz bin fit" and means exactly this unit — so it is what is listed and
 * printed. This is the same call `@smartput/length/locale/nl` makes about
 * `voet`, reached without needing a compound splitter: Turkish does not compound
 * that way, and the stripper only removes case endings.
 *
 * `mil` is the statute mile and is claimed. The nautical mile is `deniz mili` —
 * two words, and `lex` ends a word token at a space — so it is unlistable
 * whether or not this kind had a unit for it, which it does not. Nothing is
 * lost: a reader who means the nautical mile writes the qualifier, and the
 * qualifier is what fails loudly instead of a bare `mil` quietly answering
 * 1609 m for 1852.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Turkish engine and
 * the micro path (`parseLength`) cannot drift from it.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Turkish itself writes and what TDK's abbreviation list gives, and the
 * spelled nominative singular on the four imperial ones. Turkish abbreviates
 * none of those four — the inch is written with a double prime (`5″`) which
 * `lex` cannot read, and the others are simply spelled out — so the noun is the
 * only short form that round-trips. R8 wants an explicit symbol on every unit,
 * never an invented or unreadable one. `turkish.renderQuantity` spaces a symbol
 * from its number, following TSE and SI, so a symbol print is "5 km" and never
 * English's tight "5km".
 *
 * Like `en`, this file names `length` by **id string** and never imports the
 * kind, which is what lets `@smartput/length/locale/tr` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "length",
  units: {
    // `milimetre` takes a single `l`: Turkish simplifies the doubled consonants
    // of its European loans, where `units.ts` declares the English `millimetre`
    // and `millimeter`. Both stay listed; only the Turkish one is printed.
    mm: {
      aliases: [...alias("mm"), "milimetre"],
      symbol: "mm",
      forms: { other: "milimetre" },
    },
    // `santimetre` writes the Latin `c` of *centi-* as the `s` it is pronounced
    // with, exactly as Indonesian does and where German writes `Zentimeter`.
    cm: {
      aliases: [...alias("cm"), "santimetre"],
      symbol: "cm",
      forms: { other: "santimetre" },
    },
    m: {
      aliases: [...alias("m")],
      symbol: "m",
      forms: { other: "metre" },
    },
    km: {
      aliases: [...alias("km")],
      symbol: "km",
      forms: { other: "kilometre" },
    },
    // `in` is filtered out above; `inç` is the Turkish noun and, unlike English,
    // it is a short form this vocabulary can print as its symbol too. `inc` is
    // its diacritic-free twin, listed for the reason `tr-cardinals.ts` lists
    // "uc" beside "üç" and `datetime/locale/tr.ts` states as a rule: the
    // language's case folds handle the dotted and dotless i and nothing else,
    // so ç → c is a vocabulary's business, and the rule's proviso ("only where
    // the plain spelling is not already another word") is satisfied — `inc` is
    // not a Turkish word. It is not reachable without the entry: `inc` sits one
    // edit from `inç`, `inch` and `min` at once, so the corrector refuses it as
    // ambiguous rather than guessing, which is the right behaviour for a
    // misspelling and the wrong one for the spelling an ASCII keyboard produces.
    in: {
      aliases: [...alias("in"), "inç", "inc"],
      symbol: "inç",
      forms: { other: "inç" },
    },
    // `ayak` is deliberately absent; see the header.
    ft: {
      aliases: [...alias("ft"), "fit"],
      symbol: "fit",
      forms: { other: "fit" },
    },
    yd: {
      aliases: [...alias("yd"), "yarda"],
      symbol: "yarda",
      forms: { other: "yarda" },
    },
    mi: {
      aliases: [...alias("mi"), "mil"],
      symbol: "mil",
      forms: { other: "mil" },
    },
  },
});
