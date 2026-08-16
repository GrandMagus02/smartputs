import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Japanese words for the angle units — the same four `en`, `uk` and `de` name,
 * and **three of the four carry `forms`**. The fourth is the interesting one,
 * and it is the reason this file is longer than its five neighbours.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `japanese.selectForm` returns the constant `"other"` for every count and
 * every slot, because Japanese has no grammatical number: 一度 and 五度 differ
 * in the numeral and nowhere else, and neither a fraction nor a conversion
 * target moves the noun. CLDR agrees — `Intl.PluralRules("ja")` declares the
 * single category `"other"` — so rule 6's closed key set is one row. This table
 * is `en`'s with the `"one"` row deleted; nothing was renamed. Against
 * Ukrainian's eight keys and German's four, that is the language and not a
 * table stopping halfway.
 *
 * **`rad` prints its Latin symbol, because ICU cuts the Japanese word in two.**
 * Japanese for a radian is ラジアン, and `japanese.segment` — which is
 * `Intl.Segmenter` scoped to the three Japanese scripts — returns
 * `["ラジ", "アン"]` for it. Measured, not assumed, and pinned in `ja.test.ts`
 * beside this file. Japanese puts no space between words, so segmentation is
 * the *only* thing standing between a letter run and the alias index: a word
 * ICU splits reaches `lex` as two word tokens, no analyzer is ever handed the
 * whole of it, and 「5ラジアン」 dies in the parser. That is precisely the
 * failure `assertLocaleContract` names for a printed *phrase* in a spaced
 * language — "no single token can read it back" — arriving through a different
 * door, and a check on shape alone would not catch it, which is why the test
 * asserts the ICU cut directly.
 *
 * So ラジアン is not listed at all: an alias `lex` can never produce is dead
 * weight in the index, and completion would happily offer it and hand the user
 * text that fails to evaluate. `rad` therefore carries no `forms` and renders
 * through its symbol, `5rad` — which is what a Japanese maths page writes
 * anyway, and which round-trips, since a Latin run has no character of a
 * declared script and `scriptSegmenter` returns it whole.
 *
 * 弧度 — the formal Sino-Japanese name, the 弧度 of 弧度法 "radian measure" — is
 * the rejected alternative and is listed as an **alias only**. ICU does return
 * it whole, so it could have been printed; it is not, because 「5弧度」 is not
 * how anybody writes a quantity in radians. Reading a word and printing it are
 * separate decisions, and only printing has to be idiomatic as well as
 * readable.
 *
 * **`grad` has the same problem and a way out.** Japanese names the gradian
 * グラード or ゴン, and ICU cuts ゴン into `["ゴ", "ン"]` exactly as it cuts
 * ラジアン — so ゴン is left out for the same reason — while グラード comes back
 * whole. That is the whole difference between these two units: the gradian has
 * a second Japanese name that survives segmentation and the radian does not.
 *
 * `symbol` is what Japanese itself writes. 度 is a genuine abbreviation and a
 * genuine word at once — Japanese writes 「90度」 and reads it as the full noun,
 * so the symbol and the form are one string here rather than two registers of
 * one unit the way `kg`/キログラム are in `@smartput/mass/locale/ja`. The
 * degree sign ° is what a Japanese page sets for an angle as readily as an
 * English one, and it is deliberately **not** the symbol: ° is not a letter, so
 * `lex` skips it as unrecognised punctuation and 「90°」 would read as a bare
 * 90. `@smartput/angle/locale/uk` chose it anyway; a language whose own word is
 * a single character does not have to. The other two get their spelled names,
 * because Japanese abbreviates neither. R8 wants an explicit symbol on every
 * unit, never an unreadable one.
 *
 * 回 alone is left out of `turn`, and this is a judgement about frequency
 * rather than about meaning. It is the ordinary counter for "times" — 三回 is
 * "three times" long before it is "three revolutions" — and a single common
 * character claimed as a unit alias is a false reading waiting for the first
 * sentence that contains it. 回転 is unambiguous and is what a tachometer or a
 * gear ratio is written with.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in a Japanese engine
 * and the micro path (`parseAngle`) cannot drift from it.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/ja` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "angle",
  units: {
    // The one unit in these six packages with no `forms` at all — for the same
    // reason `@smartput/area/locale/en` gives `m2` none, reached by a different
    // route. English cannot print "square metres" because `lex` ends a word at
    // the space; Japanese cannot print ラジアン because ICU ends a word inside
    // it. Either way the printer would emit text it cannot read back, and the
    // symbol is what is left.
    rad: {
      aliases: [...alias("rad"), "弧度"],
      symbol: "rad",
    },
    deg: {
      aliases: [...alias("deg"), "度"],
      symbol: "度",
      forms: { other: "度" },
    },
    grad: {
      aliases: [...alias("grad"), "グラード"],
      symbol: "グラード",
      forms: { other: "グラード" },
    },
    turn: {
      aliases: [...alias("turn"), "回転"],
      symbol: "回転",
      forms: { other: "回転" },
    },
  },
});
