import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's German half: what may be typed, and what may be printed. */
interface GermanWords {
  /**
   * Only the spellings the generated table does not already carry. Most
   * currency names are international and German borrows them unchanged — "Euro",
   * "Dollar", "Yen", "Zloty" are the same letters in both languages — so this
   * list is empty for four of the seven entries below, and that is the whole
   * reason this file is shorter than `uk.ts`.
   */
  readonly aliases: readonly string[];
  /**
   * Four keys, because `german.selectForm` keys on
   * `` `${case}-${category}` `` — the case from the slot, the category from
   * `Intl.PluralRules("de")`, which declares only `one` and `other` — and a
   * table may hold exactly the keys the language can ask for, no more and no
   * fewer.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The four cells, spelled once. Every currency in this table fills all four with
 * the same word, so writing the object out seven times would be seven chances to
 * mistype one.
 *
 * **That the four coincide is German, not a table stopping halfway.** Standard
 * German leaves a masculine or neuter noun of measure, quantity or currency
 * *uninflected* after a cardinal — "fünf Euro", "zwanzig Pfund", "hundert
 * Dollar", never "fünf Euros" — and the dative plural such a noun would
 * otherwise take ("mit fünf Euros") is exactly what that rule suppresses. So
 * both of `german.selectForm`'s axes are inert here at once, which is the
 * opposite of the `Meile/Meilen` case the language's own doc comment warns
 * about: a vocabulary that writes one word four times is correct *when the noun
 * is invariant*, and wrong the moment it is not.
 *
 * `Franken` is invariant for a second reason stacked on the first: its plural is
 * already "Franken", so a dative plural has no -n left to add.
 *
 * The one place German *would* mark the number axis in this kind is a feminine
 * currency noun that has been naturalised far enough to take a German plural —
 * "eine Krone" against "fünf Kronen" — and no such name reaches this table. The
 * three Kronen are unclaimable for a different reason entirely (see the note at
 * the bottom of the file), and `uah`'s "die Hrywnja" *is* feminine but is a
 * recent borrowing German counts the way it counts "fünf Yen": uninflected,
 * with the plural "Hrywnjas" reserved for coins rather than amounts. So the
 * number axis stays inert here — but by two different routes, and the day a
 * feminine name with a live German plural is added it will have to move.
 */
const invariant = (word: string): Readonly<Record<string, string>> => ({
  "nom-one": word,
  "nom-other": word,
  "dat-one": word,
  "dat-other": word,
});

/**
 * The German words for the currencies that have one.
 *
 * **What German adds is small, and the reason is the alphabet.** `uk.ts` next
 * door has to spell every currency out, because nothing in the generated table
 * is typeable on a Ukrainian layout. German shares the Latin alphabet and, for
 * most of these names, the spelling: *Euro*, *Dollar*, *Yen* and *Zloty* are
 * already in `CURRENCIES`, and the only thing German does to them is capitalise
 * — which the alias index folds away. So those four entries add no alias at all
 * and exist purely for their `forms`, and only the three names German genuinely
 * spells its own way earn a line.
 *
 * Every form printed is also a form read: for the four invariant loanwords the
 * generated alias already is it, and for the three below the word is listed
 * explicitly. A printed form recovered only by the language's penalised suffix
 * stripper would be a word this vocabulary is guessing at rather than declaring.
 */
const GERMAN: Readonly<Record<string, GermanWords>> = {
  // "Euro" is the table's own word, capitalised. German counts it uninflected
  // after a cardinal ("fünf Euro"); the colloquial plural "Euros" exists for
  // *coins* rather than for an amount, and it is already an alias besides.
  eur: { aliases: [], forms: invariant("Euro") },
  // Likewise "Dollar", and likewise uninflected: "hundert Dollar".
  usd: { aliases: [], forms: invariant("Dollar") },
  // The first name German spells its own way. "Pfund" is also
  // `@smartput/mass`'s word in this language — a German Pfund is 500 g — and it
  // is left standing here for the reason Ukrainian leaves "фунт" standing: the
  // two readings are separated by the kinds an engine installed and by weight,
  // never by taking a word away from the language that has it. "Sterling" is the
  // clipping of "Pfund Sterling", whose second word can never be an alias on its
  // own — a unit word is one token.
  gbp: { aliases: ["pfund", "sterling"], forms: invariant("Pfund") },
  // "Yen" is the table's word already, and it is invariant in German exactly as
  // it is in English.
  jpy: { aliases: [], forms: invariant("Yen") },
  // The second. German does not call the Swiss currency a franc: it is der
  // Franken, plural die Franken, and "Schweizerfranken" is the compound written
  // as one word wherever the currency has to be told apart from the French one.
  // The compound is enumerated rather than left to `compoundSplitter`, because
  // `COMPOUND_HEADS` is a list of *measurement* heads and a currency is not a
  // unit of measure — see that list's own doc comment on why it is morphology
  // and not vocabulary.
  chf: { aliases: ["franken", "schweizerfranken"], forms: invariant("Franken") },
  // "Zloty" is the table's word; German writes it without the Polish ł, which is
  // what makes the generated alias usable as it stands.
  pln: { aliases: [], forms: invariant("Zloty") },
  // The third. "Hrywnja" is the spelling German reference works use and
  // "Griwna" the older one still common in the press; both read, and the
  // orthography's own spelling is what prints, so this vocabulary answers in one
  // voice. The noun is feminine — *die* Hrywnja — and it is still counted
  // uninflected, "fünf Hrywnja", the way "fünf Yen" is: German has borrowed the
  // name without naturalising its paradigm, and the plural "Hrywnjas" belongs to
  // coins rather than to amounts. Gender therefore does not move the number axis
  // here, which is why `invariant` is the right table and not a shortcut.
  uah: { aliases: ["hrywnja", "griwna"], forms: invariant("Hrywnja") },
};

/**
 * German words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and
 * nothing else. `CURRENCIES` holds one set of words and they are English
 * ("kronor", "koruna"), so `currencyVocabulary("de")` returns English words
 * under a `de` label — its own doc comment says as much, and `de.test.ts`
 * asserts it so that the day the table grows localized names, this file stops
 * being right and that test stops being green together. What the call is still
 * good for is the half of a currency that is *not* language: the ISO code, the
 * Latin aliases and the currency sign. So the generated half stays generated
 * exactly as in `en` and `uk`, and the two English-specific things it carries
 * are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale
 *     changes — recognition is many-to-one, generation is one (design decision
 *     I6). Under German this reuse does more work than under Ukrainian, because
 *     four of the seven translated currencies need no new alias at all: the
 *     English word and the German one are the same letters.
 *   - its `forms` are dropped, every one of them. They are keyed `one`/`other`,
 *     which is what `english.selectForm` produces; `german.selectForm` returns
 *     neither, so keeping them would leave a table the engine can only miss —
 *     and every word in them is English besides ("dollars", where German counts
 *     "Dollar").
 *
 * `symbol` is the generated one throughout, and that is a decision rather than
 * an oversight. A currency sign is a fact about the currency and not about a
 * language: € is € in every orthography, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * German symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * **Five currencies get no German word at all, for two reasons worth telling
 * apart:**
 *
 *   cad, aud — their German names are "kanadischer Dollar" and "australischer
 *     Dollar": an adjective plus the head noun `usd` already owns. Two tokens
 *     cannot be one alias, the adjective alone means nothing, and the hyphenated
 *     "Kanada-Dollar" is two tokens to `lex` as well. `en` omits display forms
 *     for exactly these two, for exactly this reason.
 *   sek, nok, czk — German calls all three "Krone", separated only by the same
 *     kind of adjective ("schwedische", "norwegische", "tschechische"). One word
 *     for three units of one kind has no reading at all. And here the collision
 *     is not hypothetical: "krone" is *already* an alias of `nok` in the
 *     generated table — it is that currency's own Norwegian name — so adding it
 *     to `sek` would make `assertLocaleContract` fail its rival check, which is
 *     the check that exists to catch precisely this. The German word is left
 *     unclaimed rather than handed to whichever was written first, and "5
 *     Kronen" keeps reading as Norwegian kroner, which is where the generated
 *     table already sent it.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * German speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what a German price list prints for a currency it
 * has no word for.
 *
 * Named by **id string**, like `en` and `uk`: this file links neither the rate
 * machinery nor `Decimal`, so `@smartput/rate/locale/de` is a translation
 * someone can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("de").units)) {
  const german = GERMAN[code];
  units[code] = {
    aliases: [...generated.aliases, ...(german?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(german !== undefined ? { forms: german.forms } : {}),
  };
}

export default defineVocabulary({ locale: "de", kind: "money", units });
