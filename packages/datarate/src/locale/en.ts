import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * English words for the datarate units.
 *
 * The kind next door names no language at all: it is ratios, unit ids, the
 * magnitude bands `typical` records, and four bridge signatures that name their
 * operand kinds by string. This file is the only place in the package an
 * English word appears.
 *
 * It names `datarate` by **id string** rather than by importing the kind, which
 * is what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/datarate/locale/uk` be imported without linking the ratio
 * table. `composeLocale` is where the two halves meet.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseDatarate`) and the engine path agree by
 * construction. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that forgot
 * its symbol would move a byte rather than fail.
 *
 * No `forms` on any unit, and that is the same ruling `units.ts` argues for the
 * absent byte-per-second units: a written-out form here is a compound
 * ("megabits per second") that the lexer cannot read back, and a name that
 * never parses back is a dead end for completion. Absent forms keep
 * `formatValue` on the symbol, so a datarate prints as "2,000mbps" — the shape
 * `speed` formats "100kph" through.
 */
export default defineVocabulary({
  locale: "en",
  kind: "datarate",
  units: {
    bps: { aliases: alias("bps"), symbol: "bps" },
    kbps: { aliases: alias("kbps"), symbol: "kbps" },
    mbps: { aliases: alias("mbps"), symbol: "mbps" },
    gbps: { aliases: alias("gbps"), symbol: "gbps" },
    tbps: { aliases: alias("tbps"), symbol: "tbps" },
  },
});
