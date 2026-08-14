import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Turkish words for the duration units.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`. The
 * shape is `en.ts`'s, unit for unit: the same `kind` named by **id string**
 * rather than imported, `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8), because the renderer's
 * no-symbol branch joins number and unit without a space and a forgotten symbol
 * would move a byte rather than fail.
 *
 * **One key, where Ukrainian needs eight and English two.**
 * `turkish.selectForm` returns the constant `"other"` — Turkish does not agree a
 * noun with the number in front of it, so "1 saat", "5 saat" and "1,5 saat" are
 * one word three times and "5 saatler" is not a plural but a mistake. Every
 * table below is therefore a single row, and that is the finished answer rather
 * than half of an English one. It is worth saying out loud on this kind in
 * particular: `duration` is where a translator's instinct to write a plural is
 * strongest, because these are the six nouns every language pluralises most
 * often in prose — but *after a numeral* Turkish does not, and prose is not what
 * this table renders.
 *
 * **Every unit gets a word, which is not true of every kind here.** A duration
 * name is one letter run in Turkish — "milisaniye", "saniye", "dakika", "saat",
 * "gün", "hafta" — so each of them lexes back as a single token and can be both
 * printed and read. Compare `@smartput/speed/locale/tr.ts`, where "km/sa" is a
 * compound and no `forms` row is possible at all.
 *
 * **Symbols are the Turkish abbreviations, not the SI ones, wherever Turkish
 * actually abbreviates.** "sn" for saniye, "dk" for dakika and "sa" for saat are
 * what a Turkish timetable, a stopwatch and a road sign print, and "sa" in
 * particular is the second half of "km/sa" — the Turkish spelling of kph. Where
 * Turkish has no settled abbreviation the spelled nominative stands as the
 * symbol instead of an invented one (R8): "gün" and "hafta" are written out in
 * full even in a table header, and "g" is unavailable anyway because it is the
 * gram. The millisecond keeps the international "ms", which Turkish borrows
 * unchanged. Since every unit here also declares a `forms` row, none of these
 * symbols reaches ordinary output — the word wins — and they are recorded
 * because R8 wants the written abbreviation on the unit and because `Printer`'s
 * `symbols: true` mode prints exactly them.
 *
 * **Case endings are left to the language, and this is the kind where that is
 * most visible.** Turkish glues its cases on with vowel harmony, and these six
 * words draw on both halves of it: "saate" beside "güne" (dative `-a` after a
 * back vowel, `-e` after a front one), "saatte" beside "günde" (locative
 * hardened to `-t` after the voiceless `t` of "saat"), "dakikaya" and "saniyeye"
 * (the `-y-` buffer after a vowel-final stem). `turkish`'s suffix stripper
 * enumerates every one of those variants precisely so a vocabulary does not have
 * to, and its `minStem: 3` is what makes it safe here: "gün" is exactly three
 * letters, so "günde" strips back to it, while the genitive-looking `-ün` at its
 * own end leaves a one-letter stem and is refused. The two-letter casualty the
 * language records — "ay", the month, which cannot be recovered from "ayda" —
 * never arises, because this kind stops at the week.
 *
 * The Latin aliases are kept rather than replaced: a Turkish developer types
 * "2 h" and a Turkish sentence writes "2 saat", and a vocabulary that reads only
 * one of them makes the other a parse error.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "duration",
  units: {
    ms: {
      aliases: [...alias("ms"), "milisaniye"],
      symbol: "ms",
      forms: { other: "milisaniye" },
    },
    s: {
      aliases: [...alias("s"), "sn", "saniye"],
      symbol: "sn",
      forms: { other: "saniye" },
    },
    min: {
      aliases: [...alias("min"), "dk", "dakika"],
      symbol: "dk",
      forms: { other: "dakika" },
    },
    h: {
      aliases: [...alias("h"), "sa", "saat"],
      symbol: "sa",
      forms: { other: "saat" },
    },
    d: {
      // "gun" is the diacritic-free spelling an ASCII keyboard produces, listed
      // for the same reason `tr-cardinals.ts` lists "uc" beside "üç": the
      // language's case folds handle the dotted/dotless i and nothing else, so
      // ü → u is a vocabulary's business. It is a reading key only — "gün" is
      // what this unit prints.
      aliases: [...alias("d"), "gün", "gun"],
      symbol: "gün",
      forms: { other: "gün" },
    },
    wk: {
      aliases: [...alias("wk"), "hafta"],
      symbol: "hafta",
      forms: { other: "hafta" },
    },
  },
});
