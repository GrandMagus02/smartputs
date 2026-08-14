import type { Language } from "../types";
import { defineLanguage } from "./define";
import { identity, scriptSegmenter } from "./helpers";
import { CARDINALS, chineseNumerals, chineseSpeller } from "./zh-cardinals";

/**
 * The Chinese language: how Chinese is read and written, with no word for any
 * unit in it.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions, which is what `Intl.NumberFormat("zh")` and
 * `Intl.PluralRules("zh")` answer for below. Traditional orthography is `zh-Hant`
 * and a file of its own if anyone ever wants one, not a fork of this: the
 * numerals here (一二三…十百千万亿) are written identically in both scripts, and
 * what differs is the unit *words*, which are a `Vocabulary`'s business and not
 * a language's.
 *
 * Three things Chinese does that no Latin-script language in this repo did:
 *
 * **It does not put spaces between words**, so `segment` is not optional
 * decoration here the way it is for a language whose writer already separated
 * the words. `5千克转换为克` is one letter run, and without a hook the whole run
 * arrives as a single word that resolves to nothing.
 *
 * **It writes numbers a reader will type.** 二十, 一百, 十万 are not archaisms;
 * they are how a quantity is written in prose, and the composition is
 * positional over single characters rather than over words. `zh-cardinals.ts`
 * carries the tables and both directions over them.
 *
 * **It sets no space between a number and its unit.** 5千克, never 5 千克 —
 * which is `renderQuantity`'s whole job below, since the default spaces a word.
 *
 * And one thing it conspicuously does not do: inflect. There is no plural, no
 * case, no agreement of any kind on a noun, so `selectForm` returns one key and
 * every Chinese `Vocabulary` in this repo has a `forms` table with exactly one
 * row per unit.
 */
