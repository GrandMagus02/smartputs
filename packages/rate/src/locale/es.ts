import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's Spanish half: what may be typed, and what may be printed. */
interface SpanishWords {
  readonly aliases: readonly string[];
  /**
   * Two keys, because `spanish.selectForm` returns a bare CLDR plural category —
   * `one` for a count of exactly 1, `other` for everything else — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer. The
   * `many` category CLDR files for Spanish is folded into `other` by the
   * language itself, so there is no third row to fill here.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Spanish words for the currencies that have one.
 *
 * Spanish inflects a currency noun for number and nothing else, so every entry
 * below is a two-row table and the interesting decisions are lexical rather than
 * grammatical:
 *
 *   - **the plural rule**, which is not one rule. A noun ending in a vowel takes
 *     "-s" (euro/euros, franco/francos, grivna/grivnas); one ending in a
 *     consonant takes "-es" (yen/yenes). "dólar" takes "-es" *and* loses its
 *     written accent — "dólares" is stressed on the same syllable, and the acute
 *     is only written where the general rule would put the stress elsewhere.
 *     The suffix stripper cannot bridge that: stripping "es" from "dólares"
 *     yields "dolar", a third string again, so all of them are declared.
 *   - **the accent-free spelling**, declared beside every accented one. NFKC
 *     folding leaves a precomposed ó as ó rather than stripping it, so "dolares"
 *     from a keyboard without accents is a different string to the alias index —
 *     the same reason `es.ts` declares "mas" beside "más" in its keyword table.
 *
 * Every form printed is also listed as an alias, because a printed word
 * recovered only by the language's penalised suffix stripper is a word this
 * vocabulary is guessing at rather than declaring.
 *
 * **No colloquial layer, and that is a decision about the tag rather than about
 * the words.** `en` next door adds "quid", "sterling" and "bucks"; Spanish has
 * the same register — "pavos", "lucas", "varos" — and not one of those words
 * means the same currency in two countries. "Pavos" is euros in Spain and
 * dollars nowhere else; "lucas" is thousands of the local unit. This file is the
 * bare `es` tag, which `es.ts` pins to CLDR's default content, so a word that is
 * only true in one country would be claiming a region this language deliberately
 * does not name. A regional variant is a `Language` with an id of its own, and
 * its vocabulary is where that slang belongs.
 */
const SPANISH: Readonly<Record<string, SpanishWords>> = {
  // The table already lists "euro" and "euros" — they are the same word in both
  // languages — so this entry adds no alias and exists for its `forms`, which
  // have to be re-declared in Spanish even where the string is identical: the
  // generated table's forms are dropped wholesale below, and a row kept by
  // accident is a row nobody checked.
  eur: {
    aliases: [],
    forms: { one: "euro", other: "euros" },
  },
  usd: {
    aliases: ["dólar", "dólares", "dolar", "dolares"],
    forms: { one: "dólar", other: "dólares" },
  },
  // "libra" is also `@smartput/mass`'s Spanish word for the pound, in this
  // language as in English ("5 pounds" is the same ambiguity), and it is left
  // standing for the same reason: the two readings are separated by the kinds
  // installed and by weight, never by taking a word away from the language that
  // has it. "esterlina" is the clipping of "libra esterlina", whose two words can
  // never be one alias.
  gbp: {
    aliases: ["libra", "libras", "esterlina", "esterlinas"],
    forms: { one: "libra", other: "libras" },
  },
  // The consonant plural: "yen" is invariable in English, where the table's own
  // display row says "yen" for both, and Spanish declines it — "5 yenes".
  jpy: {
    aliases: ["yenes"],
    forms: { one: "yen", other: "yenes" },
  },
  chf: {
    aliases: ["franco", "francos"],
    forms: { one: "franco", other: "francos" },
  },
  // The one entry where reading and printing part company. Spanish newspapers
  // write the Polish spelling "zloty", and its Spanish plural "zlotys" is added
  // as an alias so that half keeps reading — but what is *printed* is the RAE's
  // adaptation, "esloti"/"eslotis", for the reason `uk` prints "єна" and only
  // reads "ієна": a vocabulary should answer in one voice, and that voice is the
  // language's own orthography. It is also what keeps this row provably Spanish:
  // the generated English table happens to say "zloty"/"zlotys" too, so a
  // `forms` row spelled that way could not be told apart from the English one
  // this file drops, and `es.test.ts` asserts exactly that distinction.
  pln: {
    aliases: ["zlotys", "esloti", "eslotis"],
    forms: { one: "esloti", other: "eslotis" },
  },
  // "grivna" is the RAE's spelling, and unlike the złoty it is also the one in
  // use; the table's own "hryvnia" is the English transliteration and keeps
  // reading beside it.
  uah: {
    aliases: ["grivna", "grivnas"],
    forms: { one: "grivna", other: "grivnas" },
  },
};

/**
 * Spanish words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and
 * nothing else. `CURRENCIES` holds one set of words and they are English
 * ("dollar", "kronor"), so `currencyVocabulary("es")` returns English words
 * under an `es` label — its own doc comment says as much, and `es.test.ts` pins
 * it so the day that table grows localized names this file stops being right and
 * that assertion stops being green together. What the call is still good for is
 * the half of a currency that is *not* language: the ISO code, the Latin aliases
 * and the currency sign.
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale
 *     changes — recognition is many-to-one, generation is one (design decision
 *     I6).
 *   - its `forms` are dropped, every one of them, and this is where Spanish
 *     needs more care than Ukrainian did. `ukrainian.selectForm` returns
 *     `` `${case}-${category}` `` and could never index a `one`/`other` table, so
 *     the generated rows there were merely unreachable. `spanish.selectForm`
 *     returns exactly `one` and `other`: the generated table fits, and a
 *     currency whose rows were left in place would print the English "kronor"
 *     out of a Spanish engine. Dropping them is what makes the fallback to the
 *     symbol happen for the five currencies below that have no Spanish word.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than
 * an oversight. A currency sign is a fact about the currency and not about a
 * language: € is € in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Spanish symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * Five currencies get no Spanish word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their Spanish names are "dólar canadiense" and "dólar
 *     australiano", a qualifier plus the head noun `usd` already owns. Two tokens
 *     cannot be one alias, and the qualifier alone is an adjective that means
 *     nothing on its own. `en` omits display forms for exactly these two for
 *     exactly this reason, and `uk` omits the same pair.
 *   sek, nok, czk — Spanish calls all three "corona", separated only by the same
 *     kind of qualifier ("sueca", "noruega", "checa"). One word for three units
 *     of one kind has no reading at all: no context the engine has would separate
 *     them, so the word is left unclaimed rather than given to whichever happened
 *     to be written first.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Spanish speaker types for them anyway, and no `forms` — the renderer then
 * falls back to the symbol, which is what a Spanish price list prints for a
 * currency it has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/es` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("es").units)) {
  const spanish = SPANISH[code];
  units[code] = {
    aliases: [...generated.aliases, ...(spanish?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(spanish !== undefined ? { forms: spanish.forms } : {}),
  };
}

export default defineVocabulary({ locale: "es", kind: "money", units });
