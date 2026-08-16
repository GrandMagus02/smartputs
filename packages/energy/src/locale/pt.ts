import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Portuguese words for the energy units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` means the Brazilian default, which is also what
 * the platform resolves it to — group ".", decimal ",". Nothing in this table is
 * regional; the prefix spelling is the one place the two standards could have
 * differed, and both write "quilo-".
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `energy` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the four
 * power/duration/energy signatures, and it is the seam `composeLocale` closes.
 * `aliases` derives the Latin set from `units.ts` rather than retyping it, so
 * the micro path (`parseEnergy`) and the engine path agree by construction.
 *
 * **`joule` stays `joule`, and the contrast with Spanish is the point.** The RAE
 * Hispanicises the eponym to `julio` and pays for it with a homograph (the month
 * of July); Portuguese does not Hispanicise it at all. ABNT and the Portuguese
 * edition of the SI brochure both write "joule", the plural is the borrowed -s
 * ("dois joules") rather than the -es a native consonant-final noun would take,
 * and there is no second spelling in circulation to list. So every `forms` value
 * for this family is already an alias `units.ts` declares, and the only new
 * words in the joule rows are the Portuguese prefixes.
 *
 * **The prefix is "quilo-", with "kilo-" read beside it.** Portuguese spells the
 * SI prefix with a q — "quilograma", "quilômetro", and so "quilojoule" and
 * "quilocaloria" — and that is what gets printed. The k-spelling is what a
 * keyboard-habit or an English datasheet produces, so it is listed and never
 * printed: recognition is many-to-one (I6), generation stays one.
 *
 * **The watt-hour family carries no `forms`**, which is the ruling `en.ts`
 * records and Portuguese restates without change: "quilowatt-hora" is written
 * with a hyphen and "quilowatt hora" without one, and both fail the same test —
 * `parse/lex.ts` reads "-" as subtraction and ends a word token at a space, so
 * neither shape can lex back as a single unit. Absent forms keep the renderer on
 * the symbol, so a Portuguese energy prints "5kWh", which is what a Brazilian
 * electricity bill prints too. Unlike the Ukrainian file next door, no
 * interpunct spelling is listed even as documentation: Portuguese writes this
 * family with the hyphen, not with "·", so there is no orthographic form for the
 * `* | power | duration` bridge to rescue.
 *
 * **Symbols are SI's, cased as SI cases them** — "J", "kJ", "MJ", "Wh", "kWh",
 * "MWh", "cal", "kcal" — where `en.ts` leaves them flat. Nothing is risked by
 * the capitals: `buildRegistry` folds case before indexing and
 * `assertLocaleContract` looks a printed surface up folded, so "MWh" and the
 * derived alias "mwh" are one key. The capital is worth having because
 * Portuguese prints it.
 *
 * **No accent appears anywhere in this file, and that is a fact rather than an
 * omission.** Spanish had to list "caloría"/"caloria" twice, because NFKC
 * folding leaves a precomposed í as í and a keyboard without diacritics would
 * otherwise reach nothing. Portuguese stresses "ca-lo-RI-a" on the penult, which
 * is the default for a word ending in -a and therefore unmarked, so the correct
 * spelling is already the one an accentless keyboard produces and one line does
 * the work of two.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "energy",
  units: {
    j: {
      aliases: alias("j"),
      symbol: "J",
      forms: { one: "joule", other: "joules" },
    },
    kj: {
      aliases: [...alias("kj"), "quilojoule", "quilojoules"],
      symbol: "kJ",
      forms: { one: "quilojoule", other: "quilojoules" },
    },
    mj: {
      // Nothing to add: "mega-" is spelled the same in both languages, so
      // `units.ts` already carries both numbers of this word.
      aliases: alias("mj"),
      symbol: "MJ",
      forms: { one: "megajoule", other: "megajoules" },
    },
    wh: { aliases: alias("wh"), symbol: "Wh" },
    kwh: { aliases: alias("kwh"), symbol: "kWh" },
    mwh: { aliases: alias("mwh"), symbol: "MWh" },
    cal: {
      // "caloria" is feminine ("uma caloria", "as calorias") where "joule" is
      // masculine. That difference is invisible to `forms`, and deliberately:
      // gender surfaces on the number word, so it is applied in
      // `portuguese.renderQuantity` — the one call that sees the spelled numeral
      // and the noun together — rather than becoming a `forms` axis nothing
      // could ever select on. Nothing is needed from this file: "caloria" ends
      // in -a and is feminine by the rule that layer already carries, and
      // "joule" ends in -e and is masculine by the same rule.
      aliases: [...alias("cal"), "caloria", "calorias"],
      symbol: "cal",
      forms: { one: "caloria", other: "calorias" },
    },
    kcal: {
      aliases: [
        ...alias("kcal"),
        "quilocaloria",
        "quilocalorias",
        "kilocaloria",
        "kilocalorias",
      ],
      symbol: "kcal",
      forms: { one: "quilocaloria", other: "quilocalorias" },
    },
    btu: {
      // A borrowed initialism, and Portuguese leaves those invariant: "1 BTU",
      // "5 BTU", never "5 BTUs". Both rows carry the same string, and the table
      // is present rather than omitted because it is what puts a space between
      // the number and the label — the symbol branch of `defaultRenderQuantity`
      // sets them tight, so dropping `forms` here would print "5BTU".
      //
      // No Portuguese expansion is registered. "unidade térmica britânica" is
      // three words, which no unit token can be, and the initialism for it is
      // not settled — "UTB" shows up in translated datasheets and nowhere a
      // Brazilian engineer would type it — so nothing is guessed at.
      aliases: alias("btu"),
      symbol: "BTU",
      forms: { one: "BTU", other: "BTU" },
    },
  },
});
