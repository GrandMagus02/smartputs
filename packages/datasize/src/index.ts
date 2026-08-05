import { defineKind } from "@smartput/core";

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
    b: {
      aliases: ["b", "byte"],
      symbol: "b",
      display: { one: "byte", other: "bytes" },
      typical: [1, 1024],
    },
    kb: {
      aliases: ["kb", "kilobyte"],
      symbol: "kb",
      display: { one: "kilobyte", other: "kilobytes" },
      typical: [1, 1000],
    },
    mb: {
      aliases: ["mb", "megabyte"],
      symbol: "mb",
      display: { one: "megabyte", other: "megabytes" },
      typical: [1, 1000],
    },
    gb: {
      aliases: ["gb", "gigabyte"],
      symbol: "gb",
      display: { one: "gigabyte", other: "gigabytes" },
      typical: [0.5, 1000],
    },
    tb: {
      aliases: ["tb", "terabyte"],
      symbol: "tb",
      display: { one: "terabyte", other: "terabytes" },
      typical: [0.1, 100],
    },
    kib: {
      aliases: ["kib", "kibibyte"],
      symbol: "kib",
      display: { one: "kibibyte", other: "kibibytes" },
      typical: [1, 1024],
    },
    mib: {
      aliases: ["mib", "mebibyte"],
      symbol: "mib",
      display: { one: "mebibyte", other: "mebibytes" },
      typical: [1, 1024],
    },
    gib: {
      aliases: ["gib", "gibibyte"],
      symbol: "gib",
      display: { one: "gibibyte", other: "gibibytes" },
      typical: [0.5, 1024],
    },
    tib: {
      aliases: ["tib", "tebibyte"],
      symbol: "tib",
      display: { one: "tebibyte", other: "tebibytes" },
      typical: [0.1, 100],
    },
  },
});
