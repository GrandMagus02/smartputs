import { defineKind } from "../kind/define";

export const duration = defineKind({
  id: "duration",
  value: {
    mode: "ratio",
    canonical: "s",
    units: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
  },
  lexicon: {
    ms: { aliases: ["ms", "millisecond"], symbol: "ms" },
    s: { aliases: ["s", "sec", "second"], symbol: "s" },
    min: { aliases: ["min", "m", "minute"], symbol: "min" },
    h: { aliases: ["h", "hr", "hour"], symbol: "h" },
    d: { aliases: ["d", "day"], symbol: "d" },
    wk: { aliases: ["wk", "week"], symbol: "wk" },
  },
});
