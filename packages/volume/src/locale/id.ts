import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Indonesian words for the volume units — the same five `en`, `uk` and `nl`
 * name, and the same per-unit answer about `m3` that `en`, `uk` and `nl` give,
 * **against** the one `de` gives.
 *
 * **`m3` carries no `forms`, and Indonesian has less room to escape that than
 * any language here.** The refusal was never "the unit is unspeakable"; it is
 * that the spoken name is a *phrase* — "cubic metres", "кубічних метрів" — and
 * `lex` ends a word token at a space, so no analyzer is ever handed the whole
 * thing and `assertLocaleContract` fails a printed phrase by name. German
 * escapes it by writing the concept as one token, `Kubikmeter`; Dutch does not,
 * because `kubieke meter` is an adjective plus a noun, but Dutch can at least
 * list the closed-up `kubiekemeter` as a spelling a reader really produces in a
 * search box. Indonesian is further out than both: the name is `meter kubik`,
 * qualifier *after* the head as every Indonesian modifier goes, and the language
 * does not compound at all — so there is no plausible single token to list even
 * for reading. This unit is reachable through what `units.ts` already gives,
 * `m³` and `m3`, and renders through its symbol.
 *
 * **Which is where this language's one deliberate cost lands.**
 * `@smartput/core/locale/id` ships no `renderQuantity`, on the argument that
 * `defaultRenderQuantity` sets a symbol tight but every unit of a translated
 * Indonesian vocabulary has a `forms` row and so takes the spaced word branch.
 * This unit is one of the four exceptions across these six packages (the other
 * three are `@smartput/area/locale/id`'s squared units), so an Indonesian engine
 * answers "1,5m³" where Indonesian typography, following SI, writes "1,5 m³".
 * It is the same string `en` and `uk` produce, so nothing here is worse than
 * what shipped before — but a reader arriving from `@smartput/volume/locale/nl`,
 * where `dutch.renderQuantity` spaces a symbol, should know the difference lives
 * in the language file and not in this one.
 *
 * **One `forms` key on the other four, and that is the entire grammar of this
 * file.** `indonesian.selectForm` is the constant `() => "other"`: no
 * grammatical number ("dua liter", "1,5 liter", never a plural), no gender, no
 * case, so a conversion target ("dalam liter") is spelled like a bare quantity.
 * `Intl.PluralRules("id")` declares the single category `"other"`, so rule 6's
 * "exactly the keys `selectForm` can produce" is one row per unit.
 *
 * **`galon` is claimed, with its ambiguity stated rather than hidden.** KBBI
 * defines `galon` as the unit this file points it at, and technical Indonesian
 * uses it that way. Everyday Indonesian also uses the same word for the
 * refillable nineteen-litre drinking-water bottle — "beli satu galon" is a
 * container, not 3.79 L — and that reading is a *container*, which this kind has
 * no unit for and could not resolve to if it did. The word is claimed for the
 * measure because the measure is what a dictionary and a spec sheet mean by it;
 * a reader who meant the bottle gets a number rather than a refusal, which is
 * the one place this vocabulary knowingly answers the less likely reading of a
 * common word.
 *
 * **`pint` is the loan kept unchanged.** Indonesian never translated it and
 * never abbreviated it, so `units.ts`'s own spelling is the Indonesian word and
 * the symbol is that word spelled out.
 *
 * **Indonesian spelling is not English spelling, on one unit.** `mililiter`
 * takes a single `l` — Indonesian simplified the doubled consonants of its Dutch
 * loans — where `units.ts` declares `millilitre` and `milliliter`. Both stay
 * listed; only the Indonesian one is printed. `liter` is already the Indonesian
 * word unchanged, and Indonesian never took the British `-tre` spelling.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in an Indonesian engine
 * and the micro path (`parseVolume`) cannot drift from it.
 *
 * **There is no stripper behind these aliases.** `indonesian.analyze` is
 * `identity()` alone, so a form this file prints and forgets to list is
 * unreachable, with nothing to recover it at a penalty. No folding is needed on
 * either side of that check: Indonesian capitalises no noun.
 *
 * `symbol` is the SI abbreviation on the three metric units, which is what
 * Indonesian itself writes, and the spelled noun on the two Indonesian does not
 * abbreviate. R8 wants an explicit symbol on every unit, never an invented one.
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/id` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "id",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l")],
      symbol: "l",
      forms: { other: "liter" },
    },
    ml: {
      aliases: [...alias("ml"), "mililiter"],
      symbol: "ml",
      forms: { other: "mililiter" },
    },
    // The one unit here with no word; see the header. Nothing is added, because
    // there is no single Indonesian token to add.
    m3: { aliases: [...alias("m3")], symbol: "m³" },
    gal: {
      aliases: [...alias("gal"), "galon"],
      symbol: "galon",
      forms: { other: "galon" },
    },
    pint: {
      aliases: [...alias("pint")],
      symbol: "pint",
      forms: { other: "pint" },
    },
  },
});
