import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Japanese half: what may be typed, and what may be printed. */
interface JapaneseWords {
  readonly aliases: readonly string[];
  /**
   * One key, because `japanese.selectForm` returns the constant `"other"` for
   * every count and every slot — and a table may hold exactly the keys the
   * language can ask for, no more and no fewer. Ukrainian's counterpart of this
   * interface documents eight; the difference is the whole of Japanese
   * grammatical number, which is to say there is none. 一ドル and 五ドル differ in
   * the numeral and nowhere else.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Japanese words for the currencies that have one.
 *
 * Japanese borrows currency names as katakana and then treats them as ordinary
 * nouns: no plural, no case, no counter of their own — 「30ドル」 is written
 * exactly as 「1ドル」 is, with the unit set tight against the number, which is
 * what `japanese.renderQuantity` does on every branch. So each row below is one
 * printed word and a short list of readings, where the Ukrainian table needed a
 * nine-cell paradigm and four declension classes.
 *
 * The one kanji entry is 円, and it is the interesting one: it is the *native*
 * word rather than a transcription (it means "round", from the shape of the
 * coin), it is one character, and it is what every price in Japan is written in.
 * Its formal compound 日本円 cannot be listed — ICU cuts it into 日本 | 円 — which
 * costs nothing, since the bare 円 is what anyone types and the compound only
 * appears in contexts that are already disambiguating.
 *
 * **What can be listed at all is decided by the segmenter, not by the
 * dictionary.** The alias index is keyed by one *segmented* word, so a name
 * `japanese.segment` returns in pieces can never be produced as a lookup key.
 * Every entry below was segmented before it was written down, and the results cut
 * across what a translator would guess:
 *
 *   カナダドル      whole — so `cad` gets a Japanese word, where `en` and `uk`
 *                   both had to omit it ("Canadian dollar" and "канадський
 *                   долар" are two tokens in a way this is not)
 *   オーストラリアドル whole — likewise `aud`
 *   ノルウェークローネ whole — so `nok` gets its unambiguous full name
 *   スウェーデンクローナ cut into スウェーデン | クローナ, so `sek` is reached by the
 *                   bare クローナ instead
 *   コルナ          cut into コル | ナ, which is ICU being wrong rather than
 *                   disagreeing — and it is why `czk` gets no Japanese word at
 *                   all (see below)
 *
 * **The three krona currencies are three different words in Japanese, and that is
 * a real difference from Ukrainian rather than a bolder choice.** Ukrainian calls
 * SEK, NOK and CZK all "крона", so `uk` had to leave the word unclaimed — one word
 * for three units of one kind has no reading. Japanese transcribes each from its
 * own source language: クローナ (Swedish krona), クローネ (Norwegian krone), コルナ
 * (Czech koruna). Two of the three are therefore listable and unambiguous here.
 * The third is not, and for the segmenter reason above rather than a linguistic
 * one — so `czk` keeps its ISO code and nothing else, and the test records the cut
 * so that the day ICU learns コルナ this becomes a failing assertion instead of a
 * stale comment.
 *
 * Every form printed is also listed as an alias (`aliases` repeats what `forms`
 * holds), which under `ja` is a stricter obligation than it looks: `japanese.analyze`
 * is `[identity()]` — there is no suffix stripper to recover a printed word that
 * was left off the read side, because Japanese has no suffixes to strip. A form
 * missing from `aliases` here would simply not parse.
 */
const JAPANESE: Readonly<Record<string, JapaneseWords>> = {
  eur: { aliases: ["ユーロ"], forms: { other: "ユーロ" } },
  // 米ドル ("US dollar", 米 being the kanji abbreviation for America) survives ICU
  // whole and is listed as a reading: it is what a financial page writes when it
  // has to tell this dollar from the other three in this table. The bare ドル is
  // what gets printed, because that is what an ordinary sentence uses.
  usd: { aliases: ["ドル", "米ドル"], forms: { other: "ドル" } },
  // 英ポンド is the same construction with 英 for Britain. ポンド is also
  // `@smartput/mass`'s word for the pound in this language, exactly as "pound" is
  // in English and "фунт" is in Ukrainian, and it is left standing for the same
  // reason: the two readings are separated by the kinds installed and by weight,
  // never by taking a word away from the language that has it.
  gbp: { aliases: ["ポンド", "英ポンド"], forms: { other: "ポンド" } },
  jpy: { aliases: ["円"], forms: { other: "円" } },
  chf: { aliases: ["フラン", "スイスフラン"], forms: { other: "フラン" } },
  // ズウォティ is the transcription that follows the Polish pronunciation and is
  // what reference works use; ズロチ is the older, commoner spelling and reads
  // without being printed, on the same principle `uk` applies to "ієна".
  pln: { aliases: ["ズウォティ", "ズロチ"], forms: { other: "ズウォティ" } },
  // フリヴニャ follows the Ukrainian pronunciation; グリブナ is the older
  // transcription by way of Russian and still appears in older financial writing.
  uah: { aliases: ["フリヴニャ", "グリブナ"], forms: { other: "フリヴニャ" } },
  // The two `en` and `uk` both had to leave out, listable here only because ICU
  // keeps the compound whole. The bare ドル is not shared with them: it is already
  // `usd`'s, and a word claimed by two units of one kind would have no reading.
  cad: { aliases: ["カナダドル"], forms: { other: "カナダドル" } },
  aud: { aliases: ["オーストラリアドル"], forms: { other: "オーストラリアドル" } },
  sek: { aliases: ["クローナ"], forms: { other: "クローナ" } },
  nok: {
    aliases: ["クローネ", "ノルウェークローネ"],
    forms: { other: "クローネ" },
  },
};

/**
 * Japanese words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth restating exactly what
 * that argument does today, because this file depends on the answer:
 * **it stamps the tag on the returned `Vocabulary` and nothing else.**
 * `CURRENCIES` holds one set of words and they are English ("dollar", "kronor"),
 * so `currencyVocabulary("ja")` returns English words under a `ja` label — its own
 * doc comment says as much, and `ja.test.ts` asserts it rather than trusting the
 * comment. That is reported here rather than worked around: the fix is localized
 * names in `CURRENCIES`, which is a change to a package this file must not edit.
 *
 * What the call is still good for is the half of a currency that is *not*
 * language: the ISO code, the Latin aliases and the currency sign. So the
 * generated half stays generated exactly as in `en` and `uk`, and the two
 * English-specific things it carries are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6).
 *   - its `forms` are dropped, every one of them, and under `ja` that is not the
 *     safe no-op it was under `uk`. Ukrainian could have kept them harmlessly:
 *     they are keyed `one`/`other`, and `ukrainian.selectForm` never returns
 *     either, so the table was merely unreachable. `japanese.selectForm` returns
 *     `"other"` for *every* count and slot — so keeping the generated table would
 *     mean a Japanese engine completing 「30 dollars」. Dropping it is load-bearing
 *     here, and the test says so.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: ¥ is ¥ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * katakana symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree. 円, the character Japan actually writes its prices in,
 * is therefore an *alias* of `jpy`: readable, never printed. (It is also,
 * pleasingly, the character ¥ was derived from.)
 *
 * One currency gets no Japanese word: `czk`. The reason is not the two `uk`
 * gives — it is neither a two-token qualifier nor a name shared with a sibling —
 * but the segmenter: コルナ comes back as コル | ナ. It keeps its ISO code and the
 * table's Latin aliases, which is what a Japanese speaker types for it anyway,
 * and no `forms`, so the renderer falls back to the symbol.
 *
 * Named by **id string**, like `en` and `uk`: this file links neither the rate
 * machinery nor `Decimal`, so `@smartput/rate/locale/ja` is a translation someone
 * can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("ja").units)) {
  const japanese = JAPANESE[code];
  units[code] = {
    aliases: [...generated.aliases, ...(japanese?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(japanese !== undefined ? { forms: japanese.forms } : {}),
  };
}

export default defineVocabulary({ locale: "ja", kind: "money", units });
