import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Korean words for the angle units — the same four `en`, `uk` and `ja` name,
 * and **all four carry `forms`**, where `ja` could only manage three.
 *
 * That difference is the whole reason to read this file beside its neighbour.
 * `@smartput/angle/locale/ja` cannot print the Japanese word for a radian
 * because ICU cuts ラジアン into ラジ + アン, and Japanese has no space to stop
 * it: the segmenter is the only thing standing between a letter run and the
 * alias index there. **Korean is spaced.** 띄어쓰기 has been prescriptive since
 * the 1896 독립신문, `lex` has already cut at every space, and `korean`
 * therefore declares no `segment` at all — the assumption a reader arriving
 * from `ja.ts` or `zh.ts` will wrongly carry over. ICU still runs over each
 * letter run as the lexer's default, and it has no Korean dictionary behind it,
 * so it never cuts inside a Hangul run: 라디안 comes back whole and is
 * printable. `ko.test.ts` beside this file pins that against the Japanese
 * failure it mirrors.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `korean.selectForm` returns the constant `"other"` for every count and every
 * slot, because a Korean noun marks number nowhere: 일 도 and 오 도 differ in
 * the numeral and nowhere else, and neither a fraction nor a conversion target
 * moves the noun. CLDR agrees — `Intl.PluralRules("ko")` declares the single
 * category `"other"` — so rule 6's closed key set is one row per unit. This
 * table is `en`'s with the `"one"` row deleted; nothing was renamed.
 *
 * **`도` is both the word and the abbreviation**, which is what makes the
 * degree the one unit here whose `symbol` and `forms` row are the same string.
 * Korean writes 90도 and reads it as the full noun, exactly as Japanese writes
 * 90度; there are not two registers of this unit to tell apart the way there
 * are for `kg`/킬로그램 in `@smartput/mass/locale/ko`. The degree sign ° is what
 * a Korean page sets as readily as an English one and is deliberately **not**
 * the symbol: ° is not a letter, so `lex` skips it as unrecognised punctuation
 * and 90° would read as a bare 90. `@smartput/angle/locale/uk` chose it anyway;
 * a language whose own word is a single syllable does not have to.
 *
 * 도 is a common syllable and it is claimed here on purpose, with one known
 * consequence worth naming rather than hiding: Korean writes a temperature in
 * 도 too (25도), so an engine that installs this vocabulary beside a Korean
 * temperature one has two readings of the word and settles them by weight.
 * That is the ordinary cross-kind ambiguity `mm` already has between `length`
 * and `measure`, not a defect of this table — and it is a genuine ambiguity in
 * the language, which a vocabulary may not resolve by refusing to speak.
 *
 * **`rad` prints 라디안 and abbreviates to `rad`.** Korean technical writing
 * sets the SI symbol unchanged, and there is no Hangul short form to invent.
 * 호도 — the Sino-Korean name, the 호도 of 호도법 "radian measure" — is listed as
 * an **alias only**, on the same split `ja` makes for 弧度: it is read because
 * somebody may type it, and not printed because 5호도 is not how anybody writes
 * a quantity in radians. Reading a word and printing it are separate decisions,
 * and only printing has to be idiomatic as well as readable.
 *
 * `grad` and `turn` get their spelled Hangul nouns as symbols, because Korean
 * abbreviates neither. 곤 (gon) is left out for the reason `ja` leaves out ゴン
 * and 回: it is a single syllable, it is not what a Korean text calls this unit,
 * and a one-syllable alias is a false reading waiting for the first sentence
 * that contains it. 회 alone is out of `turn` on exactly that ground — 3회 is
 * "three times" long before it is "three revolutions" — and 바퀴 is out on a
 * different one: it is the native counter for a lap round something, it pairs
 * with the native numerals (한 바퀴, 두 바퀴) rather than with the Sino-Korean
 * ones this engine spells, and it reads as "wheel" as often as as "turn". 회전
 * is unambiguous and is what a tachometer or a gear ratio is written with. R8
 * wants an explicit symbol on every unit, never an invented or unreadable one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in a Korean engine and
 * the micro path (`parseAngle`) cannot drift from it.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/ko` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "angle",
  units: {
    // The unit `ja` had to leave wordless. Korean says 라디안, ICU leaves it
    // whole, and so it is both an alias and the printed form.
    rad: {
      aliases: [...alias("rad"), "라디안", "호도"],
      symbol: "rad",
      forms: { other: "라디안" },
    },
    deg: {
      aliases: [...alias("deg"), "도"],
      symbol: "도",
      forms: { other: "도" },
    },
    grad: {
      aliases: [...alias("grad"), "그라디안"],
      symbol: "그라디안",
      forms: { other: "그라디안" },
    },
    turn: {
      aliases: [...alias("turn"), "회전"],
      symbol: "회전",
      forms: { other: "회전" },
    },
  },
});
