import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's Ukrainian half: what may be typed, and what may be printed. */
interface UkrainianWords {
  readonly aliases: readonly string[];
  /**
   * Eight keys, because `ukrainian.selectForm` keys on `` `${case}-${category}` ``
   * — the case from the slot, the category from CLDR's four — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Ukrainian words for the currencies that have one.
 *
 * Three rows deserve naming before the table, because they are the rows a
 * plural-only model cannot express and the ones easiest to get plausibly wrong:
 *
 *   `nom-few`   the 2/3/4 row      "2 долари"
 *   `nom-many`  the 5+/0/teens row "5 доларів"  — genitive plural
 *   `nom-other` the *fractional*   "1,5 долара" — genitive **singular**, not a
 *                                  plural at all. A plural here prints
 *                                  "1,5 доларів", which nothing but a reader
 *                                  would catch.
 *   `loc-*`     the conversion target, "в доларах" — locative, which is what
 *                                  `в` governs.
 *
 * Gender and declension class drive every ending, and this table happens to
 * carry four of them, which is why it is not one paradigm with the stem swapped:
 *
 *   долар, фунт, франк   masculine hard  — gen. sg. -а, gen. pl. -ів
 *   гривня               feminine soft   — gen. sg. -і, gen. pl. -ень
 *   єна                  feminine hard   — gen. sg. -и, gen. pl. is a bare stem
 *   злотий               *adjectival*    — it declines like an adjective, not
 *                                         like a noun: "два злоті", "п'ять
 *                                         злотих", "1,5 злотого"
 *   євро                 indeclinable    — one word in all eight cells
 *
 * Every form printed is also listed as an alias (`aliases` repeats what
 * `forms` holds), because a printed word recovered only by the language's
 * penalised suffix stripper is a word this vocabulary is guessing at rather
 * than declaring — and the stripper cannot recover most of these anyway:
 * "гривень" strips no listed ending, and "злотих" would have to lose an
 * adjectival one.
 */
const UKRAINIAN: Readonly<Record<string, UkrainianWords>> = {
  // Indeclinable, and the one entry whose eight cells are one word. Ukrainian
  // borrowed "євро" as a neuter noun ending in -о, which is the shape that does
  // not decline: "1 євро", "5 євро", "в 5 євро".
  eur: {
    aliases: ["євро"],
    forms: {
      "nom-one": "євро",
      "nom-few": "євро",
      "nom-many": "євро",
      "nom-other": "євро",
      "loc-one": "євро",
      "loc-few": "євро",
      "loc-many": "євро",
      "loc-other": "євро",
    },
  },
  usd: {
    aliases: [
      "долар",
      "долара",
      "долару",
      "доларі",
      "долари",
      "доларів",
      "доларам",
      "доларах",
      "доларом",
      "доларами",
      // The Ukrainian half of what `en`'s COLLOQUIAL layer is: "бакс" is the
      // borrowed "buck", and it is what a price is quoted in out loud. It reads
      // and is never printed — no `forms` cell holds it — for the same reason
      // "bucks" is an alias of `usd` next door and not its display word.
      "бакс",
      "бакса",
      "бакси",
      "баксів",
      "баксах",
    ],
    forms: {
      "nom-one": "долар",
      "nom-few": "долари",
      "nom-many": "доларів",
      "nom-other": "долара",
      "loc-one": "доларі",
      "loc-few": "доларах",
      "loc-many": "доларах",
      "loc-other": "доларах",
    },
  },
  // "фунт" is also `@smartput/mass`'s word for the pound, in this language as
  // in English ("5 pounds" is the same ambiguity), and it is left standing for
  // the same reason: the two readings are separated by the kinds installed and
  // by weight, never by taking a word away from the language that has it.
  // "стерлінг" is the colloquial clipping of "фунт стерлінгів", whose second
  // word can never be an alias — a unit word is one token.
  gbp: {
    aliases: [
      "фунт",
      "фунта",
      "фунту",
      "фунті",
      "фунти",
      "фунтів",
      "фунтам",
      "фунтах",
      "фунтом",
      "фунтами",
      "стерлінг",
      "стерлінга",
      "стерлінгів",
      "стерлінгах",
    ],
    forms: {
      "nom-one": "фунт",
      "nom-few": "фунти",
      "nom-many": "фунтів",
      "nom-other": "фунта",
      "loc-one": "фунті",
      "loc-few": "фунтах",
      "loc-many": "фунтах",
      "loc-other": "фунтах",
    },
  },
  // Feminine hard, so the genitive plural is the bare stem — "5 єн", no ending
  // — and the fractional row is "1,5 єни", the genitive singular, spelled like
  // the 2/3/4 row and identical to it for a different reason.
  //
  // "ієна" is the older transcription and still the commoner one in financial
  // writing; it reads and is not printed, because the orthography's own
  // spelling is "єна" and a vocabulary should answer in one voice.
  jpy: {
    aliases: [
      "єна",
      "єни",
      "єні",
      "єну",
      "єною",
      "єн",
      "єнам",
      "єнах",
      "єнами",
      "ієна",
      "ієни",
      "ієні",
      "ієну",
      "ієн",
      "ієнах",
    ],
    forms: {
      "nom-one": "єна",
      "nom-few": "єни",
      "nom-many": "єн",
      "nom-other": "єни",
      "loc-one": "єні",
      "loc-few": "єнах",
      "loc-many": "єнах",
      "loc-other": "єнах",
    },
  },
  chf: {
    aliases: [
      "франк",
      "франка",
      "франку",
      "франки",
      "франків",
      "франкам",
      "франках",
      "франком",
      "франками",
    ],
    forms: {
      "nom-one": "франк",
      "nom-few": "франки",
      "nom-many": "франків",
      "nom-other": "франка",
      // The locative singular of a masculine hard stem is -у, not the -і the
      // three feminines take: "в одному франку".
      "loc-one": "франку",
      "loc-few": "франках",
      "loc-many": "франках",
      "loc-other": "франках",
    },
  },
  // The adjectival one. "злотий" is a substantivised adjective in both Polish
  // and Ukrainian, so it takes adjective endings all the way through: the 2/3/4
  // row is "два злоті" (nominative plural -і, not the nominal -и), the 5+ row is
  // "п'ять злотих" (genitive plural -их), and the fractional row is "1,5
  // злотого" (genitive singular -ого). Every cell here would be wrong if the
  // masculine noun paradigm above had been copied down.
  pln: {
    aliases: ["злотий", "злотого", "злотому", "злотим", "злоті", "злотих", "злотими"],
    forms: {
      "nom-one": "злотий",
      "nom-few": "злоті",
      "nom-many": "злотих",
      "nom-other": "злотого",
      "loc-one": "злотому",
      "loc-few": "злотих",
      "loc-many": "злотих",
      "loc-other": "злотих",
    },
  },
  // Feminine soft, and the only currency here whose genitive plural is neither
  // -ів nor a bare stem: "5 гривень", with the fill vowel a soft stem takes.
  // "грн" is the abbreviation every Ukrainian price tag carries; it reads, and
  // it is not the `symbol` (see below).
  uah: {
    aliases: [
      "гривня",
      "гривні",
      "гривню",
      "гривнею",
      "гривень",
      "гривням",
      "гривнях",
      "гривнями",
      "грн",
    ],
    forms: {
      "nom-one": "гривня",
      "nom-few": "гривні",
      "nom-many": "гривень",
      "nom-other": "гривні",
      "loc-one": "гривні",
      "loc-few": "гривнях",
      "loc-many": "гривнях",
      "loc-other": "гривнях",
    },
  },
};

/**
 * Ukrainian words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what
 * that argument does today: it stamps the tag on the returned `Vocabulary` and
 * nothing else. `CURRENCIES` holds one set of words, and they are English
 * ("dollar", "kronor"), so `currencyVocabulary("uk")` returns English words
 * under a `uk` label — its own doc comment says as much. What that call is
 * still good for is the half of a currency that is *not* language: the ISO
 * code, the Latin aliases and the currency sign. So the generated half stays
 * generated exactly as in `en`, and the two English-specific things it carries
 * are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and
 *     losing them would mean "30 usd" stops parsing the moment the format
 *     locale changes — recognition is many-to-one, generation is one (design
 *     decision I6). It is the same reuse `@smartput/mass/locale/uk` performs
 *     with `aliasesFor`, and it is why "dollars" is readable here.
 *   - its `forms` are dropped, every one of them. They are keyed `one`/`other`,
 *     which is what `english.selectForm` produces; `ukrainian.selectForm` never
 *     returns either, so keeping them would leave a table the engine can only
 *     miss — and every word in them is English besides.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than
 * an oversight. A currency sign is a fact about the currency and not about a
 * language: ₴ is ₴ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Cyrillic symbol here could never be the string a formatted result carries,
 * and would only ever reach `Printer`'s `symbols: true`, giving one currency
 * two spellings that disagree. The Ukrainian abbreviation Ukrainian actually
 * writes, "грн", is therefore an *alias* of `uah`: readable, never printed.
 *
 * Five currencies get no Ukrainian word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their Ukrainian names are "канадський долар" and "австралійський
 *     долар", a qualifier plus the head noun `usd` already owns. Two tokens
 *     cannot be one alias, and the qualifier alone is an adjective that means
 *     nothing on its own. `en` omits exactly these two for exactly this reason.
 *   sek, nok, czk — Ukrainian calls all three "крона", separated only by the
 *     same kind of qualifier ("шведська", "норвезька", "чеська"). One word for
 *     three units of one kind has no reading at all: no context the engine has
 *     would separate them, so the word is left unclaimed rather than given to
 *     whichever happened to be written first.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Ukrainian speaker types for them anyway, and no `forms` — the renderer then
 * falls back to the symbol, which is what a Ukrainian price list prints for a
 * currency it has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate
 * machinery nor `Decimal`, so `@smartput/rate/locale/uk` is a translation
 * someone can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("uk").units)) {
  const ukrainian = UKRAINIAN[code];
  units[code] = {
    aliases: [...generated.aliases, ...(ukrainian?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(ukrainian !== undefined ? { forms: ukrainian.forms } : {}),
  };
}

export default defineVocabulary({ locale: "uk", kind: "money", units });
