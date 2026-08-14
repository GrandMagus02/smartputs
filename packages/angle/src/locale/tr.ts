import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Turkish words for the angle units — the same four `en`, `uk` and `de` name,
 * and all four have a Turkish word.
 *
 * **One `forms` key per unit, keyed `other`, and that is the entire grammar of
 * this file.** `turkish.selectForm` is the constant `() => "other"`. This is the
 * kind where the languages that mark number make it visible — Dutch writes
 * `graad`/`graden` here and keeps `meter` invariant next door, on the reasoning
 * that an angle is counted where a length is measured out — and Turkish has no
 * number axis for the distinction to land on: "bir derece", "doksan derece" and
 * "1,5 derece" are one word in three numerals, because a Turkish noun after a
 * numeral is bare. No gender, no article. The dative that marks a conversion
 * target ("dereceye çevir") is deliberately off the axis too — see
 * `@smartput/core/locale/tr`, which rejects it because vowel harmony derives the
 * ending mechanically and a symbol target takes it through an apostrophe
 * ("°'ye") that a `forms` table cannot spell. Rule 6's "exactly the keys
 * `selectForm` can produce" is therefore one row per unit, where
 * `@smartput/angle/locale/de` needs four.
 *
 * **Turkish does not have to take `grad` away from the gradian, and German
 * did.** `@smartput/angle/locale/de` spends its header on that reservation: the
 * German word for an angular degree *is* `Grad`, the exact string `units.ts`
 * declares as the abbreviation for the **gradian**, so one of the two units had
 * to yield. The Turkish word for a degree is `derece`, which collides with
 * nothing in this kind, so both units keep everything `units.ts` gave them and
 * `grad` stays where it was.
 *
 * **`gradyan` is the near-miss, and it is left out.** It looks like the obvious
 * Turkish spelling of *gradian* and it is already taken: in Turkish `gradyan`
 * means **gradient**, the vector-calculus operator and the slope of a road, and
 * a reader who types it is not measuring an angle. Turkish surveying writes
 * `grad`, and the ISO `gon` beside it; both are already in `units.ts`, and
 * `grad` is what this file prints. Inventing `gradyan` for this unit would be
 * inventing Turkish over the top of a word Turkish already uses for something
 * else — the trap `@smartput/measure/locale/id` records for `pika`.
 *
 * What the omission costs was measured rather than assumed, and `tr.test.ts`
 * pins it: `gradyan` is one edit away from `radyan`, so an engine that meets the
 * word does not refuse it — the fuzzy corrector reads it as the radian. That is
 * a correction the engine can explain and rank against alternatives, where an
 * alias would have been a silent claim; and the alternative was never silence,
 * because claiming the word would answer an angle to every Turkish sentence
 * about the slope of a road.
 *
 * **`derece` is claimed here and is not this engine's only degree.** It is
 * equally the Turkish word for a degree of temperature ("30 derece"), a degree
 * of rank and an academic degree. That is exactly the polysemy English `degree`
 * already carries, and it resolves the same way: the temperature kind is entered
 * through `°C`/`santigrat` and never through a bare `derece`, so two readings do
 * not both reach the solver for one surface. A future
 * `@smartput/temperature/locale/tr` that claimed the bare `derece` would put two
 * kinds in front of one word — the ordinary cross-kind ambiguity, weighed rather
 * than refused, but worth knowing about before it appears.
 *
 * **`devir` is a full rotation, and `tur` is listed beside it.** `devir` is the
 * technical noun — a Turkish tachometer is calibrated in `devir/dakika`, which
 * is exactly this unit divided by a duration — so it is what this file prints.
 * `tur` is the everyday word for the same thing ("bir tur döndü") and is listed
 * for reading. Neither is abbreviated in Turkish: `rpm` is borrowed whole and
 * `d/dk` is a compound of two abbreviations rather than a symbol for this unit,
 * so the symbol is the spelled noun. R8 wants an explicit symbol on every unit,
 * never an invented one.
 *
 * **Everything is lowercase**, because Turkish capitalises no common noun — so
 * the string this table prints is the string the alias index holds, and rule 5
 * needs none of the folding `de.test.ts` does. That is deliberate rather than
 * incidental in this language: `buildRegistry` folds alias keys with
 * `toLocaleLowerCase("tr")`, under which `I` becomes `ı` and not `i`, so a
 * capital in an alias would be indexed under a different letter than the reader
 * typed. Incoming capitals are `turkish.analyze`'s `caseFolds` to handle.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in a Turkish engine and
 * the micro path (`parseAngle`) cannot drift from it. What this file adds is the
 * three Turkish nouns and the degree sign.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/tr` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "angle",
  units: {
    rad: {
      aliases: [...alias("rad"), "radyan"],
      symbol: "rad",
      forms: { other: "radyan" },
    },
    // `°` is written into `aliases` because it is the string this table prints
    // as its symbol and `units.ts` does not declare it. A printed string that is
    // not a readable one is what `assertLocaleContract` fails on, and the
    // suffix stripper cannot manufacture a punctuation mark.
    deg: {
      aliases: [...alias("deg"), "derece", "°"],
      symbol: "°",
      forms: { other: "derece" },
    },
    // Both names already come from `units.ts`; what this entry decides is which
    // of them gets printed. Turkish surveying writes `grad`, and `gradyan` is
    // the word this file refuses — see the header.
    grad: {
      aliases: [...alias("grad")],
      symbol: "grad",
      forms: { other: "grad" },
    },
    turn: {
      aliases: [...alias("turn"), "devir", "tur"],
      symbol: "devir",
      forms: { other: "devir" },
    },
  },
});
