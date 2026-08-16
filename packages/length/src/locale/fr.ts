import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk` and `es` next door make, kept here for `es`'s
 * reason rather than `en`'s.
 *
 * French's own conversion keywords are `en` and `vers`
 * (`@smartput/core/locale/fr`), so `in` is not shadowed by anything French —
 * it would be perfectly reachable in an fr-only engine, and "en" would be the
 * thing at risk instead. It stays out anyway, because `registry.aliasIndex` is
 * one flat map that `MatchCtx.isUnitAlias` reads without consulting a locale: a
 * French vocabulary registering `in` would put it back in front of
 * `@smartput/datetime`'s accept-gate for any engine speaking both languages,
 * and "in 3 days" would read as an all-units phrase again. A French reader
 * types `pouce`, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * French words for the length units — the same eight units `en`, `uk` and `es`
 * name, and the same answer to "does this unit have words at all?": all eight
 * do. French writes a length out as readily as English does.
 *
 * **Two `forms` keys, and the boundary between them is not English's.**
 * `french.selectForm` returns `one` or `other`, but French puts the singular on
 * everything below two: 0 is `one` ("zéro mètre"), 1 is `one`, and every
 * fraction under two is `one` as well — "1,5 kilomètre", where English writes
 * "1.5 kilometres". `other` starts at 2 and also covers the count-free
 * conversion target (ruling R5), which is what French grammar wants anyway:
 * "1 km en mètres" names the target in the plural. Gender is real ("un mètre",
 * "une livre" over in `@smartput/mass`) but it is a property of the *noun*, not
 * of the slot, so it selects nothing and must not be a key (rule 6). Ukrainian
 * next door needs eight keys because it composes a grammatical case with a
 * plural category; French composes nothing, so a third row would be a word no
 * count could ever select.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a French engine and
 * the micro path (`parseLength`) cannot drift from it. That reuse pays an
 * unusually large dividend here, because English's *British* spellings are the
 * French words with the accent taken off: `millimetre`, `centimetre`, `metre`
 * and `kilometre` are all already in the index, and they are exactly the
 * accent-free twins a French keyboard without a dead key produces. NFKC folding
 * leaves a precomposed `è` as `è` rather than stripping it, so those twins are
 * different strings that would otherwise have to be declared by hand — `es.ts`
 * and `@smartput/volume/locale/es` both declare theirs for that reason. Here
 * they arrive for free, and only the accented spellings are appended.
 *
 * Both numbers of every French noun are declared, because every string this
 * file *prints* has to be a string it reads and a printed plural recovered only
 * by the language's penalised suffix stripper is a reading this vocabulary
 * should not be leaving to a guess. Every plural is the plain `-s`; no unit
 * noun here takes the `-x` the stripper also carries.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what French itself writes ("5 km", never "5 kilom."), and the spelled
 * singular noun on the four imperial ones. French has no abbreviation of its
 * own for an inch, a foot, a yard or a mile: where a short form appears at all
 * it is the English one, which `units.ts` already registers as an alias, so
 * claiming it as the *French* symbol would buy nothing and would print "36 in"
 * at a reader who wrote "pouces". `uk` and `es` make the same call for all four
 * (R8 wants an explicit symbol, never an invented one).
 *
 * **The mile is the one entry a French vocabulary cannot spell the obvious
 * way.** The traditional French name for the anglo-saxon mile is `mille`, and
 * `mille` is the numeral 1000 in `fr-cardinals.ts`'s `scales` table — the fold
 * claims it before any alias index is consulted, so "1 mille" reads as the
 * number 1000 and always will. The word is therefore not declared: an alias
 * that can never be reached is a dead entry that looks like coverage, which is
 * the same reasoning `fr.ts` gives for leaving the elided "d'" out of its
 * keywords. What *is* declared is the plural `milles`, which is unambiguous —
 * the numeral `mille` is invariable, so French never writes "deux milles" for
 * 2000 and the fold has no claim on it — and the printed form is `mile` /
 * `miles`, the borrowed spelling Le Robert lists beside the traditional one and
 * the one `units.ts` already carries in both numbers. A reader who types the
 * traditional singular gets a number instead of a length; that is a gap in what
 * one grammar can express, recorded here rather than papered over, and
 * `fr.test.ts` pins it so the day `lex` learns to prefer a unit reading it
 * shows up as a failing assertion.
 *
 * Like `en`, `uk` and `es`, this file names `length` by **id string** and never
 * imports the kind, which is what lets `@smartput/length/locale/fr` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "millimètre", "millimètres"],
      symbol: "mm",
      forms: { one: "millimètre", other: "millimètres" },
    },
    cm: {
      aliases: [...alias("cm"), "centimètre", "centimètres"],
      symbol: "cm",
      forms: { one: "centimètre", other: "centimètres" },
    },
    m: {
      aliases: [...alias("m"), "mètre", "mètres"],
      symbol: "m",
      forms: { one: "mètre", other: "mètres" },
    },
    km: {
      aliases: [...alias("km"), "kilomètre", "kilomètres"],
      symbol: "km",
      forms: { one: "kilomètre", other: "kilomètres" },
    },
    // "pouce" is masculine and is also the French word for a thumb, which is
    // where the unit came from in both languages. No other kind in this repo
    // claims it except `@smartput/measure`, which is the same unit under a
    // typographer's name and is deliberately outside `BUILTIN_KINDS`.
    in: {
      aliases: [...alias("in"), "pouce", "pouces"],
      symbol: "pouce",
      forms: { one: "pouce", other: "pouces" },
    },
    ft: {
      aliases: [...alias("ft"), "pied", "pieds"],
      symbol: "pied",
      forms: { one: "pied", other: "pieds" },
    },
    // Borrowed with its spelling intact and pluralised the French way, which is
    // the same `-s`, so both forms arrive from `units.ts` already and this entry
    // adds no alias of its own. The `forms` rows are what make the French
    // printer say them.
    yd: {
      aliases: [...alias("yd")],
      symbol: "yard",
      forms: { one: "yard", other: "yards" },
    },
    // See the doc comment above: `milles` is declared and the bare `mille` is
    // not, because the numeral fold owns that word.
    mi: {
      aliases: [...alias("mi"), "milles"],
      symbol: "mile",
      forms: { one: "mile", other: "miles" },
    },
  },
});
