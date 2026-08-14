import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Dutch half: what may be typed, and what may be printed. */
interface DutchWords {
  /**
   * Only the spellings the generated table does not already carry. Most currency
   * names are international and Dutch borrows them unchanged — "euro", "dollar",
   * "yen", "zloty" are the same letters in both languages — so this list is empty
   * for four of the seven entries below, and that is the whole reason this file is
   * shorter than `uk.ts`.
   */
  readonly aliases: readonly string[];
  /**
   * Two keys, because `dutch.selectForm` returns the bare CLDR plural category —
   * `Intl.PluralRules("nl")` declares only `one` and `other` — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer.
   *
   * English's shape, not German's four. Modern Dutch has no case marking left on
   * common nouns, so `in`, `naar` and `van` govern nothing and a conversion target
   * is spelled exactly like a bare quantity; there is no second axis for the table
   * to carry.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The two cells, spelled once. Every currency in this table fills both with the
 * same word, so writing the object out seven times would be seven chances to
 * mistype one.
 *
 * **That the two coincide is Dutch, not a table stopping halfway.** Dutch keeps a
 * noun of measure, quantity or currency in the **singular** after a numeral —
 * "vijf euro", "twintig pond", "honderd dollar", "vijftig frank", never "vijf
 * euro's" for an amount — which is the same rule that gives "tien meter" and "drie
 * jaar", and it is written out in `@smartput/core/locale/nl`'s own doc comment as
 * the thing Dutch brings that neither German nor English does. So the number axis
 * is inert here, which is the opposite of the `minuut`/`minuten` case that same
 * comment warns about: a vocabulary that writes one word twice is correct *when the
 * noun is invariant*, and wrong the moment it is not.
 *
 * The free plurals are real all the same — *euro's*, *ponden*, *franken* — and
 * every one of them is readable, either as a listed alias below or through
 * `dutch.analyze`'s `'s` stripper, which exists in that chain precisely because
 * Dutch writes the plural of a vowel-final noun with an apostrophe. None of them is
 * ever printed.
 */
const invariant = (word: string): Readonly<Record<string, string>> => ({
  one: word,
  other: word,
});

/**
 * The Dutch words for the currencies that have one.
 *
 * **What Dutch adds is small, and the reason is the alphabet.** `uk.ts` next door
 * has to spell every currency out, because nothing in the generated table is
 * typeable on a Ukrainian layout. Dutch shares the Latin alphabet and, for most of
 * these names, the spelling: *euro*, *dollar*, *yen* and *zloty* are already in
 * `CURRENCIES` and Dutch writes them identically — with no capital to fold away
 * either, since Dutch capitalises no noun, which is one of the few places this
 * language is *simpler* than German rather than merely different. So those four
 * entries add no alias at all and exist purely for their `forms`, and only the
 * three names Dutch genuinely spells its own way earn a line.
 *
 * **Plurals are listed here that a German file would have left to its stripper,
 * and that is a language-level consequence rather than a choice about money.**
 * `dutch.analyze` deliberately does not strip `en`: the main Dutch plural shortens
 * an open syllable or doubles a consonant, so stripping it yields a stem that is
 * not the singular in exactly the cases the rule would be needed for. *Ponden* and
 * *franken* are that case, so both are declared. *Euro's* is not: the `'s` stripper
 * takes the apostrophe-plural off a vowel-final noun and lands on the word the
 * generated table already carries, so listing it would be a duplicate candidate at
 * every keystroke.
 *
 * Every form printed is also a form read: for the four invariant loanwords the
 * generated alias already is it, and for the three below the word is listed
 * explicitly. A printed form recovered only by the language's penalised suffix
 * stripper would be a word this vocabulary is guessing at rather than declaring.
 */
const DUTCH: Readonly<Record<string, DutchWords>> = {
  // "euro" is the table's own word. Dutch counts it in the singular after a
  // numeral ("vijf euro"); the plural "euro's" is what you say of *coins* rather
  // than of an amount, and the language's `'s` stripper reaches it anyway.
  eur: { aliases: [], forms: invariant("euro") },
  // Likewise "dollar", and likewise singular after a numeral: "honderd dollar".
  usd: { aliases: [], forms: invariant("dollar") },
  // The first name Dutch spells its own way. "Pond" is also `@smartput/mass`'s
  // word in this language — a Dutch pond is 500 g — and it is left standing here
  // for the reason Ukrainian leaves "фунт" standing: the two readings are separated
  // by the kinds an engine installed and by weight, never by taking a word away
  // from the language that has it. "Pond sterling" is two tokens and can never be
  // one alias, so only the head is claimed. "Ponden" is the free plural, listed
  // because Dutch's stripper cannot reach it.
  gbp: { aliases: ["pond", "ponden"], forms: invariant("pond") },
  // "Yen" is the table's word already, and it is invariant in Dutch exactly as it
  // is in English.
  jpy: { aliases: [], forms: invariant("yen") },
  // The second. Dutch does not call the Swiss currency a franc: it is de frank,
  // and "Zwitserse frank" — the phrase used wherever it has to be told apart from
  // the old French one — is an adjective plus a noun and therefore two tokens, so
  // only the head is claimed. Dutch writes an inflected adjective apart from its
  // noun as firmly as it writes a noun-plus-noun compound together, so there is no
  // closed-up spelling to enumerate the way `de.ts` enumerates *Schweizerfranken*.
  chf: { aliases: ["frank", "franken"], forms: invariant("frank") },
  // "Zloty" is the table's word; Dutch writes it without the Polish ł, which is
  // what makes the generated alias usable as it stands.
  pln: { aliases: [], forms: invariant("zloty") },
  // The third. "Hryvnia" is the spelling Dutch reference works use and the one the
  // generated table already carries, so it is what prints; "grivna" is the older
  // rendering still common in the press and is listed for reading. Dutch has
  // borrowed the name without naturalising its paradigm, so it is counted in the
  // singular — "vijf hryvnia" — the way "vijf yen" is.
  uah: { aliases: ["grivna"], forms: invariant("hryvnia") },
};

/**
 * Dutch words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and nothing
 * else. `CURRENCIES` holds one set of words and they are English ("kronor",
 * "koruna"), so `currencyVocabulary("nl")` returns English words under an `nl`
 * label — its own doc comment says as much, and `nl.test.ts` asserts it so that the
 * day the table grows localized names, this file stops being right and that test
 * stops being green together. What the call is still good for is the half of a
 * currency that is *not* language: the ISO code, the Latin aliases and the currency
 * sign. So the generated half stays generated exactly as in `en`, `uk` and `de`,
 * and the two English-specific things it carries are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes —
 *     recognition is many-to-one, generation is one (design decision I6). Under
 *     Dutch this reuse does as much work as it does under German: four of the seven
 *     translated currencies need no new alias at all, because the English word and
 *     the Dutch one are the same letters.
 *   - its `forms` are dropped, every one of them. They are keyed `one`/`other`,
 *     which is what `dutch.selectForm` produces too — so unlike German, Dutch could
 *     have *kept* the generated table without the engine ever missing a key, and
 *     that is exactly the trap. The keys match and the words do not: "dollars" is
 *     English, where Dutch counts "dollar". Keeping them would have shipped English
 *     plurals under a Dutch tag with every structural check still green, which is
 *     why this file replaces the table wholesale rather than merging into it.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a language:
 * € is € in every orthography, and `money`'s format hook prints `symbolOf(code)`
 * from the same table without ever consulting a locale — so a Dutch symbol here
 * could never be the string a formatted result carries, and would only ever reach
 * `Printer`'s `symbols: true`, giving one currency two spellings that disagree.
 *
 * **Five currencies get no Dutch word at all, for two reasons worth telling
 * apart:**
 *
 *   cad, aud — their Dutch names are "Canadese dollar" and "Australische dollar":
 *     an adjective plus the head noun `usd` already owns. Two tokens cannot be one
 *     alias, the adjective alone means nothing, and Dutch orthography writes an
 *     inflected adjective apart from its noun, so there is no closed-up compound to
 *     fall back on either. `en` omits display forms for exactly these two, for
 *     exactly this reason.
 *   sek, nok, czk — Dutch calls all three "kroon", separated only by the same kind
 *     of adjective ("Zweedse", "Noorse", "Tsjechische"). One word for three units of
 *     one kind has no reading at all, so it is left unclaimed rather than handed to
 *     whichever was written first.
 *
 * That last case differs from German's in a way worth recording, because the
 * conclusion survives the difference. German's "Krone" was *already* an alias of
 * `nok` in the generated table — it is that currency's own Norwegian name — so
 * claiming it for `sek` would have failed `assertLocaleContract`'s rival check
 * outright. Dutch's "kroon" is spelled with two o's and collides with nothing: it is
 * free, and it is still left unclaimed, because a word that three units of one kind
 * would answer to is not a reading whatever the index says. What a Dutch reader
 * typing the plural gets is the same answer German's gets, by the same route: the
 * language's `n` stripper takes "kronen" to "krone", which the generated table
 * already indexed as `nok`, and `nl.test.ts` pins that.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Dutch speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what a Dutch price list prints for a currency it has
 * no word for.
 *
 * Named by **id string**, like `en`, `uk` and `de`: this file links neither the rate
 * machinery nor `Decimal`, so `@smartput/rate/locale/nl` is a translation someone
 * can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("nl").units)) {
  const words = DUTCH[code];
  units[code] = {
    aliases: [...generated.aliases, ...(words?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(words !== undefined ? { forms: words.forms } : {}),
  };
}

export default defineVocabulary({ locale: "nl", kind: "money", units });
