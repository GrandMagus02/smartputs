import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) sitting on
 * the final consonant, then the alif (U+0627) that carries it, in that codepoint
 * order.
 *
 * Written the way `@smartput/core/locale/ar` writes the same two characters in
 * its suffix stripper, and for the same reason. U+064B is a combining mark that
 * renders *on top of* the letter before it, so a literal is a smudge one careless
 * retype away from vanishing — and if it vanished, the `many` row would silently
 * become the `one` row and every shape-based test here would still pass, because
 * the bare spelling is a listed alias too.
 *
 * The alif, unlike the mark, is a letter ordinary Arabic prose actually writes:
 * "١١ دولارًا" is what a newspaper sets, and "١١ دولار" is not. So this ending is
 * not a diacritic the repo could fold away — it is a real, visible difference
 * between the singular and the tamyīz, and that is exactly why Arabic needs a
 * `many` row at all.
 */
const AN = "\u064B\u0627";

/** One currency's Arabic half: what may be typed, and what may be printed. */
interface ArabicWords {
  readonly aliases: readonly string[];
  /**
   * Six keys, because `arabic.selectForm` returns exactly the six CLDR categories
   * on one axis — `zero`, `one`, `two`, `few`, `many`, `other` — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Arabic words for the currencies that have one.
 *
 * Six rows deserve naming before the table, because they are the rows no other
 * language in this repo has and the ones easiest to get plausibly wrong. Taking
 * دولار:
 *
 * ```
 * zero   0            دولار      genitive singular
 * one    1            دولار      nominative singular
 * two    2            دولاران    the DUAL — a suffixed form of the noun meaning
 *                                precisely two of the thing, and unique to Arabic
 *                                among the languages shipped here
 * few    3-10         دولارات    plural
 * many   11-99        دولارًا    accusative SINGULAR with tanwīn — the tamyīz
 * other  100+, and    دولار      genitive singular
 *        every fraction
 * ```
 *
 * Three of those rows are traps.
 *
 * **`many` is not a plural.** "١١ دولارًا" is a *singular* noun in the accusative,
 * which is why it is spelled with the alif of `AN` above and never with the
 * plural's ـات. A table ported by renaming English or Russian columns puts the
 * plural here and is wrong on every count from 11 to 99 — the commonest band
 * there is.
 *
 * **`other` is a singular too.** Fractions land there, and so does a count-free
 * conversion target (ruling R5) — so "1.5 دولار" and "إلى دولار", never
 * "دولارات". That is the exact opposite of French, where a bare target is plural,
 * and it is the assertion `ar.test.ts` pins.
 *
 * **`zero`, `one` and `other` hold the same string.** They differ only in a final
 * short vowel, and Arabic does not write short vowels. A vocabulary that repeated
 * one word across those three rows is correct, not half-finished; one that
 * invented three spellings would be inventing them.
 *
 * Two of the seven translated currencies are **indeclinable**, and their six
 * identical cells are a fact about the noun rather than a table left unfilled.
 * يورو ends in a long vowel and زلوتي in a yāʾ, which is the shape Arabic borrows
 * without giving it a dual or a plural — the same phenomenon Russian's "евро"
 * shows, arrived at from a different direction. هريفنيا is the third: it ends in
 * an alif, which no Arabic dual or plural suffix attaches to.
 *
 * Every form printed is also listed as an alias, because a printed word recovered
 * only by the language's penalised suffix stripper is a word this vocabulary is
 * guessing at rather than declaring. Two groups of aliases go further and are
 * there because `arabic`'s analyzers *cannot* reach them at all:
 *
 * - **Hamza spellings.** The orthographic fold runs one way — it deletes a hamza
 *   the user typed and can never invent one they did not — so إسترليني needs
 *   استرليني listed beside it.
 * - **The bare tamyīz** (دولارا, no mark). The stripper does recover it, at
 *   `weight: -2`; listing it means the commonest *typed* spelling of the `many`
 *   row is read at full weight instead of through a guess, since nobody types the
 *   mark.
 */
const ARABIC: Readonly<Record<string, ArabicWords>> = {
  // Indeclinable, and the one entry that needs no dual and no plural: يورو ends
  // in a long vowel, which is the shape Arabic borrows whole. أورو is the
  // Maghrebi transliteration of the same word, listed with its plain-alif twin
  // because the orthographic fold cannot invent a hamza.
  eur: {
    aliases: ["يورو", "أورو", "اورو"],
    forms: {
      zero: "يورو",
      one: "يورو",
      two: "يورو",
      few: "يورو",
      many: "يورو",
      other: "يورو",
    },
  },
  usd: {
    aliases: [
      "دولار",
      // The dual in both its cases: دولاران is nominative, دولارين
      // accusative/genitive, and the oblique one is what appears after a
      // preposition — which is most of the time. Only the nominative is printed;
      // both are read.
      "دولاران",
      "دولارين",
      "دولارات",
      `دولار${AN}`,
      "دولارا",
    ],
    forms: {
      zero: "دولار",
      one: "دولار",
      two: "دولاران",
      few: "دولارات",
      many: `دولار${AN}`,
      other: "دولار",
    },
  },
  // جنيه is the Arabic word for a pound, and إسترليني ("sterling") is the
  // adjective that says *which* pound. The adjective can never be part of the
  // unit word — "جنيه إسترليني" is two tokens — so it is listed on its own, the
  // way `en` lists "sterling" and `ru` lists "стерлинг": a clipping people
  // actually type, read but never printed.
  //
  // باوند is the transliteration, and it is `@smartput/mass`'s Arabic alias for
  // the pound *weight* as well. It is left standing in both places for the reason
  // `ru` leaves "фунт" standing: the two readings are separated by the kinds
  // installed and by weight, never by taking a word away from the language that
  // has it. It is not printed here, so nothing this file emits is ambiguous.
  gbp: {
    aliases: [
      "جنيه",
      "جنيهان",
      "جنيهين",
      "جنيهات",
      `جنيه${AN}`,
      "جنيها",
      "إسترليني",
      "استرليني",
      "باوند",
    ],
    forms: {
      zero: "جنيه",
      one: "جنيه",
      two: "جنيهان",
      few: "جنيهات",
      many: `جنيه${AN}`,
      other: "جنيه",
    },
  },
  // Two letters, which is the shortest noun in this table and the reason
  // `@smartput/core/locale/ar` floors its suffix stripper at `minStem: 2` rather
  // than 3: ينان has to reduce to ين. The floor also makes it impossible to
  // manufacture a one-letter stem, which is what protects the one-letter symbols
  // م، غ، ل، ث in the other kinds.
  jpy: {
    aliases: ["ين", "ينان", "ينين", "ينات", `ين${AN}`, "ينا"],
    forms: {
      zero: "ين",
      one: "ين",
      two: "ينان",
      few: "ينات",
      many: `ين${AN}`,
      other: "ين",
    },
  },
  chf: {
    aliases: ["فرنك", "فرنكان", "فرنكين", "فرنكات", `فرنك${AN}`, "فرنكا"],
    forms: {
      zero: "فرنك",
      one: "فرنك",
      two: "فرنكان",
      few: "فرنكات",
      many: `فرنك${AN}`,
      other: "فرنك",
    },
  },
  // Indeclinable: زلوتي ends in a yāʾ, and Arabic gives it no dual and no plural.
  // Note what this costs the six-row model — nothing at all, which is the useful
  // result: the categories are still selected, they simply select the same word,
  // exactly as Russian's "евро" does across all eight of its cells.
  pln: {
    aliases: ["زلوتي", "زلوتيات"],
    forms: {
      zero: "زلوتي",
      one: "زلوتي",
      two: "زلوتي",
      few: "زلوتي",
      many: "زلوتي",
      other: "زلوتي",
    },
  },
  // Indeclinable for a third reason: هريفنيا ends in an alif, and no Arabic dual
  // or plural suffix attaches to one. هريفنا and غريفنا are the two other
  // transliterations in current use — the Arabic press writes the Ukrainian /h/
  // as either هـ or غ, which is a pronunciation difference written down rather
  // than a different word.
  uah: {
    aliases: ["هريفنيا", "هريفنا", "غريفنيا", "غريفنا"],
    forms: {
      zero: "هريفنيا",
      one: "هريفنيا",
      two: "هريفنيا",
      few: "هريفنيا",
      many: "هريفنيا",
      other: "هريفنيا",
    },
  },
};

/**
 * Arabic words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and nothing
 * else. `CURRENCIES` holds one set of words, and they are English ("dollar",
 * "kronor"), so `currencyVocabulary("ar")` returns **English words under an `ar`
 * label** — its own doc comment says as much, and `ar.test.ts` pins it so that
 * the day the table grows localized names, this file stops being right and that
 * test stops being green together. What the call is still good for is the half of
 * a currency that is *not* language: the ISO code, the Latin aliases and the
 * currency sign. So the generated half stays generated exactly as in `en`, `uk`
 * and `ru`, and the two English-specific things it carries are handled
 * deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6). It is
 *     the same reuse `@smartput/mass/locale/ar` performs with `aliasesFor`, and
 *     it is why "dollars" is readable here.
 *   - its `forms` are dropped, every one of them. They are keyed `one`/`other`,
 *     which is what `english.selectForm` produces; `arabic.selectForm` never
 *     returns either — its key set is the six CLDR categories — so keeping them
 *     would leave a table the engine can only miss, and every word in them is
 *     English besides.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: ₴ is ₴ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so an
 * Arabic symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * **There is no dirham, riyal, dinar or pound-of-Egypt here, and that is the
 * kind's shape rather than this file's decision.** `@smartput/currency`'s
 * `CURRENCIES` holds the twelve codes ECB's daily reference file quotes plus the
 * euro; not one Arab currency is among them, so `money` declares no unit for any
 * of them — and a `Vocabulary` names units, it cannot add them. An Arabic
 * speaker's own money is therefore unreachable in an Arabic engine, which is
 * worth saying out loud rather than leaving to be discovered: the fix is a row in
 * `CURRENCIES` and a quote in whatever snapshot is loaded, both on the
 * language-free side of the split, and neither is a translator's to make. This is
 * the same absence `ru.ts` records about the rouble, and it is wider here.
 *
 * Five of the twelve get no Arabic word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — Arabic names them "دولار كندي" and "دولار أسترالي", a head noun
 *     `usd` already owns plus an adjective. Two tokens cannot be one alias, and
 *     the adjective alone means nothing on its own. `en` omits display forms for
 *     exactly these two for exactly this reason.
 *   sek, nok, czk — Arabic calls all three "كرونة", separated only by the same
 *     kind of adjective ("سويدية", "نرويجية", "تشيكية"). One word for three units
 *     of one kind has no reading at all: no context the engine has would separate
 *     them, so the word is left unclaimed rather than given to whichever happened
 *     to be written first. Unlike German — where "Krone" is already `nok`'s own
 *     generated alias and the collision is decided upstream — nothing in the Latin
 *     table spells the Arabic word, so leaving it out is an actual choice.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what an
 * Arabic speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what an Arabic price list prints for a currency it
 * has no word for.
 *
 * **Digits and direction, both inherited and both left alone.**
 * `@smartput/core/locale/ar` pins the `latn` numbering system because the engine
 * can only emit Latin digits, so amounts read and print as "30.00" and "4,090.91"
 * — and "٣٠" does not parse, which is a core-level gap named there rather than
 * one a word list can close. The rendered string is in *logical* order, number
 * before label; nothing here is reversed and nothing here should be.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/ar` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("ar").units)) {
  const arabic = ARABIC[code];
  units[code] = {
    aliases: [...generated.aliases, ...(arabic?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(arabic !== undefined ? { forms: arabic.forms } : {}),
  };
}

export default defineVocabulary({ locale: "ar", kind: "money", units });
