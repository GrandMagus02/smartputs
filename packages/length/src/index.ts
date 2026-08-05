import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { LENGTH_UNITS, type LengthUnit } from "./units";

export type { LengthUnit } from "./units";
export { LENGTH_UNITS } from "./units";

/**
 * Aliases the engine's lexer can never hand back as a word.
 *
 * `in` is core's conversion keyword (`locale/en`'s `keywords.in`, alongside
 * `to` and `as`), so `lex` emits it as a `keyword` token and a lexicon entry
 * for it is unreachable on the engine path — the hand-written lexicon this
 * table replaced listed only `["inch"]` for that reason.
 *
 * The entry is not merely dead, though: `MatchCtx.isUnitAlias` reads
 * `registry.aliasIndex` directly, and `@smartput/datetime`'s accept-gate uses
 * it to refuse any phrase whose words are *all* unit aliases. Registering `in`
 * made "in 3 days" look like an all-units phrase, so the date literal was never
 * folded and the input died in the Pratt parser on a leading keyword.
 *
 * `units.ts` keeps `in` regardless: the micro path has no keyword grammar, and
 * `formatLength(v, "in")` → `"7in"` has to parse back in strict mode.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

export const length = defineKind({
  id: "length",
  value: {
    mode: "ratio",
    canonical: LENGTH_UNITS.canonical,
    units: decimalRatios(LENGTH_UNITS),
  },
  lexicon: {
    mm: {
      aliases: alias("mm"),
      symbol: "mm",
      display: { one: "millimetre", other: "millimetres" },
      typical: [1, 1000],
    },
    cm: {
      aliases: alias("cm"),
      symbol: "cm",
      display: { one: "centimetre", other: "centimetres" },
      typical: [1, 300],
    },
    m: {
      aliases: alias("m"),
      symbol: "m",
      display: { one: "metre", other: "metres" },
      typical: [1, 1000],
    },
    km: {
      aliases: alias("km"),
      symbol: "km",
      display: { one: "kilometre", other: "kilometres" },
      typical: [1, 1000],
    },
    in: {
      aliases: alias("in"),
      symbol: "in",
      display: { one: "inch", other: "inches" },
      typical: [1, 120],
    },
    ft: {
      aliases: alias("ft"),
      symbol: "ft",
      display: { one: "foot", other: "feet" },
      typical: [1, 500],
    },
    yd: {
      aliases: alias("yd"),
      symbol: "yd",
      display: { one: "yard", other: "yards" },
      typical: [1, 500],
    },
    mi: {
      aliases: alias("mi"),
      symbol: "mi",
      display: { one: "mile", other: "miles" },
      typical: [0.1, 500],
    },
  },
});
