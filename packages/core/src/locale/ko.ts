import type { AnalyzedForm, Analyzer, Language } from "../types";
import { defineLanguage } from "./define";
import { identity } from "./helpers";
import { koreanNumerals, koreanSpeller } from "./ko-cardinals";

/**
 * The syllable block range, U+AC00–U+D7A3, and the modulus that recovers a
 * block's 받침 (final consonant).
 *
 * A Hangul syllable is composed rather than looked up: its codepoint is
 * `0xAC00 + (initial × 21 + medial) × 28 + final`, so `(code - 0xAC00) % 28` is
 * the final's index in the standard jamo order, and `0` means the block ends in
 * its vowel. That one arithmetic fact is the whole of the euphonic conditional
 * below — no jamo table is needed, and no NFD decomposition either, which
 * matters because `normalize()` has already run NFKC and every syllable
 * reaching here is composed.
 */
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const FINALS = 28;
/** ㄹ's index in the 받침 order. The one consonant that behaves like a vowel. */
const RIEUL = 8;

/**
 * The 받침 index of the last syllable of `stem`, or `null` when the stem does
 * not end in a Hangul syllable at all.
 *
 * `null` is not "no final" — it is "the question does not apply", and the two
 * have to be told apart. A stem of "kg" or "ml" has no written final consonant
 * because it has no Hangul in it; which particle a Korean writer attaches to it
 * is decided by how the *abbreviation is read aloud* (kg is 킬로그램, so 을), and
 * nothing in the string says so. Every particle is therefore accepted after a
 * non-Hangul stem, which is also the generous reading: real input writes both
 * kg를 and kg을.
 */
const finalOf = (stem: string): number | null => {
  const chars = [...stem];
  const last = chars[chars.length - 1];
  if (last === undefined) return null;
  const code = last.codePointAt(0) ?? 0;
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null;
  return (code - HANGUL_FIRST) % FINALS;
};

/** The stem ends in a vowel. */
const openSyllable = (final: number) => final === 0;
/** The stem ends in any consonant. */
const closedSyllable = (final: number) => final !== 0;
/**
 * The stem ends in a vowel *or* in ㄹ — the environment 로 takes, and the reason
 * the conditional needs more than a boolean. ㄹ is the one 받침 that does not
 * demand the epenthetic 으: 서울로, never 서울으로.
 */
const openOrRieul = (final: number) => final === 0 || final === RIEUL;
/** Any consonant except ㄹ — the environment 으로 takes. */
const closedButRieul = (final: number) => final !== 0 && final !== RIEUL;
/** No conditional: the particle has one shape. */
const anywhere = () => true;

/**
 * The particles a unit noun carries, each with the environment it appears in.
 *
 * Korean is agglutinative and its particles are *bound*: 그램으로 is one
 * orthographic word and one token, because `Intl.Segmenter("ko")` breaks Korean
 * at spaces and nowhere else (measured — `ko.test.ts` pins it). So unlike
 * Japanese, where を and から arrive as free tokens the keyword table can claim,
 * a Korean particle reaches the resolver welded to the unit word, and stripping
 * it is the *only* way 그램으로 is ever recognised as grams. That is why this
 * table exists and why it is an analyzer rather than a keyword list.
 *
 * The euphonic alternation is implemented, not approximated, and this is where
 * it can do work. Each pair below picks its shape by the final consonant of the
 * word in front of it, and because the analyzer still has that word in hand —
 * the particle is glued to it — the condition is actually decidable here. The
 * keyword table cannot decide it even in principle: by the time a particle is a
 * separate token the stem is a *different* token, so `keywords` lists both
 * spellings flat and lets the environment go unchecked. One conditional, in the
 * one place that can evaluate it.
 *
 * What the check buys is a refusal: 미터으로 and 그램로 are ungrammatical, and
 * without the condition both would be stripped to a stem that resolves,
 * teaching the engine to accept a spelling no Korean writes. It also keeps the
 * stripper off words that merely end in these syllables — 유로 (euro) survives
 * because 유 is not a plausible stem, and 킬로 because 킬 is not either.
 *
 * The six entries, and why each is a unit noun's business:
 *
 *   을 / 를   accusative — the *source* of a conversion: 5킬로그램을 그램으로
 *   으로 / 로 directional — the *target*: 그램으로 ("into grams")
 *   에서      ablative — "from": 킬로그램에서 그램으로
 *   에        locative — "per" and "at": 초에 (per second)
 *   은 / 는   topic — 5킬로그램은 몇 그램 ("as for 5 kg, how many grams")
 *   이 / 가   nominative — 1킬로그램이 몇 그램
 *
 * 의 (genitive) and 와/과 ("and") are left out. 의 marks a possessor and never
 * a measured quantity, and 와/과 is a conjunction whose stripped stem would be
 * indistinguishable from a two-unit phrase the parser should be seeing as two
 * tokens.
 */
