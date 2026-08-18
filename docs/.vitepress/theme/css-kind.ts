import type { EvalCtx, Kind, Value } from "@smartput/core";
import {
  composeLocale,
  createEngine,
  Decimal,
  defineKind,
  deriveValue,
  type Engine,
  NUMBER_KIND,
} from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

/**
 * A CSS length kind, defined here rather than shipped — see
 * [/guide/examples/dimension-input](the page it belongs to).
 *
 * Four units, three of which are relative: `rem` to the root font size, `em` to
 * the element's, `%` to whatever box the value sits in. None of those three is
 * a constant, so this kind is the second one in the repo (after `measure`'s
 * `px`) whose ratios are functions — and the document they read is per value,
 * carried on `meta`, exactly the way `measure` carries a dpi.
 */
export interface CssDocument {
  /** `font-size` of `:root`, in px. What one `rem` is worth. */
  readonly rootFontSize: number;
  /** `font-size` of the element, in px. What one `em` is worth. */
  readonly fontSize: number;
  /** The box a percentage is a percentage *of*, in px. */
  readonly parentSize: number;
}

export const CSS_DEFAULTS: CssDocument = {
  rootFontSize: 16,
  fontSize: 16,
  parentSize: 320,
};

/**
 * How many px one of `unit` is worth in this document.
 *
 * One function, read by both the unit table and the two op signatures below, so
 * "what is a rem" has a single answer. Two answers is how a field converts one
 * way and back to a different number.
 */
export function pxPerUnit(unit: string, doc: Partial<CssDocument> = {}): number {
  switch (unit) {
    case "rem":
      return doc.rootFontSize ?? CSS_DEFAULTS.rootFontSize;
    case "em":
      return doc.fontSize ?? CSS_DEFAULTS.fontSize;
    case "%":
      return (doc.parentSize ?? CSS_DEFAULTS.parentSize) / 100;
    default:
      return 1;
  }
}

const documentOf = (value: Value): Partial<CssDocument> =>
  (value.meta ?? {}) as Partial<CssDocument>;

/**
 * `2 + 4px`. A bare number beside a dimension takes that dimension's unit,
 * which is what every design tool does and what `number + length` deliberately
 * does *not* do — `1 kg + 2` has no defensible reading, and `4px + 2` has
 * exactly one.
 *
 * The unit comes from the operand, not from the field: the field's unit only
 * decides what a lone `2` means, and by then there is no expression left to
 * evaluate. That case is handled in the input, not in the kind.
 */
const bridge =
  (op: "+" | "-") =>
  (left: Value, right: Value, _ctx: EvalCtx): Value => {
    const dimension = left.kind === CSS_KIND ? left : right;
    const bare = left.kind === CSS_KIND ? right : left;
    const scaled = bare.canonical.times(pxPerUnit(dimension.unit, documentOf(dimension)));
    const [a, b] =
      left.kind === CSS_KIND ? [left.canonical, scaled] : [scaled, right.canonical];
    return deriveValue(dimension, op === "+" ? a.plus(b) : a.minus(b));
  };

export const CSS_KIND = "css";

export const css: Kind = defineKind({
  id: CSS_KIND,
  value: {
    mode: "ratio",
    canonical: "px",
    units: {
      px: 1,
      rem: {
        ratio: (ctx: EvalCtx) => new Decimal(pxPerUnit("rem", documentOf(ctx.self))),
      },
      em: { ratio: (ctx: EvalCtx) => new Decimal(pxPerUnit("em", documentOf(ctx.self))) },
      "%": { ratio: (ctx: EvalCtx) => new Decimal(pxPerUnit("%", documentOf(ctx.self))) },
    },
  },
  ops: (["+", "-"] as const).flatMap((op) => [
    { op, left: CSS_KIND, right: NUMBER_KIND, result: CSS_KIND, apply: bridge(op) },
    { op, left: NUMBER_KIND, right: CSS_KIND, result: CSS_KIND, apply: bridge(op) },
  ]),
  // CSS writes no space between the number and the unit, and the value class is
  // the only thing that knows that. `formatNumber` rather than `toString`: the
  // locale's decimal separator is not this hook's business to invent.
  format: (value, ctx) => `${ctx.formatNumber(ctx.authored)}${value.unit}`,
});

/**
 * The one built-in this engine keeps. A dimension field should read `2 + 4` and
 * refuse `5 kg`, so it registers the number kind and nothing else — and takes
 * only the number vocabulary with it, because `createEngine` throws for a
 * locale pack that contributes words to a kind nobody registered.
 */
const numberKind = BUILTIN_KINDS.find((kind) => kind.id === NUMBER_KIND);
if (numberKind === undefined)
  throw new Error("css-kind: BUILTIN_KINDS has no number kind");

const numberWords = BUILTIN_EN.filter((vocabulary) => vocabulary.kind === NUMBER_KIND);

/** One engine per document, because the document is engine-level configuration. */
export function createCssEngine(doc: Partial<CssDocument> = {}): Engine {
  return createEngine({
    locales: [composeLocale(english, numberWords)],
    kinds: [numberKind, css],
    kindMeta: { [CSS_KIND]: { ...CSS_DEFAULTS, ...doc } },
  });
}

export const CSS_UNITS = ["px", "rem", "em", "%"] as const;
export type CssUnit = (typeof CSS_UNITS)[number];
