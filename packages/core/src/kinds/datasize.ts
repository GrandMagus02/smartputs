import { defineKind } from "../kind/define";

export const datasize = defineKind({
  id: "datasize",
  value: {
    mode: "ratio",
    canonical: "b",
    units: {
      b: 1,
      kb: 1e3,
      mb: 1e6,
      gb: 1e9,
      tb: 1e12,
      kib: 1024,
      mib: 1024 ** 2,
      gib: 1024 ** 3,
      tib: 1024 ** 4,
    },
  },
  lexicon: {
    b: { aliases: ["b", "byte"], symbol: "b" },
    kb: { aliases: ["kb", "kilobyte"], symbol: "kb" },
    mb: { aliases: ["mb", "megabyte"], symbol: "mb" },
    gb: { aliases: ["gb", "gigabyte"], symbol: "gb" },
    tb: { aliases: ["tb", "terabyte"], symbol: "tb" },
    kib: { aliases: ["kib", "kibibyte"], symbol: "kib" },
    mib: { aliases: ["mib", "mebibyte"], symbol: "mib" },
    gib: { aliases: ["gib", "gibibyte"], symbol: "gib" },
    tib: { aliases: ["tib", "tebibyte"], symbol: "tib" },
  },
});