const PARTICLES: ReadonlyArray<readonly [string, (final: number) => boolean]> = [
  ["으로", closedButRieul],
  ["에서", anywhere],
  ["로", openOrRieul],
  ["을", closedSyllable],
  ["를", openSyllable],
  ["은", closedSyllable],
  ["는", openSyllable],
  ["이", closedSyllable],
  ["가", openSyllable],
  ["에", anywhere],
];

/**
 * Strip a bound particle, when the syllable in front of it allows that
 * particle's shape.
 *
 * Every matching particle yields a form, exactly as `suffixStripper` pushes one
 * per matching suffix: 그램으로 produces 그램 (through 으로) and also 그램으
 * (through 로, since 으 is open), and the second is harmless because the
 * resolver only keeps forms that hit a registered alias. Choosing the longest
 * match instead would be one fewer junk form and one more rule to get wrong the
 * day a stacked particle (에서는) needs peeling twice.
 *
 * `weight: -2` is the penalty `en` and `uk` both use for a stripped form, so an
 * exact alias always outranks one reached this way. There is no `minStem`: a
 * Korean unit noun is routinely a single syllable — 원, 초, 분, 도 — where
 * Ukrainian needed `minStem: 3` to protect its two-letter symbols, and a floor
 * of even 2 would make 분으로 ("into minutes") unreadable.
 */
const particleStripper = (weight = -2): Analyzer => {
  return (surface) => {
    const out: AnalyzedForm[] = [];
    for (const [particle, allowed] of PARTICLES) {
      if (!surface.endsWith(particle)) continue;
      const stem = surface.slice(0, surface.length - particle.length);
      if (stem.length === 0) continue;
      const final = finalOf(stem);
      if (final !== null && !allowed(final)) continue;
      out.push({ form: stem, weight });
    }
    return out;
  };
};

/**
 * The Korean language: how Korean is read and written, with no word for any
 * unit in it.
 *
 * `ko` is the bare tag and means what CLDR means by it — modern standard Korean
 * in South Korean orthography, which is what `Intl.NumberFormat("ko")` and
 * `Intl.PluralRules("ko")` answer for below. `ko-KP` would differ in the
 * initial-sound law (륙 for 육) and in a handful of unit loanwords, and neither
 * is a fork of this file: the numeral variant is a row in `ko-cardinals.ts`
 * (declared, reading-only), and unit words are a `Vocabulary`'s business.
 *
 * **Korean is spaced, so there is no `segment` here — and that is the one thing
 * a reader arriving from `ja.ts` or `zh.ts` will assume wrongly.** Those two
 * files install a segmenter because Japanese and Chinese put no space between
 * words at all, and a whole sentence arrives as one letter run. Korean has had
 * 띄어쓰기 since the 1896 독립신문 and its spacing rules are prescriptive: words
 * are separated, and `lex` has already cut at every space before segmentation is
 * consulted. Installing a segmenter would be asking ICU to invent breaks it does
 * not have — measured, and pinned in `ko.test.ts`: `Intl.Segmenter("ko")`
 * returns 킬로그램을, 이십이 and 일억이천삼백사십오만육천칠백팔십구 whole, because
 * there is no Korean dictionary behind it. It *does* break at the script
 * boundary (kg를 comes back as kg + 를), which is a fact this language depends
 * on twice below.
 *
 * What Korean needs instead of segmentation is the analyzer: its particles are
 * bound, so the morphology arrives inside the token rather than beside it.
 *
 * And one thing that makes it simpler than every European language here: a
 * Korean noun has no plural, no case ending and no agreement, so `selectForm`
 * has exactly one answer. Words for units are not in this file at all — they
 * are `Vocabulary` tables beside the kinds that declare the units, and they
 * reach this object through `composeLocale`.
 */
