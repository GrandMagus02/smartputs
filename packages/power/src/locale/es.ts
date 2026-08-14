import { aliasesFor, defineVocabulary } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Spanish words for the power units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: CLDR's
 * default content for Spanish, which is Spain's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a
 * flag here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `power` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes. `aliases` derives the Latin set from `units.ts` rather than retyping
 * it, so the micro path (`parsePower`) and the engine path agree by
 * construction.
 *
 * **The watt family is regular and unremarkable**: `vatio` is the RAE's
 * Hispanicised spelling, masculine, pluralised with the -s that follows a vowel,
 * and the SI prefixes are the ordinary Spanish ones (`kilovatio`, `megavatio`,
 * `gigavatio`). The unaccented `watt`/`watts` spelling — the SI brochure's
 * Spanish edition, and what most of Latin America writes — is read too, but it
 * is not typed out here: `units.ts` already maps `watt`, `watts`, `kilowatt`,
 * `kilowatts` and the rest onto these units, so `aliasesFor` brings every one of
 * them along and repeating them below would be one word declared twice on one
 * unit. Recognition stays many-to-one (I6) either way; generation is the RAE's
 * word, from the `forms` rows.
 * Symbols are SI's, cased as SI cases them ("W", "kW", "MW", "GW"), where
 * `en.ts` leaves them flat; the registry folds case before indexing, so "MW"
 * and the derived alias "mw" are one key and every symbol reads back as its own
 * unit. `mw` is the megawatt here as it is in `units.ts` — the milliwatt has no
 * spelling in this kind in any language, because "mW" and "MW" fold together.
 *
 * **`hp` is the unit worth the rest of this comment, and Spanish gets it wrong
 * in a way no test in this repo could see.** The everyday Spanish word is
 * "caballo" — "un coche de 150 caballos" — and its abbreviation is "CV", from
 * *caballo de vapor*. Neither may appear below, because **CV is not this unit**.
 * The metric *caballo de vapor* is defined as 75 kgf·m/s = 735,49875 W, while
 * `units.ts` defines `hp` as mechanical horsepower, 550 ft·lbf/s =
 * 745,69987158227022 W. They differ by about 1,4 %, which is small enough to
 * look like rounding and large enough to be wrong: "150 CV" and "150 hp" are
 * two different powers, and registering "cv" as an alias of `hp` would quietly
 * answer one question with the other. A `cv` unit belongs in `units.ts` with a
 * ratio of its own if it is ever wanted, and that file is the kind's
 * language-free half — not something a translation may reach into. Reported
 * rather than worked around.
 *
 * So `hp` keeps the international abbreviation, which Spanish also writes
 * whenever it means this unit ("un motor de 400 hp" is standard in Latin
 * American automotive prose), and it carries **no `forms`**: the honest Spanish
 * expansion, "caballo de fuerza", is three words, and `parse/lex.ts` ends a word
 * token at a space, so it could be printed and never read back. `@smartput/power`'s
 * Ukrainian file arrived at the same shape from the same lexer fact — "кінська
 * сила" is two words — and the shape is the right one: a unit whose written form
 * is an abbreviation legitimately has no word forms, while a unit whose printed
 * words cannot be read is broken output. Absent forms keep the renderer on the
 * symbol, so a Spanish `hp` prints "150hp".
 */
export default defineVocabulary({
  locale: "es",
  kind: "power",
  units: {
    w: {
      aliases: [...alias("w"), "vatio", "vatios"],
      symbol: "W",
      forms: { one: "vatio", other: "vatios" },
    },
    kw: {
      aliases: [...alias("kw"), "kilovatio", "kilovatios"],
      symbol: "kW",
      forms: { one: "kilovatio", other: "kilovatios" },
    },
    mw: {
      aliases: [...alias("mw"), "megavatio", "megavatios"],
      symbol: "MW",
      forms: { one: "megavatio", other: "megavatios" },
    },
    gw: {
      aliases: [...alias("gw"), "gigavatio", "gigavatios"],
      symbol: "GW",
      forms: { one: "gigavatio", other: "gigavatios" },
    },
    hp: {
      // No Spanish alias at all, and that is the ruling above rather than an
      // omission: every colloquial Spanish word for this quantity ("caballo",
      // "caballos", "CV") names the *metric* horsepower, which is a different
      // number. The aliases stay the two `units.ts` declares.
      aliases: alias("hp"),
      symbol: "hp",
    },
  },
});
