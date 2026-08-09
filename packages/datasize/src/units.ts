import type { UnitTable } from "@smartput/shared";

export type DatasizeUnit =
  | "b"
  | "kb"
  | "mb"
  | "gb"
  | "tb"
  | "kib"
  | "mib"
  | "gib"
  | "tib";

/**
 * Decimal prefixes (kb/mb/gb/tb, powers of 1000) and binary prefixes
 * (kib/mib/gib/tib, powers of 1024) are genuinely different units, not two
 * spellings of one: `1 kb in b` is 1000, `1 kib in b` is 1024. Every ratio
 * here is an exact power of 1000 or 1024, so there is nothing for a decimal
 * string to round -- unlike `angle`, these strings are exact, not truncated.
 */
export const DATASIZE_UNITS: UnitTable<DatasizeUnit> = {
  canonical: "b",
  ratio: {
    b: "1",
    kb: "1000",
    mb: "1000000",
    gb: "1000000000",
    tb: "1000000000000",
    kib: "1024",
    mib: "1048576",
    gib: "1073741824",
    tib: "1099511627776",
  },
  alias: {
    b: "b",
    byte: "b",
    bytes: "b",
    kb: "kb",
    kilobyte: "kb",
    kilobytes: "kb",
    mb: "mb",
    megabyte: "mb",
    megabytes: "mb",
    gb: "gb",
    gigabyte: "gb",
    gigabytes: "gb",
    tb: "tb",
    terabyte: "tb",
    terabytes: "tb",
    kib: "kib",
    kibibyte: "kib",
    kibibytes: "kib",
    mib: "mib",
    mebibyte: "mib",
    mebibytes: "mib",
    gib: "gib",
    gibibyte: "gib",
    gibibytes: "gib",
    tib: "tib",
    tebibyte: "tib",
    tebibytes: "tib",
  },
};
