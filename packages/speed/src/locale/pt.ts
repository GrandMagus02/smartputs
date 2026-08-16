import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Portuguese words for the speed units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` means the Brazilian default, which is what the
 * platform resolves it to as well — group ".", decimal ",". Nothing below is
 * regional; the one word this file adds is spelled the same on both sides of the
 * Atlantic.
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `speed` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the bridge signature,
 * and `composeLocale` is where the two halves meet, at the integrator's own
 * wiring. `aliases` derives the Latin set from `units.ts` rather than retyping
 * it, so the micro path (`parseSpeed`) and the engine path agree by construction
 * — the cross-path test in `validate.test.ts` depends on exactly that.
 *
 * **Three of the four units keep the decision `en.ts` made, and Portuguese
 * states its reason in the orthography itself.** A speed is a compound in every
 * language here, and Portuguese writes it with the solidus — "m/s", "km/h",
 * "mi/h" — or spells it out as four words, "quilômetros por hora", whose second
 * word is already this language's `times` keyword. `parse/lex.ts` builds a unit
 * word out of letters plus trailing digits, so neither shape can lex back as one
 * token, and a `forms` table for them would be prose no input could reach.
 * Absent forms keep `formatValue` on the symbol, so a Portuguese speed prints
 * "100km/h" — the same tight shape English prints "100kph" and Ukrainian
 * "100км/год" through.
 *
 * **The symbols are the Portuguese compounds rather than English's
 * contractions**, and unlike `@smartput/datarate`'s "Mbps" that is affordable
 * here, because the arithmetic those slashes describe is *true*: "km/h" lexes as
 * a length divided by a duration, and this kind's own `ops` entry names both
 * operands by id string and returns a speed. So "100km/h" reads back as the same
 * quantity in any engine that installs `length` and `duration` beside this one —
 * the route English's "m/s" has always taken, where the symbol is likewise no
 * alias. What it costs is that a speed-only engine cannot re-read its own
 * printed output for these three, which is exactly the trade `uk.ts` records;
 * `pt.test.ts` asserts the bridged path rather than leaving this paragraph to be
 * trusted. "mph" was the alternative for the imperial row and was rejected for
 * being an English contraction in a Portuguese sentence, spelled the one way
 * that does *not* decompose — even though Brazilian prose does borrow it.
 *
 * **The same fact is why those three add no Portuguese alias.** The slash-free
 * heads a reader would otherwise reach for — "metros", "quilômetros", "milhas" —
 * are already `@smartput/length`'s words, and the alias index is one flat map
 * with no kind in the key, so claiming them here would give "5 quilômetros" two
 * readings in any engine installing both kinds, which is what the
 * `@smartput/kinds` barrel does. The bridge above is what Portuguese gets
 * instead, and it is how the compound is actually written anyway.
 *
 * **`nó` is the exception here as `knot` is in English**, and for the same
 * reason: one word, so it parses back, so it declares forms. Masculine, and its
 * plural "nós" is the plain -s that follows a stressed vowel rather than one of
 * the rewriting classes `pluralReplacer` handles — "nó" is not "nol" and never
 * becomes "nóis". It is also the shortest noun in this locale at two letters,
 * which is why `@smartput/core/locale/pt` sets its stem floor at 2 rather than
 * Ukrainian's 3: at 3 the stripper would refuse to fold "nós" at all. Both
 * spellings are listed anyway, since a vocabulary is what the analyzer falls
 * back *from*.
 *
 * The plural is a homograph of the pronoun "nós" ("we"), and that is safe for
 * the reason the model makes recognition many-to-one (I6): a `Candidate` carries
 * its kind, the pronoun is not a keyword — `@smartput/core/locale/pt` claims
 * "em", "para", "de", "mais", "menos", "vezes", "por", "dividido", "sobre" and
 * "desconto", and nothing else — and no reading of a bare pronoun competes with
 * a unit after a numeral.
 *
 * **This is the one accented word in the Portuguese vocabularies with no
 * accent-free twin beside it, and the omission is the point.** Every other file
 * declares one (`quilometro` beside `quilômetro`, `galao` beside `galão`),
 * because NFKC leaves a precomposed diacritic alone and a keyboard without dead
 * keys is the ordinary keyboard. Stripping these two gives "no" and "nos", which
 * are not spellings of anything — they are the contractions of "em" + the
 * article, the commonest two function words in the language, and
 * `@smartput/datetime/locale/pt` writes one of them into its own example
 * sentence ("15:00 no Japão"). `registry.aliasIndex` is one flat map that
 * `MatchCtx.isUnitAlias` reads without consulting a locale, so registering them
 * would put a preposition in front of every literal matcher's accept-gate in any
 * engine speaking Portuguese — the same hazard `@smartput/length/locale/pt`
 * reserves "in" against, arriving from the other direction. What it would buy is
 * one unaccented spelling of a two-letter noun, which the fuzzy matcher already
 * reaches at a distance of one. The trade is not close.
 *
 * Its symbol is "kn", the ISO and maritime abbreviation Portuguese writes
 * unchanged, rather than English's "kt". Because `nó` declares forms that symbol
 * never reaches output; it is recorded because ruling R8 wants every unit's
 * written abbreviation on the unit, and because the renderer's no-symbol branch
 * joins number and unit with no space at all, so a unit that forgot its symbol
 * would move a byte rather than fail. It is listed in `aliases` too, since a
 * symbol the printer can emit must be one the parser reads back by declaration.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mi/h" },
    knot: {
      aliases: [...alias("knot"), "kn", "nó", "nós"],
      symbol: "kn",
      forms: { one: "nó", other: "nós" },
    },
  },
});
