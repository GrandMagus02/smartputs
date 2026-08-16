import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * Aliases the engine's lexer can never hand back as a word.
 *
 * `in` is core's conversion keyword (`@smartput/core/locale/en`'s `keywords.in`,
 * alongside `to` and `as`), so `lex` emits it as a `keyword` token and a
 * vocabulary entry for it is unreachable on the engine path — the hand-written
 * lexicon this table replaced listed only `["inch"]` for that reason.
 *
 * The entry is not merely dead, though: `MatchCtx.isUnitAlias` reads
 * `registry.aliasIndex` directly, and `@smartput/datetime`'s accept-gate uses
 * it to refuse any phrase whose words are *all* unit aliases. Registering `in`
 * made "in 3 days" look like an all-units phrase, so the date literal was never
 * folded and the input died in the Pratt parser on a leading keyword.
 *
 * `units.ts` keeps `in` regardless: the micro path has no keyword grammar, and
 * `formatLength(v, "in")` → `"7in"` has to parse back in strict mode. The
 * registry's R2 pass knows about this omission too — a kind some language has
 * spoken for is indexed by its vocabulary's aliases alone, never by its unit
 * keys, precisely so a deliberate gap like this one is not filled back in.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * English words for the length units.
 *
 * The kind next door names no language at all: it is ratios, unit ids and the
 * magnitude bands `typical` records, and nothing a translator would touch.
 * This file is the only place in the package an English word appears.
 *
 * It names `length` by **id string** rather than by importing the kind, which
 * is what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/length/locale/uk` be imported without linking the ratio
 * table. `composeLocale` is where the two halves meet, at the integrator's own
 * wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseLength`) and the engine path agree by
 * construction — the cross-path test in `validate.test.ts` depends on exactly
 * that. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that forgot
 * its symbol would move a byte rather than fail.
 *
 * `forms` keys are whatever the composed language's `selectForm` returns. For
 * English that is `Intl.PluralRules`' categories, `one` and `other`; a language
 * with four of them declares four keys here, which is the whole point of a
 * table instead of a `singular`/`plural` pair.
 */
export default defineVocabulary({
  locale: "en",
  kind: "length",
  units: {
    mm: {
      aliases: alias("mm"),
      symbol: "mm",
      forms: { one: "millimetre", other: "millimetres" },
    },
    cm: {
      aliases: alias("cm"),
      symbol: "cm",
      forms: { one: "centimetre", other: "centimetres" },
    },
    m: { aliases: alias("m"), symbol: "m", forms: { one: "metre", other: "metres" } },
    km: {
      aliases: alias("km"),
      symbol: "km",
      forms: { one: "kilometre", other: "kilometres" },
    },
    in: {
      aliases: alias("in"),
      symbol: "in",
      forms: { one: "inch", other: "inches" },
    },
    ft: { aliases: alias("ft"), symbol: "ft", forms: { one: "foot", other: "feet" } },
    yd: { aliases: alias("yd"), symbol: "yd", forms: { one: "yard", other: "yards" } },
    mi: { aliases: alias("mi"), symbol: "mi", forms: { one: "mile", other: "miles" } },
  },
});
