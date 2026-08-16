import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * French words for the power units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". A regional variant would be a `Language`
 * with an id of its own rather than a flag here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `power` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes. `aliases` derives the Latin set from `units.ts` rather than retyping
 * it, so the micro path (`parsePower`) and the engine path agree by
 * construction.
 *
 * **The watt family costs almost nothing, and the reason is the same one
 * `@smartput/energy/locale/fr` gives.** These are SI names, and SI publishes in
 * French, so "watt", "kilowatt", "gigawatt" and their -s plurals are already in
 * `units.ts` and this file adds no spelling for them. Only "mégawatt" needs a
 * line, and it is declared twice — accented and bare — because NFKC leaves a
 * precomposed é as é rather than decomposing it, so "megawatt" is a different
 * string and reaches nothing unless it is listed. Only the accented spelling is
 * printed. Spanish had to add a whole Hispanicised column here ("vatio",
 * "kilovatio"); French simply kept the word it gave.
 *
 * Symbols are SI's, cased as SI cases them ("W", "kW", "MW", "GW") where `en.ts`
 * leaves them flat. Nothing is risked by the capitals: the registry folds case
 * before indexing, so "MW" and the derived alias "mw" are one key and every
 * symbol reads back as its own unit. `mw` is the megawatt here as it is in
 * `units.ts` — the milliwatt has no spelling in this kind in any language,
 * because "mW" and "MW" fold together.
 *
 * **`hp` is the whole of the rest of this comment, and French gets it wrong in
 * the same way Spanish does — for a different unit with the same name.** The
 * everyday French word is "cheval", from *cheval-vapeur*, and its symbol is
 * "ch": "une 150 chevaux" is how a car is described, and "ch" is what a French
 * registration document prints. None of them may appear below, because **the
 * French cheval-vapeur is not this unit**. It is defined as 75 kgf·m/s =
 * 735,49875 W — it is the same unit German calls PS and Spanish CV — while
 * `units.ts` defines `hp` as mechanical horsepower, 550 ft·lbf/s =
 * 745,69987158227022 W. The two differ by about 1,4 %: small enough to read as
 * rounding, large enough that "150 ch" and "150 hp" are different powers, and
 * registering "ch" or "cheval" as an alias of `hp` would answer one question
 * with the other silently. A `ch` unit belongs in `units.ts` with a ratio of its
 * own if it is ever wanted, and that file is the kind's language-free half —
 * not something a translation may reach into. **Reported rather than worked
 * around**, exactly as `@smartput/power/locale/es` reports it for CV.
 *
 * So `hp` keeps the international abbreviation, which French also writes
 * whenever it means this unit (a French translation of an American spec sheet
 * says "400 hp", not "400 ch"), and it carries **no `forms`**: the honest French
 * expansion is "cheval-vapeur", which is both the wrong unit and a hyphenated
 * compound `lex` would read as a subtraction. Absent forms keep the renderer on
 * the symbol, and `french.renderQuantity` spaces it anyway, so a French `hp`
 * prints "150 hp" where English prints "150hp".
 */
export default defineVocabulary({
  locale: "fr",
  kind: "power",
  units: {
    w: {
      // "watt" and "watts" are already in `units.ts`. The French plural of a
      // unit named after a person is the ordinary -s, so there is nothing to add.
      aliases: alias("w"),
      symbol: "W",
      forms: { one: "watt", other: "watts" },
    },
    kw: {
      aliases: alias("kw"),
      symbol: "kW",
      forms: { one: "kilowatt", other: "kilowatts" },
    },
    mw: {
      aliases: [...alias("mw"), "mégawatt", "mégawatts"],
      symbol: "MW",
      forms: { one: "mégawatt", other: "mégawatts" },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "GW",
      forms: { one: "gigawatt", other: "gigawatts" },
    },
    hp: {
      // No French alias at all, and that is the ruling above rather than an
      // omission: every French word for this quantity ("cheval", "chevaux",
      // "ch", "CV") names the *metric* horsepower, which is a different number.
      // The aliases stay the two `units.ts` declares.
      aliases: alias("hp"),
      symbol: "hp",
    },
  },
});
