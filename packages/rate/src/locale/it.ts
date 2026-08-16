import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's Italian half: what may be typed, and what may be printed. */
interface ItalianWords {
  readonly aliases: readonly string[];
  /**
   * Two keys, because `italian.selectForm` returns a bare CLDR plural category —
   * `one` for a count of exactly 1, `other` for everything else — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer. The
   * `many` category CLDR files for Italian is folded into `other` by the language
   * itself (it exists for the compact "un milione **di** euro", which this engine
   * never prints), so there is no third row to fill here.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Italian words for the currencies that have one.
 *
 * Italian inflects a currency noun for number and nothing else, so every entry
 * below is a two-row table — and the interesting thing about this language is
 * how often the two rows hold the *same string*. Italian has a large invariant
 * class, and three of the seven currencies fall in it:
 *
 *   - **the invariant loanwords.** "yen" and "zloty" end in a consonant, which
 *     is the shape Italian never inflects: "cento yen", "cinque zloty". Nothing
 *     is added to their aliases, because the generated table already spells both
 *     — what this file contributes for them is the `forms` table that says the
 *     plural is the singular.
 *   - **"euro", which is invariant by decree.** This is the entry worth reading
 *     twice. Italian would ordinarily pluralize a masculine noun in -o to -i,
 *     and "euri" is a form people do say — but the Accademia della Crusca and
 *     official Italian usage both fix the plural as "euro", on the grounds that
 *     the word is a clipping of "Europa" rather than an ordinary noun. So "5
 *     euro" is correct and "5 euri" is not, and this table prints the invariant
 *     form in both rows. It is also what tells this row apart from the English
 *     one below it: the generated table says "euro"/"euros", and only the
 *     `other` row differs.
 *
 * The four that do inflect show three of the four classes `it.ts`'s plural fold
 * is written for, which is why they are worth naming individually:
 *
 *   - "dollaro"/"dollari" — the ordinary masculine, the `i → o` row.
 *   - "franco"/"franchi" — the same class, but with the velar preserved: the
 *     "h" is spelling and not sound, and it is there so that the c stays hard
 *     before an i. That is exactly the `chi → co` row, and `it.ts`'s doc comment
 *     uses this very word as its example.
 *   - "sterlina"/"sterline" — the ordinary feminine, the `e → a` row. Unlike
 *     Spanish's "libra" there is no collision with the mass kind here: Italian
 *     calls the pound weight "libbra", with a double b, so the currency word is
 *     the currency's alone.
 *   - "grivnia"/"grivnie" — the same feminine class. This is the adapted Italian
 *     spelling; the table's own "hryvnia" is the English transliteration and
 *     keeps reading beside it.
 *
 * Every form printed is also listed as an alias, because a printed word
 * recovered only by the language's penalised plural fold is a word this
 * vocabulary is guessing at rather than declaring — and for the four inflecting
 * entries the fold genuinely would recover it, at `weight: -2`, which is exactly
 * the silent near-miss the rule exists to stop.
 *
 * **No colloquial layer, and that is a decision about the tag rather than about
 * the words.** `en` next door adds "quid", "sterling" and "bucks". Italian has
 * the same register, and every candidate fails on the same point: "sacchi" and
 * "testoni" are pre-euro slang for the lira, "verdoni" is a calque of
 * "greenbacks" that no one writes, and "sterline" as a colloquialism already is
 * the standard word. The one genuinely current item, "lira", names a currency
 * this table does not hold at all. So there is nothing to add that would be
 * both current and unambiguous.
 */
const ITALIAN: Readonly<Record<string, ItalianWords>> = {
  // The table already lists "euro" — the same string in both languages — so this
  // entry adds no alias and exists for its `forms`, which have to be re-declared
  // in Italian even where one of the two strings is identical: the generated
  // table's forms are dropped wholesale below, and a row kept by accident is a
  // row nobody checked. The `other` row is where Italian and English part.
  eur: {
    aliases: [],
    forms: { one: "euro", other: "euro" },
  },
  usd: {
    aliases: ["dollaro", "dollari"],
    forms: { one: "dollaro", other: "dollari" },
  },
  gbp: {
    aliases: ["sterlina", "sterline"],
    forms: { one: "sterlina", other: "sterline" },
  },
  // Invariant: a loanword ending in a consonant takes no Italian plural. The
  // generated English table happens to say "yen" for both rows too, which is the
  // one place the two languages agree by coincidence rather than by borrowing.
  jpy: {
    aliases: [],
    forms: { one: "yen", other: "yen" },
  },
  chf: {
    aliases: ["franco", "franchi"],
    forms: { one: "franco", other: "franchi" },
  },
  // Invariant for the same reason as the yen, and the row where reading and
  // printing would part company in Spanish: Italian needs no adaptation, it
  // simply declines to inflect. "zloty" is already an alias, so nothing is added
  // — what is declared is that the plural is not "zlotys", which is the English
  // row this file drops.
  pln: {
    aliases: [],
    forms: { one: "zloty", other: "zloty" },
  },
  uah: {
    aliases: ["grivnia", "grivnie"],
    forms: { one: "grivnia", other: "grivnie" },
  },
};

/**
 * Italian words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and
 * nothing else. `CURRENCIES` holds one set of words and they are English
 * ("dollar", "kronor"), so `currencyVocabulary("it")` returns English words
 * under an `it` label — its own doc comment says as much, and `it.test.ts` pins
 * it so the day that table grows localized names this file stops being right and
 * that assertion stops being green together. What the call is still good for is
 * the half of a currency that is *not* language: the ISO code, the Latin aliases
 * and the currency sign.
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale
 *     changes — recognition is many-to-one, generation is one (design decision
 *     I6).
 *   - its `forms` are dropped, every one of them, and this is where Italian
 *     needs the same care Spanish did. `ukrainian.selectForm` returns
 *     `` `${case}-${category}` `` and could never index a `one`/`other` table, so
 *     the generated rows there were merely unreachable. `italian.selectForm`
 *     returns exactly `one` and `other`: the generated table fits, and a
 *     currency whose rows were left in place would print the English "kronor"
 *     out of an Italian engine — or, worse for this language, the plausible-
 *     looking "euros", which is a word Italian does not have. Dropping them is
 *     also what makes the fallback to the symbol happen for the five currencies
 *     below that have no Italian word.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than
 * an oversight. A currency sign is a fact about the currency and not about a
 * language: € is € in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so an
 * Italian symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * Five currencies get no Italian word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their Italian names are "dollaro canadese" and "dollaro
 *     australiano", a qualifier plus the head noun `usd` already owns. Two tokens
 *     cannot be one alias, and the qualifier alone is an adjective that means
 *     nothing on its own. `en` omits display forms for exactly these two for
 *     exactly this reason, and `uk` and `es` omit the same pair.
 *   sek, nok, czk — Italian calls all three "corona", separated only by the same
 *     kind of qualifier ("svedese", "norvegese", "ceca"). One word for three
 *     units of one kind has no reading at all: no context the engine has would
 *     separate them, and `assertLocaleContract` would refuse it outright, since a
 *     word claimed by two units of one kind is exactly what its rival check
 *     reports. So the word is left unclaimed rather than given to whichever
 *     happened to be written first.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what an
 * Italian speaker types for them anyway, and no `forms` — the renderer then
 * falls back to the symbol, which is what an Italian price list prints for a
 * currency it has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/it` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("it").units)) {
  const words = ITALIAN[code];
  units[code] = {
    aliases: [...generated.aliases, ...(words?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(words !== undefined ? { forms: words.forms } : {}),
  };
}

export default defineVocabulary({ locale: "it", kind: "money", units });
