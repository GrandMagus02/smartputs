import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Korean half: what may be typed, and what may be printed. */
interface KoreanWords {
  readonly aliases: readonly string[];
  /**
   * One key, because `korean.selectForm` returns the constant `"other"` for every
   * count and every slot — and a table may hold exactly the keys the language can
   * ask for, no more and no fewer. Ukrainian's counterpart of this interface
   * documents eight; the difference is the whole of Korean grammatical number,
   * which is to say there is none. 일 달러 and 오 달러 differ in the numeral and
   * nowhere else, and the plural suffix 들 is never used with a measured amount.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Korean words for the currencies that have one.
 *
 * Korean borrows currency names as Hangul transcriptions and then treats them as
 * ordinary nouns: no plural, no case, no counter of their own — 「30달러」 is
 * written exactly as 「1달러」 is, with the unit set tight against the number,
 * which is what `korean.renderQuantity` does on every branch. So each row below is
 * one printed word and a short list of readings, where the Ukrainian table needed
 * a nine-cell paradigm and four declension classes.
 *
 * **What can be listed at all is decided by the space, and it costs this table
 * exactly what it earned the zone table next door.** The alias index is keyed by
 * one word, and Korean puts a space between words, so a qualified currency name —
 * 캐나다 달러, 호주 달러, 스위스 프랑, 스웨덴 크로나 — is two tokens and cannot be
 * an entry, in precisely the way "Canadian dollar" and "канадський долар" cannot.
 * `ja` could list カナダドル because Japanese has no spaces at all; `ko` cannot,
 * and `cad` and `aud` therefore keep their ISO codes and nothing else. That is
 * the mirror image of `@smartput/datetime/locale/ko`, where the same fact about
 * Korean *gained* 뉴욕 that `ja` had lost to ICU's dictionary: one language's
 * segmentation rule helps in one table and hurts in the other.
 *
 * **The three krona currencies are three different words in Korean**, and here
 * Korean does better than both its neighbours. Ukrainian calls SEK, NOK and CZK
 * all "крона", so `uk` had to leave the word unclaimed — one word for three units
 * of one kind has no reading. Japanese transcribes all three differently but lost
 * コルナ to the segmenter. Korean transcribes each from its own source language —
 * 크로나 (Swedish krona), 크로네 (Norwegian krone), 코루나 (Czech koruna) — and all
 * three are single words, so all three are listable and unambiguous. `czk` gets a
 * word here that it gets in neither sibling file.
 *
 * Every form printed is also listed as an alias (`aliases` repeats what `forms`
 * holds), which under `ko` is a stricter obligation than it looks. Korean's only
 * analyzer besides `identity()` is `particleStripper`, and a stripper that removes
 * *particles* cannot recover a printed word that was left off the read side —
 * there is no suffix to strip, because a Korean noun has no suffixes. A form
 * missing from `aliases` here would simply not parse.
 *
 * One consequence of that stripper is worth recording, because it looks like a
 * bug and is not: 「유로」 ends in 로, the directional particle, so the stripper
 * also proposes the stem 유. It resolves to nothing and is discarded — the
 * resolver only keeps forms that hit a registered alias — which is exactly the
 * case `core/locale/ko.ts` names when it explains why the stripper needs no
 * `minStem`.
 */
const KOREAN: Readonly<Record<string, KoreanWords>> = {
  eur: { aliases: ["유로"], forms: { other: "유로" } },
  // 미국 달러 ("US dollar") is what a financial page writes when it has to tell
  // this dollar from the others, and it is two words, so it cannot be listed —
  // the bare 달러 is what an ordinary sentence uses and what gets both read and
  // printed.
  usd: { aliases: ["달러"], forms: { other: "달러" } },
  // 파운드 is also `@smartput/mass`'s word for the pound in this language, exactly
  // as "pound" is in English and "фунт" is in Ukrainian, and it is left standing
  // for the same reason: the two readings are separated by the kinds installed
  // and by weight, never by taking a word away from the language that has it.
  gbp: { aliases: ["파운드"], forms: { other: "파운드" } },
  // 엔 is what follows an amount — 「1000엔」 — and 엔화 ("yen currency", 화 being
  // the Sino-Korean suffix for a money) is what a headline writes about the
  // currency in general. Both are read; the one that follows a number is printed.
  jpy: { aliases: ["엔", "엔화"], forms: { other: "엔" } },
  chf: { aliases: ["프랑"], forms: { other: "프랑" } },
  // 즈워티 follows the Polish pronunciation and is the transcription reference
  // works use; 즐로티 is the older, commoner spelling and reads without being
  // printed, on the same principle `uk` applies to "ієна".
  pln: { aliases: ["즈워티", "즐로티"], forms: { other: "즈워티" } },
  // 흐리우냐 follows the Ukrainian pronunciation; 그리브나 is the older
  // transcription by way of Russian and still appears in older financial writing.
  uah: { aliases: ["흐리우냐", "그리브나"], forms: { other: "흐리우냐" } },
  sek: { aliases: ["크로나"], forms: { other: "크로나" } },
  nok: { aliases: ["크로네"], forms: { other: "크로네" } },
  czk: { aliases: ["코루나"], forms: { other: "코루나" } },
};

/**
 * Korean words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth restating exactly what
 * that argument does today, because this file depends on the answer: **it stamps
 * the tag on the returned `Vocabulary` and nothing else.** `CURRENCIES` holds one
 * set of words and they are English ("dollar", "kronor"), so
 * `currencyVocabulary("ko")` returns English words under a `ko` label — its own
 * doc comment says as much, `ja.ts` reported it before this file did, and
 * `ko.test.ts` asserts it rather than trusting either comment. That is reported
 * here rather than worked around: the fix is localized names in `CURRENCIES`,
 * which is a change to a package this file must not edit.
 *
 * What the call is still good for is the half of a currency that is *not*
 * language: the ISO code, the Latin aliases and the currency sign. So the
 * generated half stays generated exactly as in `en`, `uk` and `ja`, and the two
 * English-specific things it carries are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6).
 *   - its `forms` are dropped, every one of them, and under `ko` that is not the
 *     safe no-op it was under `uk`. Ukrainian could have kept them harmlessly:
 *     they are keyed `one`/`other`, and `ukrainian.selectForm` never returns
 *     either, so the table was merely unreachable. `korean.selectForm` returns
 *     `"other"` for *every* count and slot — so keeping the generated table would
 *     mean a Korean engine completing 「30 dollars」. Dropping it is load-bearing
 *     here, and the test says so.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: ¥ is ¥ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Hangul symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree.
 *
 * Two currencies get no Korean word: `cad` and `aud`. The reason is the space —
 * 캐나다 달러 and 호주 달러 are two tokens each — and it is `en`'s and `uk`'s
 * reason rather than `ja`'s segmenter one. They keep their ISO codes and the
 * table's Latin aliases, which is what a Korean speaker types for them anyway,
 * and no `forms`, so the renderer falls back to the symbol.
 *
 * **And the currency a Korean user would type first is not in this table at
 * all.** There is no `krw` in `CURRENCIES`, so 원 — the word every price in Korea
 * is written in — names no unit this kind declares, and a `Vocabulary` may only
 * name units the kind declares (rule 2). Reported, not faked: the fix is a row in
 * `@smartput/currency` and a rate for it, neither of which belongs in a
 * translation. It is the exact counterpart of `Asia/Seoul`'s absence from
 * `@smartput/timezone`, recorded in this package's sibling file for datetime.
 *
 * Named by **id string**, like `en`, `uk` and `ja`: this file links neither the
 * rate machinery nor `Decimal`, so `@smartput/rate/locale/ko` is a translation
 * someone can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("ko").units)) {
  const korean = KOREAN[code];
  units[code] = {
    aliases: [...generated.aliases, ...(korean?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(korean !== undefined ? { forms: korean.forms } : {}),
  };
}

export default defineVocabulary({ locale: "ko", kind: "money", units });
