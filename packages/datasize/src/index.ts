import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "./units";

export type { DatasizeUnit } from "./units";
export { DATASIZE_UNITS } from "./units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

export const datasize = defineKind({
  id: "datasize",
  value: {
    mode: "ratio",
    canonical: DATASIZE_UNITS.canonical,
    units: decimalRatios(DATASIZE_UNITS),
  },
  lexicon: {
    b: {
      aliases: alias("b"),
      symbol: "b",
      display: { one: "byte", other: "bytes" },
      typical: [1, 1024],
    },
    kb: {
      aliases: alias("kb"),
      symbol: "kb",
      display: { one: "kilobyte", other: "kilobytes" },
      typical: [1, 1000],
    },
    mb: {
      aliases: alias("mb"),
      symbol: "mb",
      display: { one: "megabyte", other: "megabytes" },
      typical: [1, 1000],
    },
    gb: {
      aliases: alias("gb"),
      symbol: "gb",
      display: { one: "gigabyte", other: "gigabytes" },
      typical: [0.5, 1000],
    },
    tb: {
      aliases: alias("tb"),
      symbol: "tb",
      display: { one: "terabyte", other: "terabytes" },
      typical: [0.1, 100],
    },
    kib: {
      aliases: alias("kib"),
      symbol: "kib",
      display: { one: "kibibyte", other: "kibibytes" },
      typical: [1, 1024],
    },
    mib: {
      aliases: alias("mib"),
      symbol: "mib",
      display: { one: "mebibyte", other: "mebibytes" },
      typical: [1, 1024],
    },
    gib: {
      aliases: alias("gib"),
      symbol: "gib",
      display: { one: "gibibyte", other: "gibibytes" },
      typical: [0.5, 1024],
    },
    tib: {
      aliases: alias("tib"),
      symbol: "tib",
      display: { one: "tebibyte", other: "tebibytes" },
      typical: [0.1, 100],
    },
  },
});
