import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * English words for the datasize units.
 *
 * The kind next door names no language at all: it is ratios, unit ids and the
 * magnitude bands `typical` records. This file is the only place in the
 * package an English word appears.
 *
 * It names `datasize` by **id string** rather than by importing the kind,
 * which is what lets a translation ship from someone who is not the kind's
 * author and lets `@smartput/datasize/locale/uk` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseDatasize`) and the engine path agree by
 * construction. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that
 * forgot its symbol would move a byte rather than fail.
 *
 * The decimal and binary spellings are separate units rather than two names
 * for one (`kb` is 1000 bytes, `kib` is 1024), so each carries its own words:
 * "kilobyte" and "kibibyte" are not synonyms and must never fold together.
 */
export default defineVocabulary({
  locale: "en",
  kind: "datasize",
  units: {
    b: { aliases: alias("b"), symbol: "b", forms: { one: "byte", other: "bytes" } },
    kb: {
      aliases: alias("kb"),
      symbol: "kb",
      forms: { one: "kilobyte", other: "kilobytes" },
    },
    mb: {
      aliases: alias("mb"),
      symbol: "mb",
      forms: { one: "megabyte", other: "megabytes" },
    },
    gb: {
      aliases: alias("gb"),
      symbol: "gb",
      forms: { one: "gigabyte", other: "gigabytes" },
    },
    tb: {
      aliases: alias("tb"),
      symbol: "tb",
      forms: { one: "terabyte", other: "terabytes" },
    },
    kib: {
      aliases: alias("kib"),
      symbol: "kib",
      forms: { one: "kibibyte", other: "kibibytes" },
    },
    mib: {
      aliases: alias("mib"),
      symbol: "mib",
      forms: { one: "mebibyte", other: "mebibytes" },
    },
    gib: {
      aliases: alias("gib"),
      symbol: "gib",
      forms: { one: "gibibyte", other: "gibibytes" },
    },
    tib: {
      aliases: alias("tib"),
      symbol: "tib",
      forms: { one: "tebibyte", other: "tebibytes" },
    },
  },
  // Weights are single digits, clamped per kind per mark by `CUE_CEILING`
  // (4) -- see `duration`'s table for the derivation. A cue ranks readings
  // that already exist; none of these can turn a bare number into a
  // datasize.
  //
  // No word collided with datasize's own aliases or another kind's, so
  // nothing was dropped or second-guessed here. With `BUILTIN_KINDS` alone
  // datasize has no ambiguous surface -- "5 mb" already resolves at
  // confidence 1.000 -- so this table cannot move a ranking today; it is
  // wired into the cue index and goes live once a kind with an overlapping
  // alias ships.
  cues: { file: 3, download: 2, upload: 2, disk: 3, storage: 3, ram: 3, quota: 2 },
});
