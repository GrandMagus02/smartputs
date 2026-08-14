import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Russian half: what may be typed, and what may be printed. */
interface RussianWords {
  readonly aliases: readonly string[];
  /**
   * Eight keys, because `russian.selectForm` keys on `` `${case}-${category}` ``
   * — the case from the slot, the category from CLDR's four — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Russian words for the currencies that have one.
 *
 * Four rows deserve naming before the table, because they are the rows a
 * plural-only model cannot express and the ones easiest to get plausibly wrong:
 *
 *   `nom-one`   the 1/21/31 row    "1 доллар"   nominative singular
 *   `nom-few`   the 2/3/4 row      "2 доллара"  genitive **singular**
 *   `nom-many`  the 5+/0/teens row "5 долларов" genitive plural
 *   `nom-other` the *fractional*   "1,5 доллара" genitive singular again
 *   `loc-*`     the conversion target, "в долларах" — prepositional, which is
 *                                  what `в` governs
 *
 * The Russian shape of `nom-few` is the one thing a translator porting `uk`
 * must not carry across. Ukrainian's 2/3/4 row is a *nominative plural* ("2
 * долари") and its fractional row a genitive singular ("1,5 долара") — two
 * different words. Russian's are one and the same word, the genitive singular,
 * for two different grammatical reasons: the 2/3/4 form is the old dual, and the
 * fractional form is the genitive a fraction governs. Copying `uk`'s table and
 * swapping stems produces "2 доллары", which is wrong, and no shape-based test
 * would catch it — every key would still be present.
 *
 * Gender and declension class drive every ending, and this table happens to
 * carry four of them, which is why it is not one paradigm with the stem swapped:
 *
 *   доллар, фунт, франк   masculine hard  — gen. sg. -а, gen. pl. -ов,
 *                                           prep. sg. -е
 *   гривна, иена          feminine hard   — gen. sg. -ы, gen. pl. a bare stem
 *                                           ("5 гривен", "5 иен"), prep. sg. -е
 *   злотый                *adjectival*    — it declines like an adjective, not
 *                                           like a noun: "два злотых", "пять
 *                                           злотых", "1,5 злотого"
 *   евро                  indeclinable    — one word in all eight cells
 *
 * Every form printed is also listed as an alias (`aliases` repeats what `forms`
 * holds), because a printed word recovered only by the language's penalised
 * suffix stripper is a word this vocabulary is guessing at rather than declaring
 * — and the stripper cannot recover several of these anyway: "гривен" and "иен"
 * strip nothing at all, and "злотых" would have to lose an adjectival ending
 * that is not in the list.
 */
const RUSSIAN: Readonly<Record<string, RussianWords>> = {
  // Indeclinable, and the one entry whose eight cells are one word. Russian
  // borrowed "евро" as a masculine noun ending in -о, which is the shape that
  // does not decline: "1 евро", "5 евро", "в 5 евро".
  eur: {
    aliases: ["евро"],
    forms: {
      "nom-one": "евро",
      "nom-few": "евро",
      "nom-many": "евро",
      "nom-other": "евро",
      "loc-one": "евро",
      "loc-few": "евро",
      "loc-many": "евро",
      "loc-other": "евро",
    },
  },
  usd: {
    aliases: [
      "доллар",
      "доллара",
      "доллару",
      "долларом",
      "долларе",
      "доллары",
      "долларов",
      "долларам",
      "долларах",
      "долларами",
      // The Russian half of what `en`'s COLLOQUIAL layer is: "бакс" is the
      // borrowed "buck", and it is what a price is quoted in out loud. It reads
      // and is never printed — no `forms` cell holds it — for the same reason
      // "bucks" is an alias of `usd` next door and not its display word.
      "бакс",
      "бакса",
      "баксом",
      "баксы",
      "баксов",
      "баксах",
    ],
    forms: {
      "nom-one": "доллар",
      "nom-few": "доллара",
      "nom-many": "долларов",
      "nom-other": "доллара",
      "loc-one": "долларе",
      "loc-few": "долларах",
      "loc-many": "долларах",
      "loc-other": "долларах",
    },
  },
  // "фунт" is also `@smartput/mass`'s word for the pound, in this language as in
  // English ("5 pounds" is the same ambiguity), and it is left standing for the
  // same reason: the two readings are separated by the kinds installed and by
  // weight, never by taking a word away from the language that has it.
  // "стерлинг" is the colloquial clipping of "фунт стерлингов", whose second
  // word can never be an alias — a unit word is one token.
  gbp: {
    aliases: [
      "фунт",
      "фунта",
      "фунту",
      "фунтом",
      "фунте",
      "фунты",
      "фунтов",
      "фунтам",
      "фунтах",
      "фунтами",
      "стерлинг",
      "стерлинга",
      "стерлингов",
      "стерлингах",
    ],
    forms: {
      "nom-one": "фунт",
      "nom-few": "фунта",
      "nom-many": "фунтов",
      "nom-other": "фунта",
      "loc-one": "фунте",
      "loc-few": "фунтах",
      "loc-many": "фунтах",
      "loc-other": "фунтах",
    },
  },
  // Feminine hard, so the genitive plural is the bare stem — "5 иен", no ending
  // — and the 2/3/4 row and the fractional row are both "иены", the genitive
  // singular.
  //
  // "йена" is the transcription a Russian keyboard produces from the English
  // spelling and it is still seen in the financial press; the orthographic norm
  // is "иена", so that is what prints, and a vocabulary should answer in one
  // voice.
  jpy: {
    aliases: [
      "иена",
      "иены",
      "иене",
      "иену",
      "иеной",
      "иен",
      "иенам",
      "иенах",
      "иенами",
      "йена",
      "йены",
      "йене",
      "йену",
      "йен",
      "йенах",
    ],
    forms: {
      "nom-one": "иена",
      "nom-few": "иены",
      "nom-many": "иен",
      "nom-other": "иены",
      "loc-one": "иене",
      "loc-few": "иенах",
      "loc-many": "иенах",
      "loc-other": "иенах",
    },
  },
  chf: {
    aliases: [
      "франк",
      "франка",
      "франку",
      "франком",
      "франке",
      "франки",
      "франков",
      "франкам",
      "франках",
      "франками",
    ],
    forms: {
      "nom-one": "франк",
      "nom-few": "франка",
      "nom-many": "франков",
      "nom-other": "франка",
      // The prepositional singular of a masculine hard stem is -е, where
      // Ukrainian's is -у ("в франку"): "в одном франке". One of the several
      // places the two Slavic tables must not be each other's copy.
      "loc-one": "франке",
      "loc-few": "франках",
      "loc-many": "франках",
      "loc-other": "франках",
    },
  },
  // The adjectival one. "злотый" is a substantivised adjective in Polish and in
  // Russian alike, so it takes adjective endings all the way through — and, as
  // adjectival nouns do, it takes the genitive *plural* after 2/3/4 where an
  // ordinary noun takes the genitive singular: "два злотых", not "два злотого".
  // The 5+ row is the same "злотых", the fractional row is "1,5 злотого"
  // (genitive singular -ого) and the prepositional singular is "злотом". Every
  // cell here would be wrong if the masculine noun paradigm above had been
  // copied down.
  pln: {
    aliases: [
      "злотый",
      "злотого",
      "злотому",
      "злотым",
      "злотом",
      "злотые",
      "злотых",
      "злотыми",
    ],
    forms: {
      "nom-one": "злотый",
      "nom-few": "злотых",
      "nom-many": "злотых",
      "nom-other": "злотого",
      "loc-one": "злотом",
      "loc-few": "злотых",
      "loc-many": "злотых",
      "loc-other": "злотых",
    },
  },
  // Feminine hard in Russian — "гривна", not Ukrainian's soft "гривня" — so the
  // genitive plural is "гривен" with the fill vowel a bare stem takes, and the
  // genitive singular is "гривны" where Ukrainian has "гривні". The Ukrainian
  // shapes are listed as *aliases* because Russian writing about Ukraine quotes
  // them and a reader may type either; they are never printed. "грн" is the
  // abbreviation every price tag carries; it reads, and it is not the `symbol`
  // (see below).
  uah: {
    aliases: [
      "гривна",
      "гривны",
      "гривне",
      "гривну",
      "гривной",
      "гривен",
      "гривнам",
      "гривнах",
      "гривнами",
      "гривня",
      "гривень",
      "грн",
    ],
    forms: {
      "nom-one": "гривна",
      "nom-few": "гривны",
      "nom-many": "гривен",
      "nom-other": "гривны",
      "loc-one": "гривне",
      "loc-few": "гривнах",
      "loc-many": "гривнах",
      "loc-other": "гривнах",
    },
  },
};

/**
 * Russian words for the currencies, layered over the generated table.
 *
 * **There is no rouble here, and that is the kind's shape rather than this
 * file's decision.** `@smartput/currency`'s `CURRENCIES` holds twelve ISO codes
 * and `rub` is not among them, so `money` declares no unit for it — and a
 * `Vocabulary` names units, it cannot add them. A Russian speaker's own currency
 * is therefore unreachable in a Russian engine, which is worth saying out loud
 * rather than leaving to be discovered: the fix is a row in `CURRENCIES` and a
 * quote in whatever snapshot is loaded, both on the language-free side of the
 * split, and neither is a translator's to make.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and
 * nothing else. `CURRENCIES` holds one set of words, and they are English
 * ("dollar", "kronor"), so `currencyVocabulary("ru")` returns English words
 * under a `ru` label — its own doc comment says as much, and `ru.test.ts` pins
 * it so that the day the table grows localized names, this file stops being
 * right and that test stops being green together. What the call is still good
 * for is the half of a currency that is *not* language: the ISO code, the Latin
 * aliases and the currency sign. So the generated half stays generated exactly
 * as in `en` and `uk`, and the two English-specific things it carries are
 * handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale
 *     changes — recognition is many-to-one, generation is one (design decision
 *     I6). It is the same reuse `@smartput/mass/locale/ru` performs with
 *     `aliasesFor`, and it is why "dollars" is readable here.
 *   - its `forms` are dropped, every one of them. They are keyed `one`/`other`,
 *     which is what `english.selectForm` produces; `russian.selectForm` never
 *     returns either, so keeping them would leave a table the engine can only
 *     miss — and every word in them is English besides.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than
 * an oversight. A currency sign is a fact about the currency and not about a
 * language: ₴ is ₴ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Cyrillic symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree. The Russian abbreviation Russian actually writes,
 * "грн", is therefore an *alias* of `uah`: readable, never printed.
 *
 * Five currencies get no Russian word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their Russian names are "канадский доллар" and "австралийский
 *     доллар", a qualifier plus the head noun `usd` already owns. Two tokens
 *     cannot be one alias, and the qualifier alone is an adjective that means
 *     nothing on its own. `en` omits exactly these two for exactly this reason.
 *   sek, nok, czk — Russian calls all three "крона", separated only by the same
 *     kind of qualifier ("шведская", "норвежская", "чешская"). One word for
 *     three units of one kind has no reading at all: no context the engine has
 *     would separate them, so the word is left unclaimed rather than given to
 *     whichever happened to be written first. Unlike German — where "Krone" is
 *     already `nok`'s own generated alias and the collision is decided for us —
 *     nothing in the Latin table claims the Cyrillic word, so leaving it out is
 *     an actual choice.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Russian speaker types for them anyway, and no `forms` — the renderer then
 * falls back to the symbol, which is what a Russian price list prints for a
 * currency it has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/ru` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("ru").units)) {
  const russian = RUSSIAN[code];
  units[code] = {
    aliases: [...generated.aliases, ...(russian?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(russian !== undefined ? { forms: russian.forms } : {}),
  };
}

export default defineVocabulary({ locale: "ru", kind: "money", units });
