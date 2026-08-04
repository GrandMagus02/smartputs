import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";

const DEFAULT_DPI = 96;

/**
 * Typographic measurement. `px` is the only dpi-relative unit, and it reads its
 * dpi from the value's own `meta` — the one generic escape hatch, used by the
 * one kind that needs it. There is deliberately no per-kind context mechanism.
 *
 * Arithmetic runs in canonical inches, so operands authored at different dpi
 * still combine correctly.
 */
export const measure = defineKind({
  id: "measure",
  value: {
    mode: "ratio",
    canonical: "inch",
    units: {
      inch: 1,
      mm: new Decimal(1).div(25.4),
      cm: new Decimal(1).div(2.54),
      pt: new Decimal(1).div(72),
      pc: new Decimal(1).div(6),
      px: {
        ratio: (ctx) => {
          const dpi = ctx.self.meta?.dpi;
          return new Decimal(1).div(typeof dpi === "number" ? dpi : DEFAULT_DPI);
        },
      },
    },
  },
  lexicon: {
    inch: {
      aliases: ["inch"],
      symbol: "inch",
      display: { one: "inch", other: "inches" },
      typical: [1, 120],
    },
    mm: {
      aliases: ["mm", "millimetre", "millimeter"],
      symbol: "mm",
      display: { one: "millimetre", other: "millimetres" },
      typical: [1, 1000],
    },
    cm: {
      aliases: ["cm", "centimetre", "centimeter"],
      symbol: "cm",
      display: { one: "centimetre", other: "centimetres" },
      typical: [1, 300],
    },
    pt: {
      aliases: ["pt", "point"],
      symbol: "pt",
      display: { one: "point", other: "points" },
      typical: [1, 1000],
    },
    pc: {
      aliases: ["pc", "pica"],
      symbol: "pc",
      display: { one: "pica", other: "picas" },
      typical: [1, 100],
    },
    px: {
      aliases: ["px", "pixel"],
      symbol: "px",
      display: { one: "pixel", other: "pixels" },
      typical: [1, 4000],
    },
  },
});
