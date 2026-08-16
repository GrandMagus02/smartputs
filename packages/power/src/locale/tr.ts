import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Turkish words for the power units — the same five units `en.ts` names, the
 * same kind named by **id string** rather than imported, and the same explicit
 * `symbol` on every unit (ruling R8), because the renderer's no-symbol branch
 * joins number and unit without a space and a forgotten symbol would move a byte
 * rather than fail.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`.
 *
 * **One key per unit, where English needs two and Ukrainian eight.**
 * `turkish.selectForm` returns the constant `"other"`: Turkish does not agree a
 * noun with the number in front of it, so "1 kilovat", "5 kilovat" and
 * "1,5 kilovat" are one word three times and "5 kilovatlar" is not a plural but
 * a mistake. Every table below is a single row, finished rather than half
 * written.
 *
 * **`vat`, not `watt`.** TDK transcribes the borrowed unit into Turkish
 * spelling, and a Turkish sentence writes "60 vatlık ampul". The Latin spellings
 * are not lost — `aliases` derives "watt" and "watts" from `units.ts` before the
 * Turkish ones are appended, so a datasheet typed in either orthography reads —
 * but the word this vocabulary *prints* is the Turkish one.
 *
 * **`hp` is the one unit here that Turkish names with a phrase, and the phrase
 * loses to its own elision.** The full name is "beygir gücü", literally
 * horse's-power: two tokens, and `parse/lex.ts` builds a word out of a run of
 * letters, so a space ends the token and "300 beygir gücü" would reach the
 * resolver as "beygir" then "gücü" — the second of which no alias can claim, and
 * a stranded token fails the whole parse rather than being ignored. That is the
 * exact failure `@smartput/power/locale/uk.ts` measured with "кінська сила" and
 * removed.
 *
 * Turkish escapes it where Ukrainian could not, because the elision is already
 * the ordinary spoken form: a car has "300 beygir", full stop, and nobody hears
 * the missing "gücü". So `beygir` is what this unit prints and reads, and it is
 * a real Turkish word for the unit rather than an abbreviation standing in for
 * one. The symbol is "BG", the initials of the phrase and what a Turkish spec
 * sheet prints beside the number; it is listed in `aliases` so the round trip
 * closes, since a symbol the printer emits and the lexer cannot return is the
 * bug that entry in `uk.ts` exists to describe.
 *
 * **Symbols.** `W`, `kW`, `MW` and `GW` are SI's and TSE adopts them unchanged;
 * each folds onto a derived alias on the way back in ("kW" → "kw"), which is the
 * mechanism by which a `symbols: true` print parses back. Since every unit here
 * also declares a `forms` row, none of them reaches ordinary output — the word
 * wins — and they are recorded because R8 wants the written abbreviation on the
 * unit.
 *
 * **Case endings are left to the language.** Turkish glues them on with vowel
 * harmony, and "vat" is the shortest stem in this kind: "vata çevir" takes the
 * back-vowel dative, "vatta" the locative hardened after a voiceless `t`.
 * `turkish`'s suffix stripper enumerates every harmonic variant so a vocabulary
 * does not have to, and its `minStem: 3` is exactly what keeps "vat" whole — a
 * floor of 4 would strip the canonical unit of this kind out of existence.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "power",
  units: {
    w: {
      aliases: [...alias("w"), "vat"],
      symbol: "W",
      forms: { other: "vat" },
    },
    kw: {
      aliases: [...alias("kw"), "kilovat"],
      symbol: "kW",
      forms: { other: "kilovat" },
    },
    // The megawatt, matching `units.ts`: the milliwatt has no spelling in this
    // kind in either language, and "MW" folds to the same key as "mw" whichever
    // language wrote it.
    mw: {
      aliases: [...alias("mw"), "megavat"],
      symbol: "MW",
      forms: { other: "megavat" },
    },
    gw: {
      aliases: [...alias("gw"), "gigavat"],
      symbol: "GW",
      forms: { other: "gigavat" },
    },
    hp: {
      aliases: [...alias("hp"), "bg", "beygir"],
      symbol: "BG",
      forms: { other: "beygir" },
    },
  },
});
