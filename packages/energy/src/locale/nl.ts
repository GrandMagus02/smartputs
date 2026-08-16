import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Dutch words for the energy units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. Same shape as `en.ts`
 * and `de.ts` next door, same kind named by **id string** rather than imported,
 * same explicit `symbol` on every unit (ruling R8). `aliases` reuses the Latin
 * spellings from `units.ts` through `aliasesFor` rather than retyping them — a
 * Dutch datasheet writes "2 kJ" and a Dutch sentence writes "2 kilojoule" — and
 * the Dutch spellings are appended.
 *
 * **The watt-hour family carries `forms` here, where English and Ukrainian both
 * refuse them, and it is the same escape German takes.** Those two languages
 * decline for the same reason: the written-out name is a compound the lexer
 * cannot read back — "watt hour" is two words, "кіловат-година" is hyphenated,
 * and `parse/lex.ts` builds a unit word out of letters plus trailing digits, so
 * a space or a hyphen ends the token. Dutch closes its compounds up.
 * `kilowattuur` is **one word**, one letter run, one token, and therefore a form
 * this vocabulary can print and read back at full weight.
 *
 * Worth noting where the mechanics differ from German's anyway: `de.ts` records
 * that `compoundSplitter` offers `stunde` out of `Kilowattstunde` at −3, so its
 * exact alias has to outrank a rival reading. Here there is no rival at all,
 * because `dutch` deliberately leaves `uur` out of its compound heads — a head
 * list containing it reads *natuur*, *cultuur* and *temperatuur* as counts of
 * hours. So "kilowattuur" splits into nothing and the alias is the only reading;
 * it is listed for the plain reason that an unlisted word is an unknown one.
 *
 * **Two keys, on one axis, and lowercase.** `dutch.selectForm` answers the bare
 * CLDR plural category — `slot` is read and discarded, because modern Dutch has
 * no case marking left on common nouns — so the four-key table `de.ts` needs
 * collapses to English's two, and Dutch capitalises no noun, so every form below
 * is lowercase. The kind then splits cleanly in two along that table:
 *
 * ```
 * joule        both rows "joule"        measure noun, invariant after a numeral
 * kilowattuur  both rows "kilowattuur"  the head is *uur*, invariant likewise
 * calorie      calorie / calorieën      an ordinary count noun, marked
 * ```
 *
 * The invariant rows are the ones a translator is likeliest to "finish". Dutch
 * holds a unit of measure in the singular after a numeral — "tien meter", "vijf
 * kilo", "drie jaar" — so "vijf joule" and "drie kilowattuur" are the only
 * spellings, and *joules* / *kilowatturen* in the `other` row would print a
 * shape no Dutch measurement uses. Both are still *read*, because recognition is
 * many-to-one (I6) and the English `-s` plural arrives free from `units.ts`.
 *
 * `calorie` is what keeps that from being vacuous. It is not a measure noun in
 * the Taalunie's sense but an ordinary count noun — a dieter counts calories the
 * way one counts apples — so "tweeduizend calorieën" is marked, and the number
 * axis is live on exactly two of this kind's nine units. Its plural also shows
 * the one piece of Dutch orthography this package exercises: a noun ending in an
 * unstressed *-ie* takes `-ën`, with the trema keeping the reader from running
 * *ie* into the *e* of the ending. The trema-less "calorieen" is listed beside
 * it because that is what an unaccented keyboard produces, exactly as
 * `nl-cardinals.ts` reads both spellings of *tweeëntwintig*.
 *
 * **Symbols** are the SI ones Dutch writes: `J`, `kJ`, `MJ`, `Wh`, `kWh`, `MWh`,
 * `cal`, `kcal`. Each folds onto a derived alias (`kWh` → `kwh`), which is the
 * mechanism by which a `symbols: true` print parses back. The capitals in them
 * are SI's — the prefix symbol for mega, the initial of Watt the person — and
 * not the noun capitals German's file carries.
 *
 * **`btu` carries no `forms`, and the reason is the same one German gives.** It
 * is a borrowed initialism with no Dutch expansion in use — "Britse
 * warmte-eenheid" is a gloss rather than a unit name, and nobody counts in it —
 * so there is no word to put in a `forms` table, and a hyphenated gloss could
 * not lex back if there were. Ukrainian's file gives a second reason for filling
 * the table anyway: absent forms put the renderer on the symbol, and the symbol
 * branch sets number and label tight. That reason does not transfer, because
 * `dutch.renderQuantity` spaces a symbol as SI requires. So "100 BTU" comes out
 * spaced with no `forms` at all, and two rows of the same borrowed initialism
 * would buy nothing.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "energy",
  units: {
    // Joule and its prefixes. Dutch spells them exactly as `units.ts` already
    // does, so `aliases` needs no Dutch addition at all — and unlike German
    // there is not even a capital to add, since the printed form is lowercase.
    j: {
      aliases: alias("j"),
      symbol: "J",
      forms: { one: "joule", other: "joule" },
    },
    kj: {
      aliases: alias("kj"),
      symbol: "kJ",
      forms: { one: "kilojoule", other: "kilojoule" },
    },
    mj: {
      aliases: alias("mj"),
      symbol: "MJ",
      forms: { one: "megajoule", other: "megajoule" },
    },
    // The compound English and Ukrainian both had to give up on. Its head is
    // *uur*, so it inherits the hour's invariance after a numeral — "drie
    // kilowattuur" — exactly as `@smartput/duration`'s Dutch `h` prints one word
    // in both rows. The `-uren` plurals are listed as aliases and never written,
    // the same read-not-written split that file makes for "uren" itself.
    wh: {
      aliases: [...alias("wh"), "wattuur", "watturen"],
      symbol: "Wh",
      forms: { one: "wattuur", other: "wattuur" },
    },
    kwh: {
      aliases: [...alias("kwh"), "kilowattuur", "kilowatturen"],
      symbol: "kWh",
      forms: { one: "kilowattuur", other: "kilowattuur" },
    },
    mwh: {
      aliases: [...alias("mwh"), "megawattuur", "megawatturen"],
      symbol: "MWh",
      forms: { one: "megawattuur", other: "megawattuur" },
    },
    // The count nouns, and the reason this file is worth reading beside the
    // joule rows above: a calorie is counted, so its plural is marked. Dutch
    // spells the noun with the Latin `c` the symbol keeps, so unlike German's
    // `Kalorie` nothing here has to be respelled — only the `-ën` plural is new.
    cal: {
      aliases: [...alias("cal"), "calorieën", "calorieen"],
      symbol: "cal",
      forms: { one: "calorie", other: "calorieën" },
    },
    kcal: {
      aliases: [...alias("kcal"), "kilocalorieën", "kilocalorieen"],
      symbol: "kcal",
      forms: { one: "kilocalorie", other: "kilocalorieën" },
    },
    btu: {
      aliases: alias("btu"),
      symbol: "BTU",
    },
  },
});
