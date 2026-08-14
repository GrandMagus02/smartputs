import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * French words for the energy units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". A regional variant would be a `Language`
 * with an id of its own rather than a flag here, and none of these nine words
 * varies by region: the SI names are the same in Paris, Dakar and Trois-Rivières.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `energy` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the four power/duration/energy
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it, so the micro path
 * (`parseEnergy`) and the engine path agree by construction.
 *
 * **Most of this table costs nothing, and the reason is historical rather than
 * lazy.** The SI unit names *are* French names — the CGPM sits at Sèvres and
 * publishes its brochure in French — so "joule", "calorie", "kilocalorie" and
 * their plurals are already in `units.ts` and this file adds no spelling for
 * them at all. Only the prefixed forms French accents (méga-, téra-) need a
 * line, and each is declared twice, accented and bare: NFKC leaves a precomposed
 * é as é rather than decomposing it, so "megajoule" is a different string from
 * "mégajoule" and reaches nothing unless it is listed. Only the accented
 * spelling is ever printed.
 *
 * **The watt-hour family declares `forms`, and French is the first language here
 * that can.** English refuses them because "watt hours" is two words; Spanish
 * refuses them because "kilovatio-hora" is hyphenated and "-" lexes as
 * subtraction; Ukrainian refuses them because "кіловат-година" is the same shape.
 * French writes the noun **solid** — `wattheure`, `kilowattheure`,
 * `mégawattheure`, with the plural -s on the end — and a solid noun is a run of
 * letters, which is precisely what `parse/lex.ts` builds a unit word out of. So
 * these three round-trip as words: "5 kilowattheures" prints and then reads back
 * as itself, with no bridge signature involved.
 *
 * The hyphenated variant "kilowatt-heure" is the spelling a French dictionary
 * shows beside the solid one, and it is deliberately absent rather than listed:
 * the hyphen would lex as subtraction, so it could only ever be an alias that
 * matches nothing, which is the "dead entry that looks like coverage" the
 * language's own file rejects for "d'". `@smartput/datasize/locale/fr` makes the
 * same call for "kilo-octet" and for the same mechanical reason.
 *
 * **Symbols are SI's, cased as SI cases them** — "J", "kJ", "MJ", "Wh", "kWh",
 * "MWh", "cal", "kcal" — where `en.ts` leaves them flat. Nothing is risked by the
 * capitals: `buildRegistry` folds case before indexing and `assertLocaleContract`
 * looks a printed surface up folded, so "MWh" and the derived alias "mwh" are one
 * key. The capital is worth having because French prints it: an EDF bill says
 * kWh, never kwh.
 *
 * **`J` collides with `@smartput/duration/locale/fr`'s day**, whose French
 * symbol is "j" ("délai : 30 j"). Both are the abbreviation their own language
 * actually writes, so neither file gives way; two kinds spelling one surface is
 * a genuine ambiguity the solver ranks over `Candidate`s that carry their own
 * kind, exactly as `duration`'s own `units.ts` says of `"m"` meaning minutes
 * here and metres in `length`. It also stays theoretical in ordinary output,
 * since both units declare `forms` and the renderer prints the word.
 *
 * **`btu` carries no `forms`, and French makes that a smaller decision than
 * Spanish did.** A borrowed initialism is invariable in French — "1 BTU", "5
 * BTU" — and the expansion, "unité thermique britannique", is three words that no
 * unit token can be; no settled French initialism for it exists, so nothing is
 * guessed at. Spanish still had to declare two identical rows, because the
 * symbol branch of `defaultRenderQuantity` sets the label tight against the
 * number and only a `forms` entry buys the space. French does not:
 * `french.renderQuantity` spaces every label, symbol and word alike, so an
 * absent table prints "5 BTU" already. Two rows that exist only to move a byte
 * are two rows a future edit has to keep in step, so they are not written.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "energy",
  units: {
    j: {
      // "joule" and "joules" are already in `units.ts`: this is a French word
      // English borrowed, not the other way round, and the spelling never
      // changed. Nothing to add.
      aliases: alias("j"),
      symbol: "J",
      forms: { one: "joule", other: "joules" },
    },
    kj: {
      aliases: alias("kj"),
      symbol: "kJ",
      forms: { one: "kilojoule", other: "kilojoules" },
    },
    mj: {
      aliases: [...alias("mj"), "mégajoule", "mégajoules"],
      symbol: "MJ",
      forms: { one: "mégajoule", other: "mégajoules" },
    },
    wh: {
      aliases: [...alias("wh"), "wattheure", "wattheures"],
      symbol: "Wh",
      forms: { one: "wattheure", other: "wattheures" },
    },
    kwh: {
      aliases: [...alias("kwh"), "kilowattheure", "kilowattheures"],
      symbol: "kWh",
      forms: { one: "kilowattheure", other: "kilowattheures" },
    },
    mwh: {
      aliases: [
        ...alias("mwh"),
        "mégawattheure",
        "mégawattheures",
        "megawattheure",
        "megawattheures",
      ],
      symbol: "MWh",
      forms: { one: "mégawattheure", other: "mégawattheures" },
    },
    cal: {
      // "calorie" is feminine ("une calorie") where "joule" is masculine. That
      // difference is invisible to `forms` and deliberately so: gender surfaces
      // on the *number* word, not on the noun, and `frenchSpeller` is handed a
      // magnitude and nothing else — it writes "un" for every unit in the repo.
      // See `@smartput/datasize/locale/es` for the full argument against an axis
      // nothing downstream could read.
      aliases: alias("cal"),
      symbol: "cal",
      forms: { one: "calorie", other: "calories" },
    },
    kcal: {
      aliases: alias("kcal"),
      symbol: "kcal",
      forms: { one: "kilocalorie", other: "kilocalories" },
    },
    btu: {
      aliases: alias("btu"),
      symbol: "BTU",
    },
  },
});