export const chinese: Language = defineLanguage({
  id: "zh",
  // Read from CLDR rather than transcribed, the same as every language here.
  // This runtime's `Intl.NumberFormat("zh")` groups with "," and marks the
  // decimal with "." — the same pair as `en`, which is the fact a reader
  // expecting a CJK surprise most needs pinned, and `zh.test.ts` pins it.
  numberFormat: "intl",
  /**
   * Han, and Han alone.
   *
   * `scriptSegmenter`'s own doc comment is the argument for using it rather
   * than reaching for `Intl.Segmenter` directly: `lex`'s `defaultSegment`
   * already breaks CJK at word granularity with no hook installed at all, and
   * what this adds is that it is *scoped* (a Latin run in a mixed input comes
   * back whole rather than re-broken), that it loses no letter to the
   * `isWordLike` filter, and that it builds one segmenter instead of one per
   * run. Its segmenter is pinned to `"und"` rather than to `"zh"` because ICU
   * picks its dictionary from the text and not from the tag — the helper
   * measured `en`, `ja`, `zh`, `th`, `ko`, `de` and `und` producing identical
   * splits over every CJK run tried — so passing `"zh"` would be a knob that
   * changes nothing.
   *
   * `"Han"` and not `["Han", "Hiragana", "Katakana"]`: the kana are Japanese,
   * and a `zh` engine that claimed them would be segmenting a language it has
   * no words for. A Simplified/Traditional split needs no second script name
   * either — both are `Script=Han`.
   *
   * What this does not do is invent breaks ICU's dictionary does not know. 十克
   * comes back as one segment (ten grams, glued), while 一千克 comes back as
   * 一 | 千克 and 五千克 as 五千 | 克 — three spellings of the same shape
   * broken three different ways. That is ICU reporting what its dictionary
   * says, and `script-segmenter.ts` is explicit that the helper does not
   * second-guess it; the alternative — splitting a numeral prefix off every
   * word — cannot be written at all, because 千克 (kilogram) and 千米
   * (kilometre) *begin with* the numeral character 千 and would be shredded
   * into a scale word and a unit that is not the one written.
   *
   * The same dictionary glues in the other direction too, and the keyword table
   * below is where it bites: 到 following a one-character unit is sometimes a
   * word in its own right, so 升到 ("rise to") and 周到 ("thorough") come back
   * whole and 「2升到毫升」 dies on an unknown unit 升到. It is two words out of
   * every printed form this repo ships, and the other three `in` keywords are
   * unaffected — 升为, 升换算 and 升转换 all cut cleanly — so the phrasing that
   * fails always has a working synonym one character away. Not fixable here for
   * the reason above: a hook that split a trailing particle off every word
   * would have to know that 到 is a particle *in this position only*, and 周到
   * is a perfectly ordinary adjective the moment nothing counts it.
   * `zh.test.ts` measures both, so a dictionary update that separates them
   * shows up as a failing test rather than as a limit nobody remembers.
   */
  segment: scriptSegmenter({ script: "Han" }),
  /**
   * `identity()`, and nothing else — which is a complete answer for Chinese and
   * not a chain someone forgot to finish.
   *
   * A Chinese noun has no forms: no plural, no case, no gender, nothing to
   * strip. And a suffix stripper would be actively wrong here rather than
   * merely idle, because a unit word is two or three characters long and every
   * one of them carries meaning: taking a character off 千克 leaves 千
   * (thousand) or 克 (gram, a *different unit* of the same kind), and taking one
   * off 公里 leaves 里, which is the traditional Chinese mile. English can
   * afford a stripper that occasionally produces a non-word; a Chinese stripper
   * produces the wrong unit.
   *
   * `identity()` is required rather than decorative:
   * `third-language.test.ts` records that the resolver reaches a surface only
   * through the forms some analyzer produced, so a language without it cannot
   * reach its own aliases at all.
   */
  analyze: [identity()],
  numerals: chineseNumerals(CARDINALS),
  spell: chineseSpeller(CARDINALS),
  keywords: {
    // 换算 and 转换 are the verbs ("convert"); 到 and 为 are the particles that
    // introduce the target ("to", "as"). All four are declared because all four
    // begin a conversion on their own — "5千克到克", "5千克为克" — and because
    // the idiomatic full phrasing writes a verb *and* a particle (换算成,
    // 转换为), which the segmenter hands over as two adjacent tokens. Declaring
    // only the verbs would leave the particle stranded as an unreadable word;
    // declaring only the particles would leave the verb stranded. See
    // `zh.test.ts` for the one shape this does not buy: verb and particle
    // together are two `in` tokens in a row, which the parser refuses, and no
    // keyword table can fold two tokens into one.
    in: ["换算", "转换", "到", "为"],
    // 加, 减, 乘 are the bare arithmetic verbs, and each is one character that
    // means nothing else in this position.
    plus: ["加"],
    minus: ["减"],
    times: ["乘"],
    // 除以 is "divide by" as a single word — the 以 is the particle that would
    // be `by`, already inside it. So `by` is deliberately undeclared: there is
    // no free particle for `foldWordOps` to swallow, and declaring one would be
    // a dead entry that looks like coverage. 除 alone is left out too, since it
    // heads 除了 ("except for") and would claim the first character of a common
    // word.
    over: ["除以"],
    // `of` and `off` are claimed by nothing, and both absences are decisions.
    //
    // `of` would be 的, the most frequent character in the language and the
    // general modification particle — and Chinese writes the percentage the
    // other way round anyway ("50的20%", base first), so claiming it would put
    // an operator with reversed operands on top of every possessive anyone
    // types.
    //
    // `off` would be 折, and 折 is not `off`: 八折 is "eight tenths", the price
    // *after* the discount, so the number beside it is 80 where the operator
    // wants 20. A keyword that reads a correct sentence into the wrong
    // arithmetic is worse than no keyword, and the inversion is a kind's
    // business (a `LiteralMatcher` for 折) rather than a connective's.
  },
  /**
   * One key, always: `"other"`.
   *
   * A one-row `forms` table is the correct answer for Chinese, not a stub
   * anyone should come back and finish. The language marks number nowhere on a
   * noun — 一克 and 五克 and 一百万克 are the same two characters — and CLDR
   * agrees: `Intl.PluralRules("zh").resolvedOptions().pluralCategories` is the
   * single-element `["other"]`, which `zh.test.ts` pins beside the key set so
   * the claim is measured rather than asserted.
   *
   * So no CLDR call is made here. Asking `Intl.PluralRules` for a category it
   * can only answer one way would be a lookup per rendered quantity that is
   * incapable of returning anything else, and it would read as though the key
   * set were open when it is closed at one.
   *
   * The slot is ignored for the same reason: `conversion-target` is a
   * grammatical *case* elsewhere in this repo (Ukrainian's locative, German's
   * dative), and Chinese has no case to select — 换算为克 is the same 克 that
   * stands anywhere else. `count === undefined` needs no branch of its own
   * either; ruling R5's fallback and the ordinary answer are the same string.
   */
  selectForm: () => "other",
  /**
   * No space between the number and the label, whatever kind of label it is.
   *
   * `defaultRenderQuantity` spaces a word ("5 kilograms") and sets a symbol
   * tight ("5kg"). Chinese sets both tight: 5千克, 5公里, 5%. The writing
   * system has no inter-word space to begin with, so a space before a unit is
   * not a typographic preference here the way it is in French — it is a
   * character that is simply not written, and one that would then be folded
   * back out by `normalize()` on the way in, making the engine's own output
   * differ from what it accepts.
   *
   * A Latin symbol takes the same treatment ("5kg"), which is both what the
   * default already did and what Chinese typography does with a mixed-script
   * quantity.
   *
   * `gap` still wins where a caller has resolved a separator of its own, so
   * `Printer.spacing` keeps overriding this the way it overrides the default.
   */
  renderQuantity: (p) =>
    `${p.number}${p.gap ?? ""}${p.form ?? p.alias ?? p.symbol ?? p.unit}`,
});

export default chinese;
