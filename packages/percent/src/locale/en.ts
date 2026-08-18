import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * English words for the percent unit.
 *
 * The kind next door names no language at all: it is one ratio, one unit id and
 * the arithmetic that makes a percentage behave like a number. This file is the
 * only place in the package an English word appears.
 *
 * It names `percent` by **id string** rather than by importing the kind, which
 * is what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/percent/locale/uk` be imported without linking the ratio
 * table. `composeLocale` is where the two halves meet.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parsePercent`) and the engine path agree by
 * construction. `units.ts` is also where the note lives about what that alias
 * map covers: every spelling the hand-written lexicon this file replaces used
 * to list (`%`, `percent`, `pct`) plus the plurals the English suffix stripper
 * used to fold onto them for free, spelled out because the flat table does no
 * stripping.
 *
 * No `forms`: the written form of this unit is the symbol. "20 percent" does
 * parse — that is what the aliases are for — but rendering it that way would
 * make every percentage in every result read as a word, and completion falling
 * back to the bare alias "%" is already the form a user wants to type. `symbol`
 * is explicit all the same (ruling R8): the renderer's no-symbol branch joins
 * number and unit without a space, so a unit that forgot its symbol would move
 * a byte rather than fail.
 *
 * `tight: true` is the other half of that (ruling R-C1): a symbol now takes a
 * space unless its word says it is written against the number, and `%` is the
 * clearest case there is — "20%", never "20 %", in every locale this package
 * ships. It is a property of the WORD, not of the kind, which is why it sits
 * here and not on the kind next door.
 */
export default defineVocabulary({
  locale: "en",
  kind: "percent",
  units: {
    "%": { aliases: alias("%"), symbol: "%", tight: true },
  },
  // Weights are single digits, clamped per kind per mark by `CUE_CEILING`
  // (4) -- see `duration`'s table for the derivation. A cue ranks readings
  // that already exist; none of these can turn a bare number into a
  // percentage on its own.
  //
  // `off` is deliberately absent: it is core's `off` operator
  // (`@smartput/core`'s `en` locale keywords), and "20 off" backs off to a
  // bare `20`, putting `off` *outside* the mark -- exactly where a percent
  // cue would silently turn a plain number into a percentage, which spec §9
  // forbids. `discount` was checked and kept: the only grep hit against it is
  // a core comment recording that "discount" was deliberately *not* made a
  // spelling of `off`, not a real collision. `rate` earns 1 rather than more
  // for the same weak-evidence reason `from` and `long` earn 1 in `length`'s
  // table.
  cues: { discount: 3, increase: 2, growth: 2, share: 2, rate: 1 },
});
