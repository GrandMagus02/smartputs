import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * English words for the number "units" — all one of them, and it barely has
 * any.
 *
 * `alias("one")` derives to `["one"]`, the table's mandatory self-alias rather
 * than a spelling anyone types: a bare numeral becomes a `number` AST node in
 * the grammar itself, never a literal-matcher lookup against this vocabulary,
 * and the word "one" is claimed first by the cardinal-word numeral parser
 * (`numberFromWords`) anyway. `validate.test.ts` pins that the self-alias is
 * inert on the engine path, with or without this file.
 *
 * `symbol` is the empty string, deliberately and not by omission: the kind is
 * `NUMBER_KIND`, and `formatValue` returns the bare number text before any
 * symbol is read. R8 wants an explicit symbol on every unit precisely so the
 * renderer's no-symbol branch stays unreachable, and `""` is the value
 * `toLexeme` computed here.
 *
 * There are no `forms`: nothing renders a word for this unit, so inventing
 * "one"/"ones" would be a translator's obligation invented out of nothing.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "en",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});
