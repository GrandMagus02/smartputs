import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Korean words for the duration units.
 *
 * `ko` is the bare tag, modern standard Korean in South Korean orthography. The
 * kind next door names no language at all — six ratios, six unit ids and the
 * magnitude bands `typical` records — and this file names `duration` by **id
 * string** rather than importing it, so `@smartput/duration/locale/ko` links no
 * ratio table. `composeLocale` is where the two halves meet.
 *
 * **One form key.** `korean.selectForm` returns the constant `"other"` for every
 * count and every slot: Korean marks number nowhere on a noun — 일 초 and 오 초
 * differ in the numeral and nowhere else — and CLDR agrees,
 * `Intl.PluralRules("ko")` declaring the single category `other`. A table
 * translated from `en.ts` needs no key renamed; it needs its `"one"` row
 * deleted.
 *
 * **Every unit here prints Hangul, which is the register Korean actually uses
 * for time and is not available to `ja.ts` next door for `ms`.** Korean is
 * spaced, `korean.segment` is undefined, and `lex` has already cut at every
 * space, so 밀리초 reaches the resolver as one token because a Korean writer
 * wrote it as one word. Japanese has the same word — 「ミリ秒」 — and cannot use
 * it, because ICU's dictionary cuts it into ミリ + 秒 and the tail would read as
 * *seconds*. No dictionary is consulted here and none can veto a row, so `ms`
 * gets 밀리초 and the whole kind speaks one register.
 *
 * **The one unit Korean cannot spell is the day, and the collision is a numeral
 * rather than a segmenter.** The Korean for a day-long span is 일, which is also
 * the Sino-Korean 1 — the very same syllable, in `ko-cardinals.ts`'s `KO_DIGITS`
 * — and `foldNumerals` runs before anything is looked up in the alias index. A
 * word token made of nothing but numeral syllables is rewritten into a number,
 * so 「3일」 lexes as `3` and then as `1`, two adjacent numbers the parser
 * refuses. An alias of 일 would therefore be dead weight: `assertLocaleContract`
 * would pass it, because the alias index has no idea the numeral pass exists,
 * and no input could ever reach it. `ko.test.ts` measures that directly —
 * `koreanNumerals(["일"])` claiming the value 1, and the engine refusing 「3일」
 * — for the same reason `ja.ts` re-runs its segmentations: so that a change
 * upstream shows up as a failing test rather than as a silent gap.
 *
 * What is printed instead is 일간, 일 with the 間 suffix that marks a *span*:
 * 「3일간 여행」 is a three-day trip. It is ordinary Korean, it is unambiguous
 * exactly where a printer puts it — immediately after a number — and 간 is not a
 * numeral syllable, so the word survives the fold. The rejected alternative was
 * keeping the Latin "d" for this one unit, which would have printed 「2일간」's
 * value as "2d" beside 「5초」 and 「1.5시간」: one kind in two registers, chosen
 * by an accident of Korean orthography rather than by Korean. The other rejected
 * one was the native 하루/이틀/사흘, which is a suppletive series that stops
 * being productive almost immediately and is a numeral-plus-noun rather than a
 * unit word at all.
 *
 * The same 간 suffix is the reason `wk` lists three spellings. 주 is the bare
 * week and what a heading or a table column writes; 주일 and 주간 are the
 * suffixed spans, both ordinary in running text (「3주일」, 「2주간」). Only 주
 * is printed, because it is the shortest spelling that is unambiguous after a
 * number and because 주간 on its own also means "daytime" — a homograph that is
 * harmless in the reading direction, where every reading is a candidate the
 * solver ranks, and would be a poor choice in the writing direction, where the
 * output has to stand alone.
 *
 * **時 versus 時間, exactly as in Japanese.** `h` is 시간 and never the bare 시:
 * 「3시」 is three o'clock, a point on a clock rather than a length of time, and
 * `datetime` is the kind that reads it. 시간 is the span and the only spelling
 * this unit claims.
 *
 * **The symbols are the Hangul words themselves**, and that is R8 working as
 * written rather than a shortcut. 초, 분, 시간, 일간 and 주 are at once the word,
 * the abbreviation and what a Korean clock face, timetable and spreadsheet
 * print; there is no longer form to spell out and nothing to shorten. `ms` is
 * the exception in the other direction — Korean datasheets write "ms" in Latin,
 * so that is its symbol and 밀리초 is the word — which is why it is the one unit
 * whose `forms` row and `symbol` differ.
 *
 * **Aliases** reuse the Latin set from `units.ts` through `aliasesFor` rather
 * than retyping it, so the micro path (`parseDuration`) and the engine path
 * agree by construction — including the "m" that means minutes here and metres
 * in `length`, an ambiguity that is the solver's to rank and not this file's to
 * remove — and the Hangul words are appended.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "duration",
  units: {
    ms: {
      aliases: [...alias("ms"), "밀리초"],
      symbol: "ms",
      forms: { other: "밀리초" },
    },
    s: { aliases: [...alias("s"), "초"], symbol: "초", forms: { other: "초" } },
    min: { aliases: [...alias("min"), "분"], symbol: "분", forms: { other: "분" } },
    // 시간 and never the bare 시, which is o'clock and belongs to `datetime`.
    h: { aliases: [...alias("h"), "시간"], symbol: "시간", forms: { other: "시간" } },
    // 일 is absent and unreachable: it is the Sino-Korean 1, and `foldNumerals`
    // rewrites an all-numeral word into a number before the alias index is
    // consulted. 일간 is the span spelling and survives, since 간 is no numeral.
    d: { aliases: [...alias("d"), "일간"], symbol: "일간", forms: { other: "일간" } },
    wk: {
      aliases: [...alias("wk"), "주", "주일", "주간"],
      symbol: "주",
      forms: { other: "주" },
    },
  },
});
