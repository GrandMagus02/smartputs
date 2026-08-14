import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Indonesian words for the mass units — the same six `en`, `uk` and `nl` name,
 * and five of the six have words. The sixth is the interesting one, and it is
 * the ounce.
 *
 * **One `forms` key per unit, and that is the entire grammar of this file.**
 * `indonesian.selectForm` is the constant `() => "other"`: Indonesian has no
 * grammatical plural at all, so "satu kilogram", "lima kilogram" and "1,5
 * kilogram" differ in the numeral and nowhere else. Plurality, where Indonesian
 * marks it, is reduplication ("buku-buku") — and reduplication is exactly what a
 * numeral blocks, so a counted noun is invariant by rule rather than by
 * coincidence. There is no gender, no case and no article for a preposition to
 * govern either, so the conversion target in "2 kg dalam gram" is spelled like a
 * bare quantity. `Intl.PluralRules("id")` declares the single category
 * `"other"`, which is why rule 6's "exactly the keys `selectForm` can produce"
 * is one row and not a table stopping halfway. This is `en`'s table with the
 * `"one"` row deleted and nothing renamed — the mirror of Ukrainian's eight
 * cells and German's four, and the point `@smartput/core/locale/id` exists to
 * make: a language *can* be this cheap, and the vocabulary is the same size as
 * anybody else's regardless.
 *
 * **The ounce carries no `forms`, and the reason is a false friend rather than
 * a gap.** The Indonesian word for an ounce-sized weight is `ons`, and it means
 * **100 grams** — one hectogram, inherited from the Dutch *ons* and still the
 * live unit of every wet market in the country, where "dua ons cabai" is 200 g
 * of chilli and nobody hesitates about it. This kind's `oz` is the avoirdupois
 * ounce, 28.349523125 g. Claiming `ons` for it would answer 28 g to a phrase
 * whose Indonesian meaning is 100 g, in the commonest register the word has —
 * a 3.5× error in everyday speech, which is the `cicero`/`augustijn` trap
 * `@smartput/measure/locale/nl` refuses for the same reason. There is no second
 * Indonesian noun to fall back on: the imperial ounce reaches Indonesian only on
 * imported packaging, where it is written `oz`. So this unit prints its symbol,
 * an Indonesian engine answers "3oz", and the English `ounce`/`ounces` from
 * `units.ts` stay listed for reading. The kind has no 100 g unit for the right
 * reading of `ons` to resolve to, which is why the word is left unclaimed
 * entirely rather than approximated.
 *
 * **The pound goes the other way, and the asymmetry is the argument.** `pon` has
 * the same Dutch ancestry and the same drift — the older Indonesian reckoning
 * puts it at 500 g, five *ons* — but that sense survives mainly in old
 * cookbooks, while a modern Indonesian text writes `pon` for the imperial pound
 * (a boxing weight class, an imported sack). So the residual ambiguity is ~10 %
 * in a receding register, against `ons`'s 3.5× in a current one, and this file
 * claims `pon` and prints it. `@smartput/mass/locale/nl` makes exactly this
 * trade for `pond` and states the same 500 g reading as an ambiguity rather than
 * hiding it; this kind has no 500 g unit for it to resolve to either.
 *
 * **Indonesian spelling is not English spelling, on one unit.** `miligram`
 * takes a single `l` — Indonesian simplified the doubled consonants of its Dutch
 * loans — where `units.ts` declares the English `milligram`. Both are listed:
 * the English one because it came free and people type it, the Indonesian one
 * because it is what this file prints. `gram`, `kilogram` and `ton` happen to be
 * the same string in both languages and needed nothing added.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in an Indonesian engine
 * and the micro path (`parseMass`) cannot drift from it. That map already
 * carries `kilo`, which is the Indonesian colloquial clipping unchanged ("beli
 * dua kilo"), so this file adds no word for it.
 *
 * **There is no stripper behind these aliases.** `indonesian.analyze` is
 * `identity()` alone — Indonesian affixation is derivational and never lands on
 * a measure noun after a numeral — so a form this file prints and forgets to
 * list is unreachable, with nothing to rescue it at a penalty. Rule 5 is
 * therefore load-bearing here in a way it is not in a language with morphology,
 * and `id.test.ts` asserts it verbatim: no folding is needed on either side,
 * because Indonesian capitalises no noun.
 *
 * `symbol` is the SI abbreviation on the four metric units, which is what
 * Indonesian itself writes ("5 kg", never a spelled short form), `oz` on the
 * ounce for the reason above, and the spelled `pon` on the pound, which
 * Indonesian does not abbreviate at all. R8 wants an explicit symbol on every
 * unit, never an invented one.
 *
 * Like `en`, this file names `mass` by **id string** and never imports the kind,
 * which is what lets `@smartput/mass/locale/id` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "id",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "miligram"],
      symbol: "mg",
      forms: { other: "miligram" },
    },
    g: {
      aliases: [...alias("g")],
      symbol: "g",
      forms: { other: "gram" },
    },
    // `kilo` is already in `units.ts` and is the Indonesian clipping unchanged.
    // It is ambiguous in Indonesian exactly as it is in English — a kilometre is
    // clipped the same way — and this file claims it for the kilogram alone,
    // which is the claim the English alias map already makes.
    kg: {
      aliases: [...alias("kg")],
      symbol: "kg",
      forms: { other: "kilogram" },
    },
    // The metric tonne, spelled `ton` in Indonesian as in Dutch. No `tonne`
    // needed beyond what `units.ts` gives, and no ambiguity with the imperial
    // ton: Indonesian never adopted it.
    t: {
      aliases: [...alias("t"), "ton"],
      symbol: "t",
      forms: { other: "ton" },
    },
    // `ons` is deliberately absent; see the header. The English words come from
    // `units.ts` and are what an Indonesian reader meets on imported packaging,
    // so this entry adds no word of its own and prints no word at all.
    oz: {
      aliases: [...alias("oz")],
      symbol: "oz",
    },
    lb: {
      aliases: [...alias("lb"), "pon"],
      symbol: "pon",
      forms: { other: "pon" },
    },
  },
});
