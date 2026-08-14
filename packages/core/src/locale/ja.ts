import type { Language } from "../types";
import { defineLanguage } from "./define";
import { identity, scriptSegmenter } from "./helpers";
import { japaneseNumerals, japaneseSpeller } from "./ja-cardinals";

/**
 * The Japanese language: how Japanese is read and written, with no word for any
 * unit in it.
 *
 * `ja` is the bare tag and means what CLDR means by it — modern standard
 * Japanese in its ordinary mixed orthography, kanji and kana together. There is
 * no script subtag to consider here the way `zh` has one: Japanese is *always*
 * written in three scripts at once, and that is a fact about the language
 * rather than a variant of it. Which is precisely why `segment` below declares
 * all three.
 *
 * Three things make Japanese different from every language already in this
 * directory, and each of them is a field:
 *
 * - **Nothing is separated by spaces**, so `segment` is not optional the way it
 *   is for a Latin-script language.
 * - **Numbers are written in characters that are not digits**, and grouped in
 *   myriads rather than thousands, so `numerals`/`spell` could not be built on
 *   the shared `cardinalNumerals` helper. See `ja-cardinals.ts` for why.
 * - **Nothing is set off from a number by a space**, so `renderQuantity` closes
 *   the gap the default template opens.
 *
 * And one thing that makes it *simpler* than every language already here:
 * Japanese nouns do not inflect for number, so `selectForm` has exactly one
 * answer. Words for units are not here at all — they are `Vocabulary` tables
 * beside the kinds that declare the units, and they reach this object through
 * `composeLocale`.
 */
