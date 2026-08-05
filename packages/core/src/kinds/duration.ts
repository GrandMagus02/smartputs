import { defineKind } from "../kind/define";

export const duration = defineKind({
  id: "duration",
  value: {
    mode: "ratio",
    canonical: "s",
    units: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
  },
  lexicon: {
    ms: {
      aliases: ["ms", "millisecond"],
      symbol: "ms",
      display: { one: "millisecond", other: "milliseconds" },
      typical: [1, 5000],
    },
    s: {
      aliases: ["s", "sec", "second"],
      symbol: "s",
      display: { one: "second", other: "seconds" },
      typical: [1, 300],
    },
    min: {
      aliases: ["min", "m", "minute"],
      symbol: "min",
      display: { one: "minute", other: "minutes" },
      typical: [1, 180],
    },
    h: {
      aliases: ["h", "hr", "hour"],
      symbol: "h",
      display: { one: "hour", other: "hours" },
      typical: [1, 72],
    },
    d: {
      aliases: ["d", "day"],
      symbol: "d",
      display: { one: "day", other: "days" },
      typical: [1, 90],
    },
    wk: {
      aliases: ["wk", "week"],
      symbol: "wk",
      display: { one: "week", other: "weeks" },
      typical: [1, 52],
    },
  },
});
