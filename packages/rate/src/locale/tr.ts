import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's Turkish half: what may be typed, and what may be printed. */
interface TurkishWords {
  /**
   * Only the spellings the generated table does not already carry. Turkish
   * respells a borrowing to match its pronunciation, so most of these names
   * differ from the English ones by a letter or two and have to be listed; *euro*
   * and *yen* are the two the table already spells the way Turkish does.
   */
  readonly aliases: readonly string[];
  /**
   * **One key**, because `turkish.selectForm` returns the constant `"other"` for
   * every count and every slot, and a table may hold exactly the keys the
   * language can ask for — no more and no fewer.
   *
   * This is the row the three-type split was designed to be able to reach, and
   * this package is where it is visible: `uk` writes eight cells per currency,
   * `de` four, `en` and `nl` two, and Turkish writes one. Nothing is missing from
   * it. A counted noun in this language is bare — "1 dolar", "5 dolar",
   * "1,5 dolar", never "5 dolarlar" — and there is no gender, no article and no
   * agreement of any other sort for a numeral to move.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * One word, in the one cell this language has. Written as a helper rather than
 * as a literal at each site for the reason `nl.ts` gives about its own two-cell
 * version: seven hand-written objects are seven chances to mistype a key, and the
 * key is the half no test can guess at.
 *
 * That there is a *single* cell is the finding, not a table stopping halfway.
 * `nl` had to argue that Dutch keeps a currency noun singular after a numeral,
 * because Dutch has a plural and chooses not to use it there — a claim about a
 * construction, which could stop being true. Turkish has a plural (`-ler`/`-lar`)
 * and it is **ungrammatical** after a count: the numeral has already said how
 * many, so the noun does not repeat it. There is no second form for a count to
 * have selected.
 */
const invariant = (word: string): Readonly<Record<string, string>> => ({ other: word });

/**
 * The Turkish words for the currencies that have one.
 *
 * **Turkish earns more lines here than any other Latin-alphabet file in this
 * package, and the reason is the 1928 alphabet reform.** Turkish spelling is
 * phonemic and loanwords are rewritten to match how they are said, so a currency
 * name arrives with different letters rather than the same ones: *dollar* →
 * *dolar* (a doubled consonant is simplified), *franc* → *frank*, *złoty* →
 * *zloti*, *hryvnia* → *grivna*, and the pound is not called a pound at all but
 * *sterlin*. Only *euro* and *yen* survive unchanged, and even *euro* has a
 * rival; see below.
 *
 * **No plural is listed anywhere, and that is structural.** Every other
 * translated file in this package declares plurals — `nl` writes out *ponden* and
 * *franken* because its stripper cannot reach them, `de` leaves them to a
 * stripper that can, `uk` writes six cells of them. Turkish has one to declare
 * and no place to declare it: *dolarlar* exists, and it is exactly what a counted
 * noun never is.
 *
 * Every form printed is also a form read. For *euro* and *yen* the generated
 * alias already is it; the other five are listed explicitly here. A printed form
 * recovered only by the penalised suffix stripper would be a word this vocabulary
 * is guessing at rather than declaring — and `@smartput/core/locale/tr`'s
 * `minStem: 3` is what stops it guessing wrong in one case worth naming: *dolar*
 * ends in `-lar`, which is the Turkish plural, so a lower floor would have offered
 * "do" as its stem.
 */
const TURKISH: Readonly<Record<string, TurkishWords>> = {
  /**
   * Two live spellings, and the everyday one is what prints. TDK coined *avro* in
   * 1998 on the model of the other Turkified names and the Central Bank writes it
   * that way in its own bulletins; ordinary Turkish writing kept *euro*, which is
   * also the table's own word. Neither is an archaism, so both read — an alias is
   * read and never printed, so listing the second costs one index slot and loses
   * no reader — and the one a price tag actually carries is the one in `forms`.
   */
  eur: { aliases: ["avro"], forms: invariant("euro") },
  // The respelling rule at its plainest: Turkish writes no doubled consonant it
  // does not pronounce, so "dollar" is *dolar*. The English spelling stays
  // readable through the generated table, which is what "recognition is
  // many-to-one" buys.
  usd: { aliases: ["dolar"], forms: invariant("dolar") },
  // Turkish does not call this currency a pound. *Sterlin* is the word — the
  // second half of "pound sterling", borrowed on its own — and "İngiliz sterlini"
  // is what is written where the qualifier matters: two tokens, and the head
  // carries a possessive suffix in it besides, so only the bare noun can be an
  // alias. The generated "pound" stays readable beside it.
  gbp: { aliases: ["sterlin"], forms: invariant("sterlin") },
  // "yen" is the table's word and is invariant in Turkish, here for a reason that
  // covers every noun in the language rather than for the one Japanese has.
  jpy: { aliases: [], forms: invariant("yen") },
  // *Frank*, with a k: Turkish spells the final sound as it is said. The full
  // name is "İsviçre frangı", two tokens — and the head is not even *frank* in
  // it, because a final `k` voices to `ğ` before the possessive suffix. That is
  // the same consonant softening `@smartput/temperature/locale/tr` records for
  // *santigrada*, and it is why the qualified name is out of reach of both an
  // alias and a suffix list.
  chf: { aliases: ["frank"], forms: invariant("frank") },
  // Turkish drops the Polish ł and writes the vowel it hears: *zloti*. The
  // table's "zloty" stays readable.
  pln: { aliases: ["zloti"], forms: invariant("zloti") },
  // *Grivna*, which came into Turkish through Russian rather than through the
  // international transliteration the table carries as "hryvnia" — the h is not
  // pronounced in the Russian form and Turkish has no reason to write it.
  uah: { aliases: ["grivna"], forms: invariant("grivna") },
};

/**
 * Turkish words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and nothing
 * else. `CURRENCIES` holds one set of words and they are English ("kronor",
 * "koruna"), so `currencyVocabulary("tr")` returns English words under a `tr`
 * label — its own doc comment says as much, and `tr.test.ts` asserts it so that
 * the day the table grows localized names, this file stops being right and that
 * test stops being green together. That is the one finding this package hands
 * upstream about the generator rather than about the language.
 *
 * What the call is still good for is the half of a currency that is *not*
 * language: the ISO code, the Latin aliases and the currency sign. So the
 * generated half stays generated exactly as in `en`, `uk`, `de` and `nl`, and the
 * two English-specific things it carries are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6).
 *   - its `forms` are dropped, every one of them, and under `tr` that is not the
 *     silent trap it is under `nl`. Dutch's `selectForm` produces the same two
 *     keys English's does, so a Dutch engine could have carried the generated
 *     table with every structural check green and printed "dollars" at a reader.
 *     Turkish's produces one key, `"other"`, which the generated table happens to
 *     declare — so the trap is *half* disarmed by shape (the `one` cell would
 *     simply never be indexed) and not at all by content: the surviving cell says
 *     "dollars", which is English and is plural besides, in a language where a
 *     counted noun is never plural. This file therefore replaces the table
 *     wholesale rather than merging into it, exactly as `nl` does.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: € is € in every orthography, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Turkish symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * **Five currencies get no Turkish word at all, for one reason with two shapes:**
 *
 *   cad, aud — Turkish names them "Kanada doları" and "Avustralya doları": the
 *     country, then the head noun `usd` already owns. Two tokens cannot be one
 *     alias, and the head is not even the bare word in them — the possessive
 *     suffix turns *dolar* into *doları* — so unlike Japanese, which lists
 *     カナダドル because its script writes no spaces, there is nothing here to close
 *     up. `en` omits display forms for exactly these two, for exactly this reason.
 *   sek, nok, czk — the same shape one level worse: "İsveç kronu", "Norveç
 *     kronu", "Çek korunası". The bare head *kron* is not merely a phrase's half,
 *     it is a word **two** of these currencies share, so claiming it would be
 *     rejected outright by `assertLocaleContract` — "does not resolve back —
 *     money:nok claims it too" — which is the check catching exactly the mistake
 *     it was written for.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Turkish speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what a Turkish price list prints for a currency it
 * has no single word for.
 *
 * **The Turkish lira is not here, and it is the one thing this file most
 * obviously wants.** `CURRENCIES` is the set ECB's daily reference file quotes
 * plus the euro, and TRY is not in it — deliberately, since a code with no rate
 * behind it can only ever raise `MissingRateError`. So there is no unit id for
 * *lira* or *TL* to name, and a `Vocabulary` may only name units the kind
 * declares. Reported rather than faked: this is a row in `@smartput/currency` and
 * a rate source that quotes it, neither of which is this package. `tr.test.ts`
 * pins the absence so the day it lands, that test fails and this paragraph gets
 * rewritten.
 *
 * Named by **id string**, like `en`, `uk`, `de` and `nl`: this file links neither
 * the rate machinery nor `Decimal`, so `@smartput/rate/locale/tr` is a
 * translation someone can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("tr").units)) {
  const words = TURKISH[code];
  units[code] = {
    aliases: [...generated.aliases, ...(words?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(words !== undefined ? { forms: words.forms } : {}),
  };
}

export default defineVocabulary({ locale: "tr", kind: "money", units });
