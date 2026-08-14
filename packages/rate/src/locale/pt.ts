import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Portuguese half: what may be typed, and what may be printed. */
interface PortugueseWords {
  readonly aliases: readonly string[];
  /**
   * Two keys, because `portuguese.selectForm` returns a bare CLDR plural
   * category — `one` and `other` — and a table may hold exactly the keys the
   * language can ask for, no more and no fewer. Portuguese nouns inflect for
   * number and not for case, so there is no slot axis; and the `many` category
   * CLDR files for Portuguese is folded into `other` by the language itself, so
   * there is no third row to fill here either.
   *
   * The row a translator from English will get wrong is `one`: CLDR's Portuguese
   * rule is `i = 0..1`, so a *fraction* selects the singular. "1,5 dólar" is the
   * Portuguese line, not "1,5 dólares".
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Portuguese words for the currencies that have one.
 *
 * Portuguese inflects a currency noun for number and nothing else, so every entry
 * below is a two-row table and the interesting decisions are lexical rather than
 * grammatical:
 *
 *   - **the plural rule**, which is not one rule. A noun ending in a vowel takes
 *     "-s" (euro/euros, franco/francos, zloti/zlotis); one ending in "-r" takes
 *     "-es" (dólar/dólares) and loses its written accent on the way, because the
 *     acute is only written where the general stress rule would put the stress
 *     elsewhere and "dolares" is already stressed correctly. The suffix stripper
 *     does bridge that one — dropping "es" from "dólares" yields "dólar" — but at
 *     `weight: -2`, so both are declared.
 *   - **the accent-free spelling**, declared beside every accented one. NFKC
 *     folding leaves a precomposed ó as ó rather than stripping it, so "dolares"
 *     from a keyboard without accents is a different string to the alias index —
 *     the same reason `pt.ts` declares "tres" beside "três" in `CARDINALS`.
 *
 * Every form printed is also listed as an alias, because a printed word recovered
 * only by the language's penalised suffix stripper is a word this vocabulary is
 * guessing at rather than declaring.
 *
 * **The plural class this language was built for is the one currency missing from
 * the table.** `pt.ts` ships a `pluralReplacer` whose headline example is
 * "reais" → "real", and it says so: the Brazilian real is the currency every
 * price line in the country is written in. `CURRENCIES` does not hold `brl` —
 * it is the currencies the ECB's daily reference file quotes, and that is a
 * decision about rates rather than about words — so there is no unit here for
 * "real"/"reais" to attach to, and inventing one would be a vocabulary declaring
 * a unit, which is the one thing a vocabulary must not do. The rule still earns
 * its keep on `pln` below, whose plural is the -i class.
 *
 * **No colloquial layer, and that is a decision about the tag rather than about
 * the words.** `en` next door adds "quid", "sterling" and "bucks". Brazilian
 * Portuguese has a rich register of the same sort — "conto", "pila", "prata",
 * "merreca" — and every one of those words names the *local* currency, which is
 * the one this table does not carry; "pila" is also regional (Rio Grande do Sul)
 * where "conto" is dated nationally. So the colloquial layer this file could
 * write would be a layer over a unit that does not exist, in a register that is
 * not the bare `pt` tag's. A regional variant is a `Language` with an id of its
 * own, and its vocabulary is where that slang belongs.
 */
const PORTUGUESE: Readonly<Record<string, PortugueseWords>> = {
  // The table already lists "euro" and "euros" — they are the same word in both
  // languages — so this entry adds no alias and exists for its `forms`, which have
  // to be re-declared in Portuguese even where the string is identical: the
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
  // "libra" is also `@smartput/mass/locale/pt`'s word for the pound — it declares
  // exactly these two strings and prints them — in this language as in English
  // ("5 pounds" is the same ambiguity). It is left standing here for the same
  // reason: the two readings are separated by the kinds installed and by weight,
  // never by taking a word away from the language that has it. "esterlina" is the
  // clipping of "libra esterlina", whose two words can never be one alias.
  gbp: {
    aliases: ["libra", "libras", "esterlina", "esterlinas"],
    forms: { one: "libra", other: "libras" },
  },
  // The naturalized loan: Portuguese writes the yen "iene" and declines it like
  // any vowel-final noun, where the table's own display row says "yen" for both
  // because English does not decline it at all.
  jpy: {
    aliases: ["iene", "ienes"],
    forms: { one: "iene", other: "ienes" },
  },
  chf: {
    aliases: ["franco", "francos"],
    forms: { one: "franco", other: "francos" },
  },
  // The one row where reading and printing part company. The Portuguese
  // adaptation is "zloti", plural "zlotis"; the Polish spelling "zloty" is what
  // the financial pages print and it stays readable, with its borrowed plural
  // "zlotys" beside it. Printing the adaptation is the same call `uk` makes
  // printing "єна" while only reading "ієна": a vocabulary should answer in one
  // voice, and that voice is the language's own orthography. It is also what keeps
  // this row provably Portuguese — the generated English table says
  // "zloty"/"zlotys", so a `forms` row spelled that way could not be told apart
  // from the English one this file drops.
  pln: {
    aliases: ["zloti", "zlotis", "zlotys"],
    forms: { one: "zloti", other: "zlotis" },
  },
  // The opposite case to the złoty, and the reason both are worth writing down.
  // Portuguese has no adaptation of the hryvnia: it quotes the Ukrainian
  // transliteration exactly as English does, and pluralizes it with the plain
  // vowel-final "-s". So this row is spelled like the English one on purpose,
  // the way `eur` above is — the difference is that the *plural* is a genuine
  // addition, since `CURRENCIES` lists "hryvnias" as a display form and never as
  // an alias, leaving it reachable only through the penalised suffix stripper.
  uah: {
    aliases: ["hryvnias"],
    forms: { one: "hryvnia", other: "hryvnias" },
  },
};

/**
 * Portuguese words for the currencies, layered over the generated table.
 *
 * Brazilian, under the bare `pt` tag, per this project's ruling — which here
 * means the digits around the words rather than the words themselves: "," before
 * the cents and "." between the thousands, so a dollar amount prints "$1.234,50".
 * Not one currency below is spelled differently in Brazil and in Portugal.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and nothing
 * else. `CURRENCIES` holds one set of words and they are English ("dollar",
 * "kronor"), so `currencyVocabulary("pt")` returns English words under a `pt`
 * label — its own doc comment says as much, and `pt.test.ts` pins it so the day
 * that table grows localized names this file stops being right and that assertion
 * stops being green together. What the call is still good for is the half of a
 * currency that is *not* language: the ISO code, the Latin aliases and the
 * currency sign.
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6).
 *   - its `forms` are dropped, every one of them, and this is where Portuguese
 *     needs the same care Spanish did. `ukrainian.selectForm` returns
 *     `` `${case}-${category}` `` and could never index a `one`/`other` table, so
 *     the generated rows there were merely unreachable. `portuguese.selectForm`
 *     returns exactly `one` and `other`: the generated table fits, and a currency
 *     whose rows were left in place would print the English "kronor" out of a
 *     Portuguese engine. Dropping them is what makes the fallback to the symbol
 *     happen for the five currencies below that have no Portuguese word.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: € is € in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Portuguese symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * Five currencies get no Portuguese word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their Portuguese names are "dólar canadense" and "dólar
 *     australiano", a qualifier plus the head noun `usd` already owns. Two tokens
 *     cannot be one alias, and the qualifier alone is an adjective that means
 *     nothing on its own. `en` omits display forms for exactly these two for
 *     exactly this reason, and `uk` and `es` omit the same pair.
 *   sek, nok, czk — Portuguese calls all three "coroa", separated only by the
 *     same kind of qualifier ("sueca", "norueguesa", "tcheca"). One word for
 *     three units of one kind has no reading at all: no context the engine has
 *     would separate them, so the word is left unclaimed rather than given to
 *     whichever happened to be written first.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Portuguese speaker types for them anyway, and no `forms` — the renderer then
 * falls back to the symbol, which is what a Portuguese price list prints for a
 * currency it has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/pt` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("pt").units)) {
  const words = PORTUGUESE[code];
  units[code] = {
    aliases: [...generated.aliases, ...(words?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(words !== undefined ? { forms: words.forms } : {}),
  };
}

export default defineVocabulary({ locale: "pt", kind: "money", units });
