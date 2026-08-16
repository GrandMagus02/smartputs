import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Turkish words for the volume units — the same five `en`, `uk` and `de` name,
 * and **a word for all five**, which is the answer `de` gives and `en`, `uk`,
 * `nl` and `id` do not.
 *
 * **`m3` carries `forms` here, for the same reason `@smartput/area/locale/tr`'s
 * squared units do.** The refusal in the other languages was never "the unit is
 * unspeakable"; it is that the spoken name is a *phrase* — "cubic metres",
 * "кубічних метрів", `kubieke meter`, `meter kubik` — and `lex` ends a word
 * token at a space, so no analyzer is ever handed the whole thing and
 * `assertLocaleContract` fails a printed phrase by name. Turkish writes the
 * concept as one closed token, `metreküp`: it is a TDK headword, it is what a
 * concrete order or a water bill says ("beş metreküp beton"), and it is listed
 * as an alias below, so it round-trips like any other noun.
 *
 * German reaches the same place through `Kubikmeter`, but by a different road,
 * and the difference is worth naming because the two look identical in the
 * table. German's is a compound and `@smartput/volume/locale/de` must list it
 * explicitly to outrank its own `compoundSplitter`, which reads a compound by
 * its head and would otherwise answer a length. Turkish juxtaposes rather than
 * compounds, `turkish.analyze` carries no splitter at all, and the listing is
 * load-bearing for the plainer reason: a suffix stripper removes endings, so
 * without the exact alias "5 metreküp" reaches no reading whatsoever.
 *
 * **One `forms` key per unit, keyed `other`, and that is the entire grammar of
 * this file.** `turkish.selectForm` is the constant `() => "other"`: Turkish
 * does not agree a counted noun with its numeral, so "bir litre", "beş litre"
 * and "1,5 litre" are one word in three numerals, and "beş litreler" is a
 * mistake rather than a plural. No gender, no article. The dative that marks a
 * conversion target ("litreye çevir") is deliberately off the axis — see
 * `@smartput/core/locale/tr`, which rejects it because vowel harmony derives the
 * ending mechanically and a symbol target takes it through an apostrophe
 * ("l'ye") that a `forms` table cannot spell. Rule 6's "exactly the keys
 * `selectForm` can produce" is therefore one row per unit, against German's
 * four and Ukrainian's eight.
 *
 * **`galon` is claimed, and its ambiguity is the same one every language here
 * has.** Turkish borrowed the word for the measure and uses it for the measure;
 * the nineteen-litre office water bottle is a `damacana` in Turkish and not a
 * `galon`, so this vocabulary does not inherit the container reading that
 * `@smartput/volume/locale/id` has to record. What it does inherit is the
 * US/imperial split, which no language escapes: this kind's `gal` is the US
 * gallon, and a Turkish text quoting a British figure writes the same word. That
 * is the kind's ratio table, not this file's vocabulary.
 *
 * **`pint` is the loan kept unchanged.** Turkish never translated it and never
 * abbreviated it — it arrives with beer and with recipes, spelled exactly as
 * `units.ts` already declares — so the noun is also the symbol.
 *
 * **`mililitre` takes a single `l`**, because Turkish simplifies the doubled
 * consonants of its European loans, where `units.ts` declares `millilitre` and
 * `milliliter`. Both stay listed; only the Turkish one is printed. `litre` is
 * already the Turkish word unchanged — Turkish took the French spelling, so the
 * American `liter` is a reading alias and never a printed form.
 *
 * **`lt` is listed because Turkish commerce writes it.** The abbreviation TDK
 * sanctions is the SI `l`, and that is what this file prints; but a Turkish
 * price tag or a jerry can says "5 lt" often enough that a reader will type it,
 * and reading and printing are separate decisions. Only printing has to
 * round-trip.
 *
 * **Everything is lowercase**, because Turkish capitalises no common noun — so
 * the string this table prints is the string the alias index holds, and rule 5
 * needs none of the folding `de.test.ts` does. That is deliberate rather than
 * incidental in this language: `buildRegistry` folds alias keys with
 * `toLocaleLowerCase("tr")`, under which `I` becomes `ı` and not `i`, so a
 * capital in an alias would be indexed under a different letter than the reader
 * typed. Incoming capitals are `turkish.analyze`'s `caseFolds` to handle.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Turkish engine and
 * the micro path (`parseVolume`) cannot drift from it.
 *
 * `symbol` is the SI abbreviation on the three metric units, which is what
 * Turkish itself writes, and the spelled nominative singular on the two Turkish
 * does not abbreviate. R8 wants an explicit symbol on every unit, never an
 * invented one. `turkish.renderQuantity` spaces a symbol from its number,
 * following TSE and SI, so "1,5 m³" and never English's tight "1.5m³".
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/tr` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "lt"],
      symbol: "l",
      forms: { other: "litre" },
    },
    ml: {
      aliases: [...alias("ml"), "mililitre"],
      symbol: "ml",
      forms: { other: "mililitre" },
    },
    // The unit `en`, `uk`, `nl` and `id` all leave wordless; see the header for
    // why Turkish does not have to.
    // `metrekup` is the diacritic-free twin, listed rather than left to the
    // corrector. It *is* reachable without the entry — one substitution, ü → u,
    // is inside the correction budget — but a `FuzzyMatch` is a repair the
    // engine reports and ranks against alternatives, and an ASCII keyboard is
    // not a mistake. The same rule `tr-cardinals.ts` states for "uc" beside
    // "üç", and its proviso holds: `metrekup` is not another Turkish word.
    m3: {
      aliases: [...alias("m3"), "metreküp", "metrekup"],
      symbol: "m³",
      forms: { other: "metreküp" },
    },
    gal: {
      aliases: [...alias("gal"), "galon"],
      symbol: "galon",
      forms: { other: "galon" },
    },
    pint: {
      aliases: [...alias("pint")],
      symbol: "pint",
      forms: { other: "pint" },
    },
  },
});
