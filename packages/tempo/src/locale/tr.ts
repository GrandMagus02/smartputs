import { aliasesFor, defineVocabulary } from "@smartput/core";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Turkish words for the tempo units.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`. Shaped
 * exactly like `en.ts` beside it, down to naming `tempo` by **id string** rather
 * than importing the kind: that is what lets this file be imported without
 * linking the ratio table or the reciprocal bridge to `duration`, and it is the
 * seam `composeLocale` closes. `aliases` still derives the Latin set from
 * `units.ts` — a Turkish speaker types "120 bpm" as readily as anything — and
 * the Turkish spellings are appended.
 *
 * **One key per unit.** `turkish.selectForm` returns the constant `"other"`,
 * because a counted Turkish noun is bare: "1 hertz", "5 hertz", "1,5 hertz", and
 * "5 hertzler" is not a plural but a mistake. So a table here is one row, and
 * that row is the finished answer rather than half of an English one.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` gives and one Turkish adds.**
 * English refuses them because "beats per minute" is a compound the lexer cannot
 * read back. The Turkish phrase is "dakikada vuruş" — two tokens, and
 * `parse/lex.ts` builds a unit word out of letters plus trailing digits, so the
 * space ends the token exactly as it does in English. The abbreviation a Turkish
 * metronome prints, "vuruş/dk", is unusable for a second reason: it carries "/",
 * which lexes as division, so "120 vuruş/dk" would reach the resolver as
 * `tempo ÷ duration` — a signature no kind declares. `energy` and `datarate`
 * survive that shape by making the arithmetic true ("kWh" computes as
 * power × duration), and that escape is closed here because tempo's canonical
 * *is* beats per minute: there is no "beat" kind for "vuruş" to be a quantity
 * of, and `index.ts` declares only the two reciprocal `in` bridges, no `/` at
 * all. So the symbol is "bpm", which Turkish music writing uses unchanged, and
 * the requirement collapses to the one line that always holds — the symbol must
 * be a single token that is already an alias.
 *
 * `vuruş` is listed as a *reading* key beside it, the numerator of the
 * abbreviation standing for the whole of it, by the same elision that lets
 * English "bpm" be typed for a tempo. Only "bpm" also comes back out. Its
 * diacritic-free twin `vurus` is listed for the reason `tr-cardinals.ts` lists
 * "uc" beside "üç": the language's case folds handle the dotted and dotless i
 * and nothing else, so ş → s is a vocabulary's business, and an ASCII keyboard
 * is common enough that the spelling it produces should not be a parse error.
 *
 * **`hz` declares its one row**, where `en.ts` needed two identical ones. Turkish
 * borrows the unit whole — TDK spells it "hertz" — and it is a single letter run,
 * so the printer emits a word the parser reads back at full weight. The symbol is
 * "Hz", the SI one, which TSE adopts unchanged and which no Turkish text
 * replaces; it folds onto the derived alias "hz" on the way back in, so a
 * `symbols: true` print parses.
 *
 * **Case endings are left to the language.** "hertze çevir" takes the front-vowel
 * dative and "hertzde" the locative; `turkish`'s suffix stripper enumerates every
 * harmonic variant precisely so a vocabulary does not have to, and `minStem: 3`
 * clears a five-letter stem with room to spare. What is listed here is what is
 * *printed* here, which is the rule that matters: a form the printer emits must
 * be an alias at full weight, never a form the stripper happens to recover at −2.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "vuruş", "vurus"],
      symbol: "bpm",
    },
    hz: {
      aliases: alias("hz"),
      symbol: "Hz",
      forms: { other: "hertz" },
    },
  },
});