export const korean: Language = defineLanguage({
  id: "ko",
  // Read from CLDR rather than transcribed, the same as every language here.
  // This runtime's `Intl.NumberFormat("ko")` groups with "," and marks the
  // decimal with "." — the same visible ASCII pair `en` and `ja` produce, which
  // is exactly the fact worth pinning: a hand-written `NumberFormatSpec` that
  // happened to agree today would be indistinguishable from one that stopped
  // agreeing tomorrow. `ko.test.ts` pins the pair this runtime produces.
  numberFormat: "intl",
  /**
   * `identity()` first — the resolver reaches a surface only through the forms
   * some analyzer produced (`third-language.test.ts` records this), so a
   * language without it cannot reach its own aliases — and then the particle
   * stripper, which is Korean's whole morphology as far as a unit noun is
   * concerned.
   *
   * There is no `suffixStripper` beside it and no `compoundSplitter` either,
   * and both absences are claims about the language. A Korean noun does not
   * inflect: 킬로그램 is 킬로그램 in every position, singular and plural,
   * subject and object alike, so there is no ending to remove. What looks like
   * an ending is a particle, and a particle is a separate morpheme that happens
   * not to be written with a space — which is precisely what `particleStripper`
   * removes, on a euphonic condition a blind suffix list could not express.
   * Compounding is real in Korean (제곱미터, 킬로그램) but it is head-final and
   * transparent: the vocabulary lists the compound, and splitting it would
   * leave 미터 where the writer wrote 제곱미터, a *different unit* of the same
   * kind — the same trap `zh.ts` names for 千克.
   */
  analyze: [identity(), particleStripper()],
  numerals: koreanNumerals,
  spell: koreanSpeller,
  keywords: {
    /**
     * The particles that mark the **source**, and only those.
     *
     * Korean is head-final, so a particle is a postposition: it attaches to the
     * end of the phrase it governs. A particle on the left operand therefore
     * lands exactly where an infix operator goes — `5kg를 그램` is
     * `<source> <op> <target>` as far as the parser is concerned, even though
     * 를 does not *mean* "in". 을/를 is the accusative (5킬로그램을 그램으로 —
     * "convert 5 kg into grams"), and 에서 is "from", the origin of a conversion
     * the way English "from … to" is.
     *
     * Both spellings of the accusative are listed flat, with no condition
     * between them, and that is the counterpart of `particleStripper`'s
     * conditional rather than a contradiction of it: 을 follows a consonant and
     * 를 a vowel, but by the time either is a *token* of its own the word that
     * decided the choice is a different token, and `Keyword` maps surfaces to
     * meanings with nothing in between. Recognition is many-to-one (I6); the
     * environment is the writer's problem and both surfaces mean `in`.
     *
     * **Two consequences of a bound particle are reported here rather than
     * papered over, because neither has a seam in this file to close it.**
     *
     * The first is on the reading side. A particle is only ever a *token* after
     * a Latin stem, where the segmenter splits at the script change, so
     * 「0.5kg를 그램」 parses and 「0.5킬로그램을 그램으로」 does not: written
     * entirely in Hangul both particles are welded to their nouns,
     * `particleStripper` peels both off, and what reaches the parser is two bare
     * unit words with no operator between them. Every conversion a Korean engine
     * can read today is therefore mixed-script, which is a real restriction on a
     * language whose own orthography never needs the Latin. The honest fix is a
     * lexer that can cut a known particle off the tail of a Hangul run — the
     * same change the target particle needs, below — and it is a change to core.
     *
     * The second is on the writing side, and it is 한글 맞춤법 §41: 조사는 그
     * 앞말에 붙여 쓴다, a particle is written closed up against the word in front
     * of it. `Printer` assembles a conversion as
     * `<operand> <keywords.in[0]> <target>` with spaces of its own, so a `ko`
     * locale prints 「이 킬로그램 을 그램」 where Korean writes 「이 킬로그램을
     * 그램」. Unlike the number-unit gap, which `renderQuantity` owns, there is no
     * language hook for this join, and no reordering of this list helps: all
     * three surfaces are bound particles and every one of them wants to be glued
     * to the operand. Reported, not faked — the output still re-parses, because
     * 을 is a token again and means `in` again, so what is wrong with it is the
     * spelling and not the reading.
     *
     * **로 and 으로 are deliberately absent**, and this is the decision most
     * worth reading twice, because the directional particle is the one that
     * actually *means* "into" — 그램으로 is exactly "into grams". Two facts
     * settle it, and they compound:
     *
     * 1. **It marks the target, so it arrives last.** An infix `in` cannot
     *    reach a trailing token: the parser leaves it unconsumed and throws
     *    (`pratt.test.ts`, "a trailing off is left unconsumed and fails"). This
     *    is the same wall `ja.ts` documents for に and へ. Claiming 로 would
     *    turn one kind of failure into another while spending two surface words
     *    — a dead entry that reads as coverage.
     * 2. **In native orthography it is not a token at all.** 그램으로 is one
     *    word to ICU, so the surface 으로 only ever appears standalone after a
     *    Latin stem, where the segmenter splits at the script change (measured:
     *    kg으로 → kg + 으로). Even there it is trailing, by (1).
     *
     * So the directional particle is handled where it can be handled — stripped
     * off the target word by `particleStripper`, so 그램으로 resolves as grams —
     * and the honest fix for the trailing token itself is a lexer that can drop
     * a target particle, which is a change to core and is reported rather than
     * faked here.
     *
     * 은/는 (topic) and 이/가 (nominative) are refused on the other ground, the
     * one `ja.ts` gives for は: they are among the commonest particles in the
     * language, and a keyword table that claims them claims a large slice of
     * ordinary text. The stripper still removes them, which is where they
     * belong — 5킬로그램은 몇 그램 needs the *unit* read, not an operator
     * invented.
     */
    in: ["을", "를", "에서"],
    /**
     * The infix arithmetic nouns, which are the fortunate exception to
     * head-finality: 5 더하기 3 really is written with the operator between the
     * operands, because these are the *nominalised* verb forms a calculator and
     * a primary-school textbook use, not the finite verbs (더한다, 뺀다) that
     * would end the sentence.
     *
     * 플러스 and 마이너스 join the additive pair because the loanwords are in
     * genuinely common use for signed numbers, exactly as in Japanese. There is
     * no matching loanword for the other two — nobody writes 타임스 or 디바이드
     * — so none is listed.
     */
    plus: ["더하기", "플러스"],
    minus: ["빼기", "마이너스"],
    times: ["곱하기"],
    over: ["나누기"],
    /**
     * `by`, `of` and `off` are all absent, and all three for word-order reasons
     * rather than for want of a word.
     *
     * `by` exists in `en` only so "divided by" can be swallowed into one
     * operator. Korean has no two-word division: 나누기 is a single nominalised
     * verb, and the particle that would translate "by" is 으로 (…으로 나누다),
     * which is postposed to the divisor and would land after it.
     *
     * `of` and `off` are the harder loss and worth naming precisely. This engine
     * reads both with the percentage on the left and the base on the right —
     * "20% of 50", "20% off 50". Korean puts the base first in both: 50의 20%
     * and 50달러에서 20% 할인. 의 is the genitive, cannot be reversed, and is far
     * too common a particle to claim; 할인 ("discount") is a noun that *follows*
     * the percentage with the base nowhere after it. There is no Korean phrasing
     * that puts a percentage in front of the number it applies to, so there is
     * no surface word that could be listed here without inventing one — and a
     * keyword table is not the seam that can swap two operands. Percentage
     * arithmetic in Korean needs an `OpSignature` with the operands reversed,
     * which is a change to a kind and is reported rather than faked here.
     */
  },
  /**
   * One key, `"other"`, for every count and every slot.
   *
   * Korean marks number nowhere on a noun: 일 킬로그램 and 오 킬로그램 differ in
   * the numeral and nowhere else, and 1.5 does not move the noun either. The
   * plural suffix 들 exists but is pragmatic rather than grammatical — it marks
   * salience, is optional wherever it is possible at all, and is never used with
   * a measured quantity (킬로그램들 is not Korean) — so there is nothing for a
   * second key to select. CLDR agrees and says so in a form a test can assert:
   * `Intl.PluralRules("ko").resolvedOptions().pluralCategories` is the
   * one-element `["other"]`, and `ko.test.ts` pins that rather than trusting
   * this comment.
   *
   * So the constant is returned directly instead of going through
   * `Intl.PluralRules`, which for `ko` is a lookup that can only ever produce
   * the string already written here. The slot is ignored for the same reason:
   * `conversion-target` selects a grammatical *case* elsewhere in this repo
   * (Ukrainian's locative, German's dative), and Korean has no case to select —
   * the case is the particle, the particle is not printed, and 그램 is 그램
   * wherever it stands. `count === undefined` needs no branch either; ruling
   * R5's fallback and the ordinary answer are the same string.
   *
   * "other" and not a name of this language's own choosing, because it is
   * CLDR's generic category and what every vocabulary in this repo already
   * writes for the count-free row. A `forms` table translated from `en` needs no
   * key renamed; it needs its `"one"` row deleted.
   */
  selectForm: () => "other",
  /**
   * No space between the number and the label — 5킬로그램, 5kg, 5% — which is the
   * whole of what this overrides, since `defaultRenderQuantity` spaces a word
   * and closes up only a symbol.
   *
   * This is the one place Korean orthography is *permissive* and this file has
   * to choose. 한글 맞춤법 §43 makes a unit noun a separate word, to be spaced —
   * but its own proviso allows it closed up when it follows Arabic numerals
   * ("다만, 순서를 나타내는 경우나 숫자와 어울리어 쓰이는 경우에는 붙여 쓸 수
   * 있다"), and that permitted form is what running text, product labels and
   * every input this engine will be handed actually use. Rendering 5 킬로그램
   * where the user typed 5킬로그램 would also mean the engine could not read back
   * its own output as one token, since the space it emitted is a token boundary
   * to `lex`.
   *
   * A Latin symbol takes the same treatment (5kg), which is both what the
   * default already did and what a Korean page does with a mixed-script
   * quantity. The label precedence is the default's, unchanged: a word, then a
   * symbol, then I10's degradation to the bare unit key for a half-translated
   * vocabulary. `gap` still wins when the caller has resolved a separator of its
   * own (`Printer`'s `spacing`), because that is a typographic choice belonging
   * to the caller and not to the language.
   */
  renderQuantity: (p) =>
    `${p.number}${p.gap ?? ""}${p.form ?? p.alias ?? p.symbol ?? p.unit}`,
  /**
   * No `renderExpression`, and that is a decision rather than an omission.
   *
   * `ja.ts` overrides it because Japanese closes a spelled operator up against
   * both operands (10たす5). Korean does not: 더하기 is a word, Korean separates
   * words, and 십 더하기 오 is written with both spaces — which is exactly what
   * `defaultRenderExpression` already produces for a spelled operator and for a
   * symbolic one alike. Declaring an override that reproduced the default would
   * be a line that could only ever drift away from it.
   */
});

export default korean;
