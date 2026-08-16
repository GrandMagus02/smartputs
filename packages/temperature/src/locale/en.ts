import { aliasesFor } from "@smartput/kind/aliases";
import type { Vocabulary } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * English words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, because one package
 * defines two kinds and a `Vocabulary` names exactly one of them.
 *
 * No `forms` on any unit, deliberately. The written form a person actually
 * uses is the symbol — "20°C", not "20 celsius" — and the one genuine word
 * form, "20 degrees celsius", does not parse: the analyzers have no route from
 * a two-word unit back to an alias. A bare "20 celsius" parses but reads worse
 * than the symbol it would replace, so the renderer keeps the symbol and
 * completion falls back to the alias, which is already the string a user would
 * type. `symbol` is explicit on all six entries (ruling R8): the renderer's
 * no-symbol branch joins number and unit *with* a space, so a unit that forgot
 * its symbol would move a byte rather than fail.
 *
 * Both kinds are given the identical alias list, derived from the one shared
 * `ALIAS` object in `units.ts`. That is load-bearing rather than tidy: every
 * temperature alias resolving to two kinds is the case `print/unit-word.ts`'s
 * ambiguity fallback exists for, and it is also what lets "20 C + 5 F" read
 * its right operand as a difference. Deriving both lists from the table keeps
 * them equal by construction instead of by proofreading.
 *
 * The kinds next door name no language at all: ratios, offsets, unit ids and
 * the magnitude bands `typical` records. Neither vocabulary imports them — it
 * names them by id string, which is what lets a translation ship from someone
 * who is not the kinds' author.
 */
const temperatureEn: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "en",
    kind: "temperature",
    units: {
      c: { aliases: alias("c"), symbol: "°C" },
      f: { aliases: alias("f"), symbol: "°F" },
      k: { aliases: alias("k"), symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "en",
    kind: "tempdelta",
    units: {
      c: { aliases: deltaAlias("c"), symbol: "°C" },
      f: { aliases: deltaAlias("f"), symbol: "°F" },
      k: { aliases: deltaAlias("k"), symbol: "K" },
    },
  }),
];

export default temperatureEn;