export const japanese: Language = defineLanguage({
  id: "ja",
  // Read from CLDR rather than transcribed, the same as every other language
  // here. `Intl.NumberFormat("ja")` groups with "," and marks the decimal with
  // "." — the same pair as `en`, which is exactly why it must come from the
  // platform and not from a hand-written `NumberFormatSpec`: a language that
  // transcribes separators it believes it knows is a language that can silently
  // disagree with the runtime. `ja.test.ts` pins the pair this runtime produces.
  numberFormat: "intl",
  /**
   * Japanese puts no space between words, so without this the whole of
   * 五キログラムをグラム is one letter run.
   *
   * All three scripts are declared because a single Japanese word routinely
   * spans them and a unit label reliably does: キログラム is Katakana, 平方 is
   * Han, と/を/に are Hiragana, and the prolonged sound mark ー inside メートル
   * is `Script=Common` and only reachable through `Script_Extensions` — which
   * is the guard `scriptSegmenter` uses and the reason it works here at all.
   * Declaring only Katakana would leave every kanji run unsegmented; declaring
   * only Han would leave every loanword unit unsegmented.
   *
   * The scoping is the point, not the segmentation: `lex` hands the format
   * language's hook *every* letter run, Latin ones included, and a Japanese
   * engine reading "5 kg in grams" must not have ICU re-break the English. A
   * run with no character of a declared script is returned whole.
   */
  segment: scriptSegmenter({ script: ["Han", "Hiragana", "Katakana"] }),
  /**
   * Nothing but identity, and that is a claim about Japanese rather than an
   * omission.
   *
   * A Japanese noun has no plural, no case ending and no agreement: キログラム
   * is キログラム in every position a unit can occupy, so there is no suffix for
   * a `suffixStripper` to remove and no compound for `compoundSplitter` to cut
   * — the particles that would look like suffixes (を, に, から) are separate
   * words, and `segment` has already separated them (measured: ICU returns
   * `キログラム` + `を` for キログラムを). Half-width katakana and full-width
   * Latin, the two spellings that genuinely need folding, are folded by NFKC in
   * the normalizer before a word ever reaches an analyzer, so ｷﾛｸﾞﾗﾑ and
   * ｋｇ are already キログラム and kg here.
   */
  analyze: [identity()],
  numerals: japaneseNumerals,
  spell: japaneseSpeller,
  keywords: {
    /**
     * Both particles mark the *source*, and that is what puts them in the right
     * place.
     *
     * Japanese is head-final: a particle is a postposition, so it attaches to
     * the end of the phrase it governs. A particle on the left operand
     * therefore lands exactly where an infix operator goes —
     * 五キログラム**を**グラム and 五キログラム**から**グラム are both
     * `<source> <op> <target>` as far as the parser is concerned, even though
     * neither particle *means* "in".
     *
     * を is the accusative: 「5キログラムをグラムに変換」 ("convert 5kg into
     * grams") is the sentence a Japanese speaker writes, and を is the particle
     * it hangs on. から is "from", and reads as the origin of a conversion the
     * way English "from … to" does.
     *
     * **に and へ are deliberately not here**, and this is the one place where
     * leaving a word out is a structural decision rather than a matter of
     * taste. They are the particles that mark the *target* — which means they
     * attach to the right operand and arrive *after* it, at the very end of the
     * input. An infix `in` cannot reach a trailing token: the parser leaves it
     * unconsumed and throws (`pratt.test.ts`, "a trailing off is left
     * unconsumed and fails"). Claiming them would not make 「…をグラムに」 parse;
     * it would only turn one kind of failure into another while spending two
     * surface words. The honest fix for a trailing target particle is a lexer
     * that can drop it, not a keyword table that pretends it is an operator.
     *
     * は (topic) and で (instrumental) were also considered and refused on the
     * other ground: they are among the commonest characters in the language,
     * and a keyword table that claims them claims a large slice of ordinary
     * text along with them.
     */
    in: ["を", "から"],
    /**
     * These four are the verbs Japanese arithmetic is actually *read* with, and
     * they are infix — 五足す五, 十ひく五, 十かける五, 十わる五 — which is the
     * fortunate exception to the head-final problem above. Each is given in its
     * kanji stem (how it is written in prose) and, where the segmenter allows,
     * in hiragana (how it is typed into a calculator); both spellings are one
     * word to the reader and there is no way to know which a keyboard produced.
     *
     * **「たす」 is the one that could not be listed, and it is a measurement
     * rather than a preference.** Japanese is unspaced, so every keyword surface
     * has to survive `segment` before the lexer can hand it to the keyword map,
     * exactly as every unit alias has to. ICU cuts たす into た | す — both
     * halves are ordinary hiragana that its dictionary knows as words in their
     * own right — so the entry could never be produced as a lookup key and
     * 「十たす五」 dies reporting `Unknown unit "た"`. The other three hiragana
     * stems (ひく, かける, わる) come back whole and are listed. This is the same
     * rule the `ja` vocabularies follow for ラジアン and ギガワット: a surface the
     * lexer can never produce is dead weight, not documentation. `ja.test.ts`
     * re-runs the cut, so the day ICU learns たす the omission surfaces as a
     * failing test rather than as a stale comment.
     *
     * **A digit glued to the right of one of these verbs is also lost, and that
     * is `lex` rather than Japanese.** A letter run absorbs the digits that
     * follow it, so that `m2` and `cm3` lex as one unit word — which in an
     * unspaced language means 「10足す5」 lexes the verb as `足す5` and fails,
     * while 「五足す五」, 「10足す五」 and 「10足す 5」 all evaluate. The fix is a
     * lexer that does not absorb digits onto a keyword; it is reported rather
     * than worked around here, because a keyword table cannot re-cut a token.
     *
     * プラス and マイナス join the additive pair because the loanwords are in
     * genuinely common use for signed numbers, and both survive the segmenter.
     * カケル and ワル are not their counterparts and are not listed: nobody
     * writes them.
     */
    plus: ["足す", "プラス"],
    minus: ["ひく", "引く", "マイナス"],
    times: ["かける", "掛ける"],
    over: ["わる", "割る"],
    /**
     * `by`, `of` and `off` are absent, all three for the same reason and it is
     * word order rather than vocabulary.
     *
     * `by` exists in `en` only so that "divided by" can be swallowed into one
     * operator. Japanese has no two-word division: 割る is a single verb, and
     * the particle that would translate "by" (で) is a postposition that would
     * land after the divisor, not between the operands.
     *
     * `of` and `off` are the harder loss and worth naming precisely. The engine
     * reads both with the percentage on the left and the base on the right —
     * "20% of 50", "20% off 50". Japanese puts the base first in both
     * constructions: 「50の20%」 and 「50の20%引き」. の is the genitive and
     * cannot be reversed, and it is in any case far too common a particle to
     * claim. There is no Japanese phrasing that puts a percentage in front of
     * the number it applies to, so there is no surface word that could be
     * listed here without inventing one — and a keyword table is not the seam
     * that can swap two operands. Percentage arithmetic in Japanese needs an
     * `OpSignature` with the operands the other way round, which is a change to
     * a kind and is reported rather than faked here.
     */
  },
  /**
   * One key, "other", for every count and every slot.
   *
   * Japanese has no grammatical number at all: 一キログラム and 五キログラム
   * differ in the numeral and nowhere else, and 1.5 does not move the noun
   * either. CLDR agrees and says so in a form a test can assert —
   * `Intl.PluralRules("ja").resolvedOptions().pluralCategories` is the
   * one-element list `["other"]`, and `ja.test.ts` pins that rather than
   * trusting this comment.
   *
   * So the constant is returned directly instead of going through
   * `Intl.PluralRules`, which for `ja` is a lookup that can only ever produce
   * the string already written here. `en` and `uk` call the API because for
   * them it decides something.
   *
   * "other" and not a name of this language's own choosing (`"base"`, say),
   * because it is CLDR's generic category and the one every vocabulary in this
   * repo already writes for the count-free row (ruling R5). A `forms` table
   * translated from `en` needs no key renamed; it needs its `"one"` row
   * deleted.
   */
  selectForm: () => "other",
  /**
   * No space between the number and the unit — 5キログラム, 5kg, 5円 — which is
   * the whole of what this overrides.
   *
   * Japanese typography does not set a word off from what it attaches to, and
   * that is true of the katakana loanword unit names and of the Latin symbols
   * beside them alike: a Japanese page writes 5kg exactly as an English one
   * does, and 5キログラム the same way. So the gap is empty on every branch,
   * where `defaultRenderQuantity` spaces a word and closes up only a symbol.
   *
   * The label precedence is the default's, unchanged: a word, then a symbol,
   * then I10's degradation to the bare unit key for a half-translated
   * vocabulary. And `gap` still wins when the caller has resolved a separator
   * of its own (`Printer`'s `spacing`), because that is a typographic choice
   * belonging to the caller and not to the language.
   */
  renderQuantity: (p) => {
    const label = p.form ?? p.alias ?? p.symbol ?? p.unit;
    return `${p.number}${p.gap ?? ""}${label}`;
  },
  /**
   * Spaces around the operator, spelled or symbolic — which is what
   * `defaultRenderExpression` already does, and this is declared anyway so that
   * the reason Japanese does *not* close the gap here lives beside the language
   * it is a claim about. `renderQuantity` above closes the number-unit gap; this
   * one deliberately does not close the operand-operator gap, and the two look
   * inconsistent until the measurement below is in front of you.
   *
   * 十足す五 is how a Japanese page would set 10 + 5, with the verb closed up
   * against both operands, and it was written that way here. It cannot be:
   * **a glued verb is not a token this engine can take back.** Two independent
   * measurements, both of them about `lex` rather than about Japanese:
   *
   * - **ICU re-cuts the join.** Japanese is unspaced, so the whole of 十足す五
   *   is one letter run and `segment` decides where the words in it are. ICU
   *   answers `["十足", "す", "五"]` — 十足 is a word of its own, "ten pairs" of
   *   footwear — so the verb never reaches the keyword map and `Printer`'s own
   *   output came back `Cannot parse "十足す五" as a quantity`. Measured across
   *   the operand range: 一足す… and 十足す… fuse, and so does 八割る… (八割 is
   *   "eighty percent"); ひく, かける, わる, プラス and マイナス survive every
   *   join tried. Choosing a verb that happens to survive would be resting the
   *   printer on ICU's dictionary staying exactly where it is today.
   * - **`lex` absorbs digits onto the last word of a run**, which is what makes
   *   `m2` and `cm3` single unit words. A right operand that renders in Arabic
   *   digits — every count `spell` declines, so every non-integer — therefore
   *   fuses into the verb from the other side: 一ひく2.5 lexes `ひく2` and dies
   *   `Unknown unit "ひく2"`. No choice of verb escapes this one.
   *
   * So the space stays, and it is the same ruling core already made for English:
   * `Printer` refuses to glue a spelled operator even under `spacing: "tight"`
   * (`print.test.ts`, "spelled words never glue together"), because gluing
   * produces a different, unreadable word. Japanese is the language where that
   * is most obviously true, not the exception to it. `word` is present exactly
   * when `Printer` is spelling the operator, so it stays the condition rather
   * than a separate flag — it is what a future ja-only spacing rule would branch
   * on if the lexer ever learned to re-cut a token.
   */
  renderExpression: (p) =>
    p.word === undefined
      ? `${p.left} ${p.op} ${p.right}`
      : `${p.left} ${p.word} ${p.right}`,
});

export default japanese;
