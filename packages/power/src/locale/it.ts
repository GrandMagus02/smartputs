import { aliasesFor, defineVocabulary } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Italian words for the power units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a flag
 * here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `power` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes. `aliases` derives the Latin set from `units.ts` rather than retyping
 * it, so the micro path (`parsePower`) and the engine path agree by construction.
 *
 * **The watt family costs Italian one word.** Italian did not Hispanicise this
 * unit the way Spanish did with *vatio*: it kept *watt*, and being a consonant-
 * final loanword it is invariant — "un watt", "due watt", "cento megawatt" —
 * because the native plural *substitutes* a final vowel and there is none here to
 * substitute. So both `forms` rows of every row below hold one string, the shape
 * `en.ts` needed for "horsepower" and for exactly its reason: an absent `other`
 * would fall back to the symbol, printing "2kW" beside "1 chilowatt". What
 * Italian *does* nativise is the prefix — *chilowatt*, never *kilowatt*, the same
 * *chilo-* as in *chilometro* and *chilogrammo* — so that one spelling is added
 * and everything else in the family already arrives from `units.ts`. *mega-* and
 * *giga-* have no Italian variant and are left alone.
 *
 * Symbols are SI's, cased as SI cases them ("W", "kW", "MW", "GW"), where `en.ts`
 * leaves them flat; the registry folds case before indexing, so "MW" and the
 * derived alias "mw" are one key and every symbol reads back as its own unit.
 * `mw` is the megawatt here as it is in `units.ts` — the milliwatt has no
 * spelling in this kind in any language, because "mW" and "MW" fold together.
 *
 * **`hp` is the row worth the rest of this comment, and Italian gets it wrong in
 * a way no test in this repo could see.** The everyday Italian word is *cavallo*
 * — "una moto da 150 cavalli" — and its abbreviation is "CV", from *cavallo
 * vapore*. Neither may appear below, because **CV is not this unit**. The metric
 * *cavallo vapore* is defined as 75 kgf·m/s = 735,49875 W, while `units.ts`
 * defines `hp` as mechanical horsepower, 550 ft·lbf/s = 745,69987158227022 W.
 * They differ by about 1,4 %, which is small enough to look like rounding and
 * large enough to be wrong: "150 CV" and "150 hp" are two different powers, and
 * registering "cv" or "cavalli" as an alias of `hp` would quietly answer one
 * question with the other — the more quietly in Italian than anywhere, since CV
 * is the figure printed on an Italian *libretto di circolazione*. A `cv` unit
 * belongs in `units.ts` with a ratio of its own if it is ever wanted, and that
 * file is the kind's language-free half, not something a translation may reach
 * into. Reported rather than worked around; `@smartput/power/locale/es` reports
 * the identical finding for Spanish's *caballo de vapor*, which is the same unit
 * under a different name.
 *
 * So `hp` keeps the international abbreviation, which Italian also writes
 * whenever it means this unit ("400 hp" is what an Italian magazine prints of an
 * American engine), and it carries **no `forms`**: the honest Italian expansion
 * would be *cavallo vapore britannico*, three words, and `parse/lex.ts` ends a
 * word token at a space, so it could be printed and never read back. The
 * Ukrainian file arrived at the same shape from the same lexer fact ("кінська
 * сила" is two words). Absent forms keep the renderer on the symbol, so an
 * Italian `hp` prints "150hp".
 */
export default defineVocabulary({
  locale: "it",
  kind: "power",
  units: {
    w: {
      aliases: alias("w"),
      symbol: "W",
      forms: { one: "watt", other: "watt" },
    },
    kw: {
      // "kilowatt" arrives from `units.ts` and is read; "chilowatt" is the
      // Italian spelling and is what gets printed. Recognition is many-to-one
      // (I6), generation is one.
      aliases: [...alias("kw"), "chilowatt"],
      symbol: "kW",
      forms: { one: "chilowatt", other: "chilowatt" },
    },
    mw: {
      aliases: alias("mw"),
      symbol: "MW",
      forms: { one: "megawatt", other: "megawatt" },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "GW",
      forms: { one: "gigawatt", other: "gigawatt" },
    },
    hp: {
      // No Italian alias at all, and that is the ruling above rather than an
      // omission: every colloquial Italian word for this quantity ("cavallo",
      // "cavalli", "CV") names the *metric* horsepower, which is a different
      // number. The aliases stay the two `units.ts` declares.
      aliases: alias("hp"),
      symbol: "hp",
    },
  },
});
