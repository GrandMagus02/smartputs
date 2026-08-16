import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Italian words for the energy units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a flag
 * here, and nothing below is regional.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `energy` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the four power/duration/energy
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it, so the micro path
 * (`parseEnergy`) and the engine path agree by construction.
 *
 * **The watt-hour family has `forms` here, and it is the only language in this
 * repo that can give them.** `en.ts` refuses them because "watt hour" is two
 * words, `locale/es` refuses them because "kilovatio-hora" carries a hyphen the
 * lexer reads as subtraction, and `locale/uk` refuses them because "кіловат-
 * година" does both. Italian **welds the compound into a single word**:
 * *wattora*, *chilowattora*, *megawattora* are one lexical item each, so
 * `parse/lex.ts`'s run-of-letters unit token holds all of one, and a printed
 * "5 chilowattora" reads back through the ordinary alias index with no bridge
 * signature involved. That is a fact about Italian orthography rather than a
 * liberty taken here, and it is why this file prints words where its neighbours
 * print "5kWh". The symbols are still declared (R8) and `symbols: true` still
 * reaches them.
 *
 * Those three are also **invariant**: *chilowattora* has the same shape in the
 * plural ("due chilowattora"), because its second element is the feminine plural
 * *ore* already fused in and Italian does not inflect a compound twice. So both
 * `forms` rows hold one string — the shape `en.ts` needed for "horsepower", and
 * needed for the same reason: an absent `other` would fall back to the symbol,
 * printing "2kWh" beside "1 chilowattora".
 *
 * **Which prefix is Italian and which is borrowed.** Italian nativises *kilo-*
 * to *chilo-* in every unit that has been an Italian word long enough to be
 * treated as one — *chilometro*, *chilogrammo*, *chilocaloria*, *chilowatt*,
 * *chilowattora*, *chilojoule* — and keeps the international spelling in the
 * recent computing borrowings, which arrived already written *kilobyte* and
 * *kilobit* (see `@smartput/datasize/locale/it`, which prints those). Every unit
 * in this file is on the scientific side of that line, so *chilo-* is what it
 * prints and *kilo-* is only read. *mega-* has no Italian variant at all and is
 * left alone.
 *
 * **`joule` is invariant, and there is no Italian calque to weigh.** Spanish had
 * to choose between the RAE's *julio* and the international *joule*; Italian
 * never coined one, so "il joule, due joule" is the whole paradigm and the word
 * is already an alias `units.ts` declares. *Caloria* is the opposite case — a
 * fully native feminine noun in -a, so it takes the -e plural and both rows are
 * genuinely different words.
 *
 * **Symbols are SI's, cased as SI cases them** — "J", "kJ", "MJ", "Wh", "kWh",
 * "MWh", "cal", "kcal" — where `en.ts` leaves them flat. Nothing is risked by
 * the capitals: `buildRegistry` folds case before indexing and
 * `assertLocaleContract` looks a printed surface up folded, so "MWh" and the
 * derived alias "mwh" are one key. The capital is worth having because Italian
 * prints it: an Italian electricity bill says kWh, never kwh.
 */
export default defineVocabulary({
  locale: "it",
  kind: "energy",
  units: {
    j: {
      aliases: alias("j"),
      symbol: "J",
      forms: { one: "joule", other: "joule" },
    },
    kj: {
      aliases: [...alias("kj"), "chilojoule"],
      symbol: "kJ",
      forms: { one: "chilojoule", other: "chilojoule" },
    },
    mj: {
      aliases: alias("mj"),
      symbol: "MJ",
      forms: { one: "megajoule", other: "megajoule" },
    },
    wh: {
      aliases: [...alias("wh"), "wattora"],
      symbol: "Wh",
      forms: { one: "wattora", other: "wattora" },
    },
    kwh: {
      // "kilowattora" is listed beside the Italian spelling because a datasheet
      // translated from English writes it that way, and recognition is
      // many-to-one (I6); generation stays on the word an Italian bill prints.
      aliases: [...alias("kwh"), "chilowattora", "kilowattora"],
      symbol: "kWh",
      forms: { one: "chilowattora", other: "chilowattora" },
    },
    mwh: {
      aliases: [...alias("mwh"), "megawattora"],
      symbol: "MWh",
      forms: { one: "megawattora", other: "megawattora" },
    },
    cal: {
      // Feminine, and the one place in this file where the two rows differ:
      // "una caloria", "due calorie". The gender itself never reaches `forms` —
      // `italian.selectForm` returns `"one"` or `"other"` and nothing else, and
      // an axis it cannot produce is an axis nothing would ever index. Gender
      // surfaces on the number word in Italian ("una caloria" against "un
      // joule"), and `italianSpeller` is handed a magnitude and nothing else.
      aliases: [...alias("cal"), "caloria", "calorie"],
      symbol: "cal",
      forms: { one: "caloria", other: "calorie" },
    },
    kcal: {
      aliases: [
        ...alias("kcal"),
        "chilocaloria",
        "chilocalorie",
        "kilocaloria",
        "kilocalorie",
      ],
      symbol: "kcal",
      forms: { one: "chilocaloria", other: "chilocalorie" },
    },
    btu: {
      // A borrowed initialism, and Italian leaves those invariant: "1 BTU",
      // "5 BTU", never "5 BTUs". Both rows carry the same string, and the table
      // is present rather than omitted because it is what puts a space between
      // the number and the label — the symbol branch of `defaultRenderQuantity`
      // sets them tight, so dropping `forms` here would print "5BTU".
      //
      // No Italian expansion is registered. "unità termica britannica" is three
      // words, which no unit token can be, and its initialism is not settled —
      // "UTB" appears in translated datasheets and nowhere an Italian engineer
      // would type it — so nothing is guessed at.
      aliases: alias("btu"),
      symbol: "BTU",
      forms: { one: "BTU", other: "BTU" },
    },
  },
});
