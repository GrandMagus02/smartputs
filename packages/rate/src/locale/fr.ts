import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's French half: what may be typed, and what may be printed. */
interface FrenchWords {
  readonly aliases: readonly string[];
  /**
   * Two keys, because `french.selectForm` returns exactly `one` or `other` — and
   * a table may hold exactly the keys the language can ask for, no more and no
   * fewer. The `many` category CLDR files for French is folded into `other` by
   * the language itself, so there is no third row to fill here.
   *
   * The boundary between the two is **not** English's, and this is the one kind
   * in the repo where that difference is visible in a word rather than only in a
   * `selectForm` assertion. French takes the singular on everything below two: 0
   * is "zéro euro", and 1,5 is "1,5 euro" where English writes "1.5 euros". So
   * `one` is the row a fractional amount of money — the ordinary case for this
   * kind — lands on, and a table ported from the generated English one by
   * renaming its columns would print a plural there.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The French words for the currencies that have one.
 *
 * French inflects a currency noun for number and nothing else, so every entry
 * below is a two-row table and the interesting decisions are lexical rather than
 * grammatical:
 *
 *   - **the plural is regular, and that is why so little is declared.** French
 *     adds -s to all of these ("euro/euros", "franc/francs", "livre/livres"), and
 *     four of the seven nouns are spelled exactly as English spells them — euro,
 *     dollar, franc, and their plurals — so `CURRENCIES` already holds both rows
 *     and this file adds no alias for them at all. What it still must do is
 *     re-declare the `forms`, because the generated table's rows are dropped
 *     wholesale below and a row kept by accident is a row nobody checked.
 *   - **the borrowed nouns take the French plural anyway.** "yen", "zloty" and
 *     "hryvnia" are all naturalised enough to decline — "cent yens", "des
 *     zlotys" — where the generated English table leaves the yen invariable and
 *     never lists a plural for the other two as an alias. Those three plurals are
 *     the whole of what this file appends beyond the pound.
 *   - **no accent-free variant is declared, and unlike the Spanish file that is
 *     an observation rather than a decision**: not one French currency noun
 *     carries an accent. "euro", "dollar", "livre", "franc", "yen", "zloty",
 *     "hryvnia" are bare-vowel words throughout.
 *
 * Every form printed is also listed as an alias, because a printed word
 * recovered only by the language's penalised suffix stripper is a word this
 * vocabulary is guessing at rather than declaring.
 *
 * **No colloquial layer, and that is a decision about the tag rather than about
 * the words.** `en` next door adds "quid", "sterling" and "bucks"; French has the
 * same register — "balles", "boules", "patates" — and every one of them is either
 * dated (they are franc-era words for a unit that no longer exists), regional, or
 * a quantity rather than a currency ("une patate" is a million old francs). This
 * file is the bare `fr` tag, which `fr.ts` pins to metropolitan CLDR content, so
 * a word that is only true in one place or one decade would be claiming a region
 * this language deliberately does not name. A regional variant is a `Language`
 * with an id of its own, and its vocabulary is where that slang belongs.
 */
const FRENCH: Readonly<Record<string, FrenchWords>> = {
  // The table already lists "euro" and "euros" — they are the same word in both
  // languages, the euro having been named to be — so this entry adds no alias and
  // exists for its `forms`.
  eur: {
    aliases: [],
    forms: { one: "euro", other: "euros" },
  },
  // Likewise "dollar"/"dollars": French borrowed the noun whole and pluralizes it
  // the way it pluralizes any noun in a consonant, which happens to be the way
  // English does.
  usd: {
    aliases: [],
    forms: { one: "dollar", other: "dollars" },
  },
  // "livre" is also `@smartput/mass`'s French word for the pound, in this
  // language as in English ("5 pounds" is the same ambiguity) and as in Spanish,
  // and it is left standing for the same reason: the two readings are separated
  // by the kinds installed and by weight, never by taking a word away from the
  // language that has it. "sterling" is deliberately *not* claimed — French uses
  // it only as the invariable adjective of "livre sterling", never as the noun on
  // its own, so it would be a word this file asserts French says and French does
  // not.
  gbp: {
    aliases: ["livre", "livres"],
    forms: { one: "livre", other: "livres" },
  },
  // The generated table calls the yen invariable, which is English's rule for it
  // ("100 yen"). French naturalised the noun and declines it — "cent yens" — so
  // the plural is both a new alias and the row that makes this entry differ from
  // the English one it replaces.
  jpy: {
    aliases: ["yens"],
    forms: { one: "yen", other: "yens" },
  },
  chf: {
    aliases: [],
    forms: { one: "franc", other: "francs" },
  },
  // French keeps the Polish spelling — "le zloty", occasionally written "złoty"
  // with the barred l, which no French keyboard produces and which `normalize()`
  // would not fold to "zloty" either, so the bare spelling is the one declared.
  // The plural is French's own: "des zlotys". Note that these two rows are
  // *spelled* the same as the generated English ones, so unlike the Spanish file
  // — which prints the RAE's "esloti" and can therefore prove its rows are not
  // the English ones — this entry's Frenchness is in the alias it adds rather
  // than in the strings it prints. `fr.test.ts` says so rather than claiming a
  // distinction that is not there.
  pln: {
    aliases: ["zlotys"],
    forms: { one: "zloty", other: "zlotys" },
  },
  // "hryvnia" is the transliteration French uses as well; only the plural is
  // missing from the table's aliases, and French forms it regularly.
  uah: {
    aliases: ["hryvnias"],
    forms: { one: "hryvnia", other: "hryvnias" },
  },
};

/**
 * French words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and nothing
 * else. `CURRENCIES` holds one set of words and they are English ("kronor",
 * "koruna"), so `currencyVocabulary("fr")` returns English words under an `fr`
 * label — its own doc comment says as much, and `fr.test.ts` pins it so the day
 * that table grows localized names this file stops being right and that assertion
 * stops being green together. What the call is still good for is the half of a
 * currency that is *not* language: the ISO code, the Latin aliases and the
 * currency sign.
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6). For
 *     French this is doing more work than for Spanish, since four of the seven
 *     French nouns *are* the generated English ones.
 *   - its `forms` are dropped, every one of them. `french.selectForm` returns
 *     exactly `one` and `other`, so the generated table fits and a currency whose
 *     rows were left in place would print the English "kronor" out of a French
 *     engine — the same hazard Spanish had and Ukrainian did not, since
 *     `ukrainian.selectForm` could never index a `one`/`other` table at all.
 *     Dropping them is what makes the fallback to the symbol happen for the five
 *     currencies below that have no French word.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: € is € in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * French symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree. It is also why a French engine still writes "30,00 €"
 * as "€30,00": the sign goes in front because the hook puts it there, not because
 * this file said so, and French convention (sign after, space before) is a
 * property of the kind's output path rather than of any vocabulary.
 *
 * Five currencies get no French word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their French names are "dollar canadien" and "dollar australien",
 *     a qualifier plus the head noun `usd` already owns. Two tokens cannot be one
 *     alias, and the qualifier alone is an adjective that means nothing on its
 *     own. `en` omits display forms for exactly these two for exactly this
 *     reason, and `uk` and `es` omit the same pair.
 *   sek, nok, czk — French calls all three "couronne", separated only by the same
 *     kind of qualifier ("suédoise", "norvégienne", "tchèque"). One word for
 *     three units of one kind has no reading at all: no context the engine has
 *     would separate them, so the word is left unclaimed rather than given to
 *     whichever happened to be written first.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * French speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what a French price list prints for a currency it
 * has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/fr` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("fr").units)) {
  const french = FRENCH[code];
  units[code] = {
    aliases: [...generated.aliases, ...(french?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(french !== undefined ? { forms: french.forms } : {}),
  };
}

export default defineVocabulary({ locale: "fr", kind: "money", units });
