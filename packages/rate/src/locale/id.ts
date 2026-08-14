import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Indonesian half: what may be typed, and what may be printed. */
interface IndonesianWords {
  /**
   * Only the spellings the generated table does not already carry. Indonesian
   * borrows most currency names unchanged — "euro", "yen", "franc", "zloty",
   * "hryvnia" are the same letters here — so this list is empty for five of the seven
   * entries below, and that is the whole reason this file is shorter than `uk.ts`.
   */
  readonly aliases: readonly string[];
  /**
   * **One key**, because `indonesian.selectForm` returns the constant `"other"` for
   * every count and every slot, and a table may hold exactly the keys the language
   * can ask for — no more and no fewer.
   *
   * This is the row the three-type split was designed to be able to reach, and this
   * package is where it is visible: `uk` writes eight cells per currency, `de` four,
   * `en` and `nl` two, and Indonesian writes one. There is nothing missing from it.
   * The language has no grammatical plural (plurality is reduplication or context and
   * neither survives a numeral), no gender, no case and no article, so "1 dolar" and
   * "1000 dolar" are the same string and a conversion target — "… ke dolar" — is
   * spelled exactly like a bare quantity.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * One word, in the one cell this language has. Written as a helper rather than as a
 * literal at each site for the reason `nl.ts` gives about its own two-cell version:
 * seven hand-written objects are seven chances to mistype a key, and the key is the
 * half no test can guess at.
 *
 * That there is a *single* cell is the finding, not a table stopping halfway. The
 * `nl` file next door had to argue that Dutch keeps a currency noun singular after a
 * numeral, because Dutch has a plural and chooses not to use it there — a claim that
 * is true of the construction and could stop being true. Indonesian has no plural to
 * decline to use, so the invariance is structural: there is no second form of *dolar*
 * anywhere in the language for a count to have selected.
 */
const invariant = (word: string): Readonly<Record<string, string>> => ({ other: word });

/**
 * The Indonesian words for the currencies that have one.
 *
 * **What Indonesian adds is small, and the reason is loanword orthography rather than
 * the alphabet.** Sharing the Latin script is only half of it. Indonesian's 1972
 * spelling reform (EYD) respells borrowings to match pronunciation, and for most of
 * these names the respelling is the identity: *euro*, *yen*, *franc*, *zloty* and
 * *hryvnia* are already in `CURRENCIES` and Indonesian writes them the same way. So
 * five of the seven entries add no alias at all and exist purely for their `forms`,
 * and only the two names Indonesian genuinely spells its own way earn a line.
 *
 * **No plural is listed anywhere below, and that is not an oversight.** Every other
 * translated file in this package declares plurals — `nl` writes out *ponden* and
 * *franken* because its stripper cannot reach them, `de` leaves them to a stripper
 * that can, `uk` writes six cells of them. Indonesian has none to declare. It also
 * has no stripper to fall back on: `indonesian.analyze` is a bare `identity()`, and
 * the one plausible suffix rule (taking `-an` off) would turn *satuan*, "a unit",
 * into *satu*, "one" — a noun into a numeral. So the list below is complete in the
 * strong sense: a word not here is a word that cannot be read at all.
 *
 * Every form printed is also a form read. For the five invariant loanwords the
 * generated alias already is it; for the two below the word is listed explicitly. A
 * printed form recovered only by a penalised suffix stripper would be a word this
 * vocabulary is guessing at rather than declaring — and in this language there is no
 * stripper to guess with.
 */
const INDONESIAN: Readonly<Record<string, IndonesianWords>> = {
  // "euro" is the table's own word, respelled by EYD to exactly itself.
  eur: { aliases: [], forms: invariant("euro") },
  // The first name Indonesian spells its own way, and the respelling is the rule
  // rather than an exception: a doubled consonant is simplified, so English "dollar"
  // and Dutch "dollar" are both *dolar* here. The English spelling stays readable
  // through the generated table, which is what "recognition is many-to-one" buys.
  usd: { aliases: ["dolar"], forms: invariant("dolar") },
  // The second. Indonesian writes the currency *poundsterling*, closed up — which is
  // striking in a language that otherwise never compounds, and is precisely why it is
  // listed: it is a lexicalised borrowing of the whole English phrase, not a compound
  // Indonesian built, so it arrives as one token and an alias index can hold it.
  // "Pound sterling" written apart is two tokens and cannot be one alias; the bare
  // "pound" the generated table already carries is what prints, because that is what
  // an ordinary sentence uses.
  gbp: { aliases: ["poundsterling"], forms: invariant("pound") },
  // "yen" is the table's word and is invariant in Indonesian exactly as it is in
  // English — and here for a reason that covers every noun in the language rather
  // than for the one Japanese has.
  jpy: { aliases: [], forms: invariant("yen") },
  // "franc" is the table's word. Indonesian keeps the French spelling for the
  // currency where it respells the everyday borrowing; "franc Swiss" is the phrase
  // used where it has to be told from the old French one, and it is two tokens, so
  // only the head is claimed.
  chf: { aliases: [], forms: invariant("franc") },
  // "zloty" is the table's word; Indonesian writes it without the Polish ł, which is
  // what makes the generated alias usable as it stands.
  pln: { aliases: [], forms: invariant("zloty") },
  // "hryvnia" is the spelling Indonesian reference works use, following the
  // international transliteration rather than a Dutch- or Russian-mediated one — this
  // is a recent enough borrowing that it never went through either — so the generated
  // alias is what prints and there is no older rendering to list beside it.
  uah: { aliases: [], forms: invariant("hryvnia") },
};

/**
 * Indonesian words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and nothing
 * else. `CURRENCIES` holds one set of words and they are English ("kronor",
 * "koruna"), so `currencyVocabulary("id")` returns English words under an `id` label
 * — its own doc comment says as much, and `id.test.ts` asserts it so that the day the
 * table grows localized names, this file stops being right and that test stops being
 * green together. What the call is still good for is the half of a currency that is
 * *not* language: the ISO code, the Latin aliases and the currency sign. So the
 * generated half stays generated exactly as in `en`, `uk`, `de` and `nl`, and the two
 * English-specific things it carries are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing them
 *     would mean "30 usd" stops parsing the moment the format locale changes —
 *     recognition is many-to-one, generation is one (design decision I6). Under
 *     Indonesian this reuse does more work than under any sibling: five of the seven
 *     translated currencies need no new alias at all, because the English word and
 *     the Indonesian one are the same letters.
 *   - its `forms` are dropped, every one of them, and under `id` that is not the
 *     silent trap it is under `nl`. Dutch's `selectForm` produces the same two keys
 *     English's does, so a Dutch engine could have carried the generated table with
 *     every structural check green and printed "dollars" at a reader. Indonesian's
 *     produces one key, `"other"`, which the generated table happens to declare — so
 *     the trap is *half* disarmed by shape (the `one` cell would simply never be
 *     indexed) and not at all by content: the surviving cell says "dollars", which is
 *     English and is plural besides. This file therefore replaces the table
 *     wholesale rather than merging into it, exactly as `nl` does.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a language:
 * € is € in every orthography, and `money`'s format hook prints `symbolOf(code)` from
 * the same table without ever consulting a locale — so an Indonesian symbol here
 * could never be the string a formatted result carries, and would only ever reach
 * `Printer`'s `symbols: true`, giving one currency two spellings that disagree.
 *
 * **Five currencies get no Indonesian word at all, for one reason with two shapes:**
 *
 *   cad, aud — Indonesian names them "dolar Kanada" and "dolar Australia": the head
 *     noun `usd` already owns, followed by the country. Two tokens cannot be one
 *     alias, the country name alone is a country, and — unlike Japanese, which lists
 *     カナダドル because its script writes no spaces — this language never closes such
 *     a phrase up. `en` omits display forms for exactly these two, for exactly this
 *     reason.
 *   sek, nok, czk — the same shape one level worse: "krona Swedia", "krone Norwegia",
 *     "koruna Ceko". The heads are already the generated table's own words for those
 *     three currencies, so nothing is lost; what cannot be added is the qualifier,
 *     because it is a separate token.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what an
 * Indonesian speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what an Indonesian price list prints for a currency it
 * has no word for.
 *
 * **The rupiah is not here, and it is the one thing this file most obviously wants.**
 * `CURRENCIES` is the set ECB's daily reference file quotes plus the euro, and IDR is
 * not in it — deliberately, since a code with no rate behind it can only ever raise
 * `MissingRateError`. So there is no unit id for *rupiah* to name, and a `Vocabulary`
 * may only name units the kind declares. Reported rather than faked: this is a row in
 * `@smartput/currency` and a rate source that quotes it, neither of which is this
 * package. `id.test.ts` pins the absence so the day it lands, that test fails and
 * this paragraph gets rewritten.
 *
 * Named by **id string**, like `en`, `uk`, `de` and `nl`: this file links neither the
 * rate machinery nor `Decimal`, so `@smartput/rate/locale/id` is a translation
 * someone can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("id").units)) {
  const words = INDONESIAN[code];
  units[code] = {
    aliases: [...generated.aliases, ...(words?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(words !== undefined ? { forms: words.forms } : {}),
  };
}

export default defineVocabulary({ locale: "id", kind: "money", units });
