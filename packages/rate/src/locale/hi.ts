import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Hindi half: what may be typed, and what may be printed. */
interface HindiWords {
  readonly aliases: readonly string[];
  /**
   * Exactly two keys, because `hindi.selectForm` returns CLDR's `one` and
   * `other` and nothing else — a table may hold exactly the keys the language
   * can ask for, no more and no fewer.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Hindi words for the currencies that have one.
 *
 * **Both rows hold the same word in every entry, and that is a fact about Hindi
 * rather than a table left half-filled.** डॉलर, पाउंड, येन and फ़्रैंक are
 * consonant-final masculine loanwords, and a consonant-final masculine noun's
 * direct plural is identical to its direct singular: Hindi says "पाँच डॉलर", not
 * "डॉलरें". यूरो is invariable for a second reason — it ends in ो, which is not
 * the ा that becomes े — the same shape Russian's "евро" has, arrived at from a
 * different direction. So a `one`/`other` split records a distinction the
 * language does not draw here, and a translator who "filled in" a plural would be
 * inventing one.
 *
 * What Hindi *does* inflect is the **oblique plural** — "सौ डॉलरों में", the form
 * a noun takes in front of a postposition once it is plural — and that is
 * precisely the form the `in` keywords (में, को, से) put a unit into. It is a
 * form the reader needs and the printer never does, so it is an alias here and
 * not a row in `forms`. `hindi`'s suffix stripper recovers it at `weight: -2`;
 * listing it means the commonest *typed* spelling in a conversion is read at full
 * weight rather than through a penalised guess. That is the same reasoning
 * `ar.ts` gives for listing the bare tamyīz beside the marked one.
 *
 * The interesting cell is therefore not the plural but the **boundary**. Hindi's
 * `one` is CLDR's `i = 0 or n = 1`, so 0 and every fraction below 1 select it
 * where English puts 0 in `other` — a table ported from `en` by translating two
 * strings in place would be wrong for zero and right for everything else, which
 * is the kind of error nothing but a test finds. Here both rows hold one word, so
 * the boundary moves nothing; `hi.test.ts` pins it anyway, because the day one of
 * these currencies gains a genuinely plural word the assertion is already there.
 *
 * Every form printed is also listed as an alias, because a printed word
 * recovered only by the language's penalised suffix stripper is a word this
 * vocabulary is guessing at rather than declaring.
 *
 * The nukta is written **decomposed** where one appears. फ़ (U+095E) is a Unicode
 * composition exclusion and NFKC — applied by `normalize()` before a word reaches
 * the resolver — splits it into फ + U+093C, so a precomposed फ़्रैंक would test
 * green against this table and be unreachable through the engine. `hi.test.ts`
 * asserts NFKC-stability over every alias and every form. The nukta's *absence*
 * is a different matter no normalization fixes, so फ्रैंक is declared beside
 * फ़्रैंक: they are different letters and there is no way to know which one a
 * keyboard produced.
 */
const HINDI: Readonly<Record<string, HindiWords>> = {
  // Invariable because it ends in ो: Hindi declines masculine nouns ending in ा
  // (कमरा → कमरे) and leaves everything else alone, so यूरो has no plural and no
  // oblique plural to list either.
  eur: {
    aliases: ["यूरो"],
    forms: { one: "यूरो", other: "यूरो" },
  },
  // डालर is the same word with a plain ा where डॉलर writes the candrabindu-less
  // ऑ; both are in current Devanagari print and neither folds onto the other.
  // डॉलरों is the oblique plural, which the postpositions demand.
  usd: {
    aliases: ["डॉलर", "डालर", "डॉलरों"],
    forms: { one: "डॉलर", other: "डॉलर" },
  },
  // पाउंड is also `@smartput/mass`'s Hindi word for the pound *weight*. It is
  // left standing in both places for the reason `ru` leaves "фунт" standing: the
  // two readings are separated by the kinds installed and by weight, never by
  // taking a word away from the language that has it. स्टर्लिंग is the adjective
  // that says *which* pound and can never be part of the unit word — "पाउंड
  // स्टर्लिंग" is two tokens — so it is listed on its own, read but never
  // printed, the way `en` lists "sterling".
  gbp: {
    aliases: ["पाउंड", "पौंड", "पाउंडों", "स्टर्लिंग"],
    forms: { one: "पाउंड", other: "पाउंड" },
  },
  jpy: {
    aliases: ["येन", "येनों"],
    forms: { one: "येन", other: "येन" },
  },
  chf: {
    aliases: ["फ़्रैंक", "फ्रैंक", "फ़्रैंकों", "फ्रैंकों"],
    forms: { one: "फ़्रैंक", other: "फ़्रैंक" },
  },
};

/**
 * Hindi words for the currencies, layered over the generated table.
 *
 * **The generated `forms` must be dropped, and in Hindi that is not the
 * housekeeping it is next door.** `currencyVocabulary` takes a locale and it is
 * worth stating exactly what that argument does today: it stamps the tag on the
 * returned `Vocabulary` and nothing else. `CURRENCIES` holds one set of words and
 * they are English ("dollar", "kronor"), so `currencyVocabulary("hi")` returns
 * **English words under a `hi` label** — its own doc comment says as much, and
 * `hi.test.ts` pins it so that the day the table grows localized names, this file
 * stops being right and that test stops being green together.
 *
 * Those generated forms are keyed `one` and `other`. For `ar` — six CLDR
 * categories — and for `uk` — eight `${case}-${category}` keys — keeping them
 * would have left a table the engine can only *miss*, which is untidy and inert.
 * Hindi's key set is `one`/`other` **exactly**, so a generated table left in
 * place would not be missed at all: `hindi.selectForm` would index it and the
 * renderer would print the English word "dollars" inside a Hindi sentence, and
 * nothing would throw. Hindi is the first language shipped here where the wrong
 * answer is silent rather than absent, so the drop is unconditional — including
 * for the seven currencies below that get no Hindi word, where the renderer then
 * falls back to the symbol, which is what an Indian price list prints for a
 * currency it has no word for. `hi.test.ts` asserts that no `forms` value
 * anywhere in this file is Latin.
 *
 *   - the generated `aliases` are **kept**, all of them. Reading them costs
 *     nothing and losing them would mean "30 usd" stops parsing the moment the
 *     format locale changes — recognition is many-to-one, generation is one
 *     (design decision I6). It is the same reuse `@smartput/temperature/locale/hi`
 *     performs with `aliasesFor`, and it is why "dollars" is readable here.
 *   - `symbol` is the generated one throughout, and that is a decision rather
 *     than an oversight. A currency sign is a fact about the currency and not
 *     about a language: ₴ is ₴ in every script, and `money`'s format hook prints
 *     `symbolOf(code)` from the same table without ever consulting a locale — so
 *     a Devanagari symbol here could never be the string a formatted result
 *     carries, and would only ever reach `Printer`'s `symbols: true`, giving one
 *     currency two spellings that disagree.
 *
 * **There is no rupee here, and that is the kind's shape rather than this file's
 * decision.** `@smartput/currency`'s `CURRENCIES` holds the twelve codes ECB's
 * daily reference file quotes plus the euro; INR is not among them, so `money`
 * declares no unit for it — and a `Vocabulary` names units, it cannot add them.
 * The currency of the country this language is spoken in is therefore unreachable
 * in a Hindi engine, which is worth saying out loud rather than leaving to be
 * discovered: रुपया, रुपये and ₹ have nothing to attach to. The fix is a row in
 * `CURRENCIES` and a quote in whatever snapshot is loaded, both on the
 * language-free side of the split, and neither is a translator's to make. This is
 * the same absence `ru.ts` records about the rouble and `ar.ts` about the dirham,
 * and for Hindi it is the one that matters most.
 *
 * Seven of the twelve get no Hindi word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — Hindi names them "कनाडाई डॉलर" and "ऑस्ट्रेलियाई डॉलर", a head
 *     noun `usd` already owns plus a nationality adjective. Two tokens cannot be
 *     one alias, and the adjective alone means nothing on its own. `en` omits
 *     display forms for exactly these two for exactly this reason.
 *   sek, nok, czk — Hindi calls all three "क्रोना", separated only by the same
 *     kind of adjective ("स्वीडिश", "नॉर्वेजियन", "चेक"). One word for three
 *     units of one kind has no reading at all: no context the engine has would
 *     separate them, so the word is left unclaimed rather than given to whichever
 *     happened to be written first. Unlike German — where "Krone" is already
 *     `nok`'s own generated alias and the collision is decided upstream — nothing
 *     in the Latin table spells the Devanagari word, so leaving it out is an
 *     actual choice.
 *   pln, uah — the same two-token shape as cad/aud: Hindi financial writing sets
 *     "पोलिश ज़्लॉटी" and "यूक्रेनी रिव्निया", and the bare head noun is not in
 *     settled Devanagari use on its own — an Indian business page writes PLN and
 *     UAH in Latin. A transliteration invented here would be a word this
 *     vocabulary is guessing at, which is the thing every other row in this file
 *     is careful not to do. The codes stay typeable, which is how a Hindi reader
 *     reaches them today.
 *
 * All seven keep their ISO codes and the table's Latin aliases, which is what a
 * Hindi speaker types for them anyway.
 *
 * **Devanagari digits are inherited and left alone.**
 * `@smartput/core/locale/hi` documents why "३०" does not lex, so amounts read and
 * print with Latin digits — "30.00", "4,090.91". The second of those is also
 * where Hindi's grouping gap shows: `Intl.NumberFormat("hi")` groups by lakh and
 * crore (1,00,000, not 100,000) and `formatNumber` inserts a separator every
 * three digits because `NumberFormatSpec` carries no grouping *rule*. Money is
 * the kind where an Indian reader notices that first — a crore of rupees is
 * written 1,00,00,000 on every page in the country — so `hi.test.ts` pins the
 * engine's output beside `Intl`'s. The round trip is unaffected: the reader
 * strips every separator wherever it falls.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/hi` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("hi").units)) {
  const hindi = HINDI[code];
  units[code] = {
    aliases: [...generated.aliases, ...(hindi?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(hindi !== undefined ? { forms: hindi.forms } : {}),
  };
}

export default defineVocabulary({ locale: "hi", kind: "money", units });
