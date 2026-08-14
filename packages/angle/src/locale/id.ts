import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Indonesian words for the angle units — the same four `en`, `uk` and `nl`
 * name, and all four have words: Indonesian writes every one of them out.
 *
 * **One `forms` key per unit, and that is the entire grammar of this file.**
 * `indonesian.selectForm` is the constant `() => "other"`. This is the kind
 * where the languages that *do* mark number make it visible — Dutch writes
 * `graad`/`graden` here and keeps `meter` invariant next door, because an angle
 * is counted and a length is measured out — and Indonesian collapses the
 * distinction entirely: there is no grammatical number to mark, so "satu
 * derajat", "sembilan puluh derajat" and "1,5 derajat" are one word in three
 * numerals. No gender, no case, no article, so a conversion target ("dalam
 * derajat") is spelled like a bare quantity too. `Intl.PluralRules("id")`
 * declares the single category `"other"`, so rule 6's "exactly the keys
 * `selectForm` can produce" is one row per unit rather than a table left
 * half-written.
 *
 * **Indonesian does not have to take `grad` away from the gradian, and German
 * did.** `@smartput/angle/locale/de` spends its header on that reservation: the
 * German word for an angular degree *is* `Grad`, the exact string `units.ts`
 * declares as the English abbreviation for the **gradian**, so one of the two
 * units had to yield. The Indonesian word is `derajat`, which collides with
 * nothing in this kind, so both units keep everything `units.ts` gave them.
 *
 * **`derajat` is claimed here and is not this engine's only degree.** It is
 * equally the Indonesian word for a degree of temperature ("30 derajat
 * Celsius") and for a degree of rank. That is exactly the polysemy English
 * `degree` already has, and it is resolved the same way: the temperature kind
 * is entered through `°C`/`celsius` and never through a bare `derajat`, so the
 * two readings do not both reach the solver for one surface. A future
 * `@smartput/temperature/locale/id` that claimed the bare `derajat` would put
 * two kinds in front of one word — the ordinary cross-kind ambiguity, weighed
 * rather than refused, but worth knowing about before it appears.
 *
 * **`gon` is what this file prints for the gradian**, not `gradian`. It is the
 * ISO name, it is what an Indonesian survey text writes, and `units.ts` already
 * declares it — as it declares `gradian`, which stays listed for reading. This
 * is `@smartput/angle/locale/nl`'s choice for the same reason: a name coined as
 * a symbol is the same string in every language that uses it.
 *
 * **`putaran` is a full rotation and `putar` is the verb.** Only the noun is
 * listed. Indonesian has no abbreviation for it — a tachometer here is labelled
 * `rpm`, borrowed whole, and its expansion `rotasi per menit` is a phrase — so
 * the symbol is the spelled noun. R8 wants an explicit symbol on every unit,
 * never an invented one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in an Indonesian engine
 * and the micro path (`parseAngle`) cannot drift from it. What this file adds
 * is two Indonesian nouns and the degree sign: *derajat* and *putaran*. The
 * other two units need nothing added, because Indonesian borrowed *radian* and
 * *gon* in the spellings `units.ts` already declares — so what those two entries
 * decide is only which of the names on hand gets printed.
 *
 * **There is no stripper behind these aliases.** `indonesian.analyze` is
 * `identity()` alone, so a form this file prints and forgets to list is
 * unreachable, with nothing to recover it at a penalty — which is why `°` is
 * written into `aliases` below rather than left to the symbol field alone. No
 * folding is needed on either side of that check: Indonesian capitalises no
 * noun.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/id` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "id",
  kind: "angle",
  units: {
    // `radian` is the Indonesian noun *and* the English one, spelled identically,
    // so `units.ts` has already declared it and this entry appends nothing. It is
    // listed here as a comment rather than a second array element because
    // `aliasesFor` returns `rad`/`radian`/`radians` and a repeated string would be
    // indexed twice under one unit — dead weight of exactly the kind rule 3's
    // "reuse rather than retype" exists to keep out.
    rad: {
      aliases: [...alias("rad")],
      symbol: "rad",
      forms: { other: "radian" },
    },
    // `°` is listed as an alias because it is the string this table prints as
    // its symbol and `units.ts` does not declare it — a printed string that is
    // not a readable one is what `assertLocaleContract` fails on, and in a
    // language with no analyzer chain there is nothing else to reach it.
    deg: {
      aliases: [...alias("deg"), "derajat", "°"],
      symbol: "°",
      forms: { other: "derajat" },
    },
    // Both names already come from `units.ts`; what this entry decides is which
    // of them gets printed. `gon` is the one an Indonesian survey text writes.
    grad: {
      aliases: [...alias("grad")],
      symbol: "gon",
      forms: { other: "gon" },
    },
    turn: {
      aliases: [...alias("turn"), "putaran"],
      symbol: "putaran",
      forms: { other: "putaran" },
    },
  },
});
