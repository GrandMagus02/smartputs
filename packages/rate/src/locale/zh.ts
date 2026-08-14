import { defineVocabulary, type UnitWords } from "@smartput/core";
import { currencyVocabulary } from "@smartput/currency";

/** One currency's Chinese half: what may be typed, and what may be printed. */
interface ChineseWords {
  readonly aliases: readonly string[];
  /**
   * One key, because `chinese.selectForm` returns the constant `"other"` for
   * every count and every slot — and a table may hold exactly the keys the
   * language can ask for, no more and no fewer. Ukrainian's counterpart of this
   * interface documents eight; the difference is the whole of Chinese
   * grammatical number, which is to say there is none. 一美元 and 五美元 differ in
   * the numeral and nowhere else, and CLDR agrees: `Intl.PluralRules("zh")`
   * resolves to the single category `["other"]`. A one-row table is the right
   * answer here, not a stub.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Chinese words for the currencies that have one.
 *
 * `zh` is the bare tag and means what CLDR means by it: Simplified Chinese,
 * mainland conventions.
 *
 * Chinese builds a currency name by compounding a country morpheme onto a
 * money morpheme — 美元 is "America-dollar", 英镑 "Britain-pound", 欧元
 * "Europe-dollar" — and then treats the result as an ordinary noun: no plural, no
 * case, no measure word of its own, with the unit set tight against the number,
 * which is what `chinese.renderQuantity` does on every branch. So each row below
 * is one printed word and a short list of readings, where the Ukrainian table
 * needed a nine-cell paradigm and four declension classes.
 *
 * **What can be listed at all is decided by the segmenter, not by the
 * dictionary**, and here that is more brutal than it was for Japanese. The alias
 * index is keyed by one *segmented* word, so a name `chinese.segment` returns in
 * pieces can never be produced as a lookup key. Every candidate was segmented
 * before it was written down, and the compounding pattern above turns out to
 * survive ICU only where the compound is frequent enough to be in its dictionary:
 *
 *   美元 欧元 英镑    whole
 *   日元            cut into 日 | 元 — the mainland's own spelling of the yen
 *   加元 澳元        cut into 加 | 元 and 澳 | 元, and so are 加拿大元, 澳大利亚元,
 *                   加币 and 澳币
 *   兹罗提          cut into 兹 | 罗 | 提 — a pure transliteration, and every
 *                   variant of it goes the same way
 *   格里夫纳        cut into 格里 | 夫 | 纳, likewise
 *
 * The result is five translated currencies against Japanese's eleven, and the
 * gap is ICU's dictionary rather than a gap in Chinese: every one of the words
 * above is what a Chinese speaker writes. `zh.test.ts` records each cut, so the
 * day ICU learns one of them the omission is a failing assertion instead of a
 * stale comment.
 *
 * **The three krona currencies are one word in Chinese, and that is Ukrainian's
 * problem rather than Japanese's.** Japanese transcribes each from its own source
 * language (クローナ, クローネ, コルナ) and could list two of the three. Chinese
 * calls SEK, NOK and CZK all 克朗, distinguishing them only by a country prefix —
 * 瑞典克朗, 挪威克朗, 捷克克朗 — and ICU cuts every one of those after the country.
 * So the bare 克朗 is a word three units of one kind would claim, which has no
 * reading, and the qualified forms are unreachable. All three keep their ISO codes
 * and nothing else, exactly as `uk` had to leave "крона" unclaimed.
 *
 * Every form printed is also listed as an alias (`aliases` repeats what `forms`
 * holds), which under `zh` is a stricter obligation than it looks: `chinese.analyze`
 * is `[identity()]` — there is no suffix stripper to recover a printed word that
 * was left off the read side, because Chinese has no suffixes to strip, and
 * `core/locale/zh.ts` argues that a stripper here would be actively wrong rather
 * than merely idle. A form missing from `aliases` would simply not parse.
 */
const CHINESE: Readonly<Record<string, ChineseWords>> = {
  eur: { aliases: ["欧元"], forms: { other: "欧元" } },
  // 美金 is the colloquial name for the US dollar — literally "American gold",
  // from the days the dollar was convertible — and it survives ICU whole. Listed
  // as a reading only, the way `ja` lists 米ドル: 美元 is what a price or a
  // newspaper writes, so it is what gets printed.
  usd: { aliases: ["美元", "美金"], forms: { other: "美元" } },
  gbp: { aliases: ["英镑"], forms: { other: "英镑" } },
  // 日圆 rather than 日元, and this is the one row where the segmenter overrules
  // the mainland standard. 日元 is what a Simplified source writes for the yen and
  // ICU cuts it into 日 | 元; 日圆 is the variant spelling — the same 圆 that 元 is
  // the simplified accounting form of, current in Hong Kong and Taiwan and
  // perfectly readable on the mainland — and it survives whole. So the reachable
  // spelling is the one this table carries, and someone typing 日元 falls back to
  // the ISO code the generated half already gives them.
  jpy: { aliases: ["日圆"], forms: { other: "日圆" } },
  // 瑞士法郎 is the full name and ICU cuts it into 瑞士 | 法郎, so the bare 法郎 is
  // what can be listed. It is unambiguous inside this table — CHF is the only
  // franc `CURRENCIES` ships — and it is the same call `ja` makes with フラン.
  chf: { aliases: ["法郎"], forms: { other: "法郎" } },
};

/**
 * Chinese words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth restating exactly what that
 * argument does today, because this file depends on the answer: **it stamps the
 * tag on the returned `Vocabulary` and nothing else.** `CURRENCIES` holds one set
 * of words and they are English ("dollar", "kronor"), so `currencyVocabulary("zh")`
 * returns English words under a `zh` label — its own doc comment says as much, and
 * `zh.test.ts` asserts it rather than trusting the comment. That is reported here
 * rather than worked around: the fix is localized names in `CURRENCIES`, which is a
 * change to a package this file must not edit.
 *
 * What the call is still good for is the half of a currency that is *not*
 * language: the ISO code, the Latin aliases and the currency sign. So the
 * generated half stays generated exactly as in `en`, `uk` and `ja`, and the two
 * English-specific things it carries are handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale changes
 *     — recognition is many-to-one, generation is one (design decision I6). It
 *     matters more here than in `ja`, because seven of the twelve currencies have
 *     no Chinese word at all and the ISO code is the only door they have.
 *   - its `forms` are dropped, every one of them, and under `zh` that is not the
 *     safe no-op it was under `uk`. Ukrainian could have kept them harmlessly:
 *     they are keyed `one`/`other`, and `ukrainian.selectForm` never returns
 *     either, so the table was merely unreachable. `chinese.selectForm` returns
 *     `"other"` for *every* count and slot — so keeping the generated table would
 *     mean a Chinese engine completing 「30 dollars」. Dropping it is load-bearing
 *     here, and the test says so.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than an
 * oversight. A currency sign is a fact about the currency and not about a
 * language: ¥ is ¥ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a Han
 * symbol here could never be the string a formatted result carries, and would only
 * ever reach `Printer`'s `symbols: true`, giving one currency two spellings that
 * disagree.
 *
 * Seven currencies get no Chinese word: `pln`, `uah`, `cad`, `aud`, `sek`, `nok`
 * and `czk`. Five of them are ICU cutting a name Chinese writes perfectly happily
 * (see the `CHINESE` table's own comment for each cut); the last two are the krona
 * collision, which is Ukrainian's problem rather than a segmenter one. Each keeps
 * its ISO code and the table's Latin aliases, and no `forms`, so the renderer falls
 * back to the symbol.
 *
 * One currency this engine would like and cannot have is the renminbi. 人民币 is
 * cut into 人民 | 币, 元 and 块 are the unit and its colloquial name and are both
 * claimed by nothing here — because `CURRENCIES` ships no `cny` at all. That is a
 * gap in the currency table rather than in this translation, and it is reported
 * rather than patched: a `Vocabulary` may only name units the kind declares.
 *
 * Named by **id string**, like `en`, `uk` and `ja`: this file links neither the
 * rate machinery nor `Decimal`, so `@smartput/rate/locale/zh` is a translation
 * someone can ship without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("zh").units)) {
  const chinese = CHINESE[code];
  units[code] = {
    aliases: [...generated.aliases, ...(chinese?.aliases ?? [])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(chinese !== undefined ? { forms: chinese.forms } : {}),
  };
}

export default defineVocabulary({ locale: "zh", kind: "money", units });
