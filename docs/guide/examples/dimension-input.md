---
title: A dimension input with maths in it
description: The Figma-style width box — px, rem, em and % in one field, arithmetic inside the box, and a bare number that takes the field's unit.
---

# A dimension input with maths in it

Design tools all made the same decision about their number boxes: whatever is
in there is an **expression**, not a number. Type `2+4` into Figma's width and
you get `6`. Type `100%-24` and you get the parent minus a gutter. The box
never opens a calculator; it just reads what you wrote.

That behaviour is three things — a small unit table, one bridge to plain
numbers, and a document the relative units resolve against. Here it is, whole:

<SpDimensionInput />

## Why not `@smartput/measure`

[`@smartput/measure`](/packages/measure) exists and has `px` in it, along with
`pt`, `pc`, `mm`, `cm` and `inch` — the units a *print* document is measured
in. Its `px` is `1/dpi` of an inch, which is exactly right for a page that will
be printed and exactly wrong for a screen layout, where `rem` and `%` are the
two units people actually reach for and neither is a fraction of an inch.

So this field defines its own kind. That is not a workaround, it is the
supported path: `defineKind` is the same public API every built-in registers
through, and a CSS length is a kind of quantity nobody else's table can state
for you.

## The kind

Four units. `px` is the canonical one and the only constant in the table — the
other three are functions of the document the value sits in.

```ts
// docs/.vitepress/theme/css-kind.ts
import { Decimal, defineKind, deriveValue, NUMBER_KIND } from "@smartput/core";

export interface CssDocument {
  readonly rootFontSize: number;  // what one rem is worth, in px
  readonly fontSize: number;      // what one em is worth, in px
  readonly parentSize: number;    // the box a percentage is a percentage of
}

export function pxPerUnit(unit: string, doc: Partial<CssDocument> = {}): number {
  switch (unit) {
    case "rem": return doc.rootFontSize ?? 16;
    case "em":  return doc.fontSize ?? 16;
    case "%":   return (doc.parentSize ?? 320) / 100;
    default:    return 1;
  }
}

export const css = defineKind({
  id: "css",
  value: {
    mode: "ratio",
    canonical: "px",
    units: {
      px: 1,
      rem: { ratio: (ctx) => new Decimal(pxPerUnit("rem", ctx.self.meta)) },
      em:  { ratio: (ctx) => new Decimal(pxPerUnit("em",  ctx.self.meta)) },
      "%": { ratio: (ctx) => new Decimal(pxPerUnit("%",   ctx.self.meta)) },
    },
  },
  // CSS writes no space between the number and the unit.
  format: (value, ctx) => `${ctx.formatNumber(ctx.authored)}${value.unit}`,
})
```

A **function ratio** is the mechanism [`measure`](/packages/measure) already
uses for `px`, and `ctx.self.meta` is where the context arrives. The document
is supplied once, per engine:

```ts
createEngine({
  locales: [composeLocale(english, numberWords)],
  kinds: [numberKind, css],
  kindMeta: { css: { rootFontSize: 16, fontSize: 16, parentSize: 320 } },
})
```

Move the sliders in the demo and every value written in `rem` or `%` moves with
them while every value in `px` stays put. That is the whole reason those are
units and not sugar: `24px in rem` is a conversion, and it has a different
answer in a 16px document than in a 20px one.

::: tip One `pxPerUnit`, read twice
The unit table and the op signatures below both call the same function. Two
implementations of "what is a rem" is how a field converts one way and gets a
different number back.
:::

## `2 + 4px` — the bridge

Out of the box this throws, and correctly:

```ts
engine.evaluate("2 + 4px");
// DimensionMismatchError: Cannot apply operation to number and css
```

`1 kg + 2` has no defensible reading, so `number + <anything>` is not a
signature the engine generates. But `4px + 2` has exactly one reading, because
a dimension box is a context where every bare number is already a length. The
kind says so, in four signatures:

```ts
const bridge = (op: "+" | "-") => (left, right) => {
  const dimension = left.kind === "css" ? left : right;
  const bare      = left.kind === "css" ? right : left;

  // The bare number takes the *neighbour's* unit — 4px + 2 is 6px, and
  // 1.5rem + 4 is 5.5rem.
  const scaled = bare.canonical.times(pxPerUnit(dimension.unit, dimension.meta));
  const [a, b] = left.kind === "css" ? [left.canonical, scaled] : [scaled, right.canonical];

  return deriveValue(dimension, op === "+" ? a.plus(b) : a.minus(b));
};

ops: (["+", "-"] as const).flatMap((op) => [
  { op, left: "css",       right: NUMBER_KIND, result: "css", apply: bridge(op) },
  { op, left: NUMBER_KIND, right: "css",       result: "css", apply: bridge(op) },
]),
```

Both orders are two signatures rather than one, because an `OpSignature` is
keyed on `(op, left, right)` and `2 + 4px` and `4px + 2` are different keys.
`*` and `/` need no bridge at all: scaling a quantity by a number is generated
for every ratio kind, which is why `100%/2` and `4px*3` already work.

## The field's unit, which is not the kind's business

One case is left: a lone `2`, with no unit anywhere in the expression. That
evaluates to a `number`, and the kind cannot help — it has no idea which field
it is in. Figma's rule is that the box keeps its last unit, and that is a
property of the box:

```ts
const outcome = computed(() => {
  const first = evaluateSafely(engine.value, text.value);
  if (first.status !== "ok" || first.result.kind !== "number") return first;

  // Re-read the number in the field's own unit. The second evaluation is over
  // a string the first one produced, so nothing here parses by hand.
  return evaluateSafely(engine.value, `${first.result.value.canonical}${unit.value}`);
});
```

Committing is the other half of the design-tool behaviour — on Enter or blur
the expression is replaced by what it came to, and the unit it landed in
becomes the field's:

```ts
function commit() {
  if (outcome.value.status !== "ok") return;
  text.value = outcome.value.result.formatted;      // "6px"
  unit.value = outcome.value.result.value.unit;     // "px"
}
```

`formatted` is safe to put back in the box because the `format` hook writes
`6px`, which is a string the same engine reads. A formatter whose output does
not parse is a field that breaks on its second Enter.

## What the layout gets

The stored value is `canonical`, and canonical here is px:

```ts
const px = outcome.result.value.canonical.toNumber();   // 6
element.style.width = `${px}px`;
```

Keep the authored text too, if the document is going to be edited again:
`50%` and `160px` are the same width today and different widths after somebody
resizes the frame. `result.value.unit` plus the authored number is what
survives that; a px number does not.

## An engine with two kinds and no others

```ts
const numberKind = BUILTIN_KINDS.find((kind) => kind.id === "number");
const numberWords = BUILTIN_EN.filter((vocabulary) => vocabulary.kind === "number");
```

A width box should read `2 + 4` and refuse `5 kg`, so it registers the number
kind and the CSS kind and nothing else. The vocabulary has to be filtered to
match: `createEngine` throws `UnknownKindError` for a locale pack that
contributes words to a kind nobody registered — which is the error you get if
you hand it `BUILTIN_EN` out of habit.

Refusing is not a silent failure, either:

```ts
engine.evaluate("5 kg");
// NoCandidateError: Unknown unit "kg". Did you mean: %, em, px?
```

## Checklist

- the kind's relative units read the document off `ctx.self.meta`, supplied
  once through `kindMeta` — never off a module-level variable
- one `pxPerUnit`, called by both the unit table and the op signatures
- both operand orders declared for `+` and `-`; nothing declared for `*` and
  `/`, which ratio kinds generate
- the field, not the kind, decides what a lone number means
- commit on Enter **and** blur, and write back `formatted` so the box round-trips
- store `canonical` for layout, the authored unit for editing
- the engine registers only the kinds the field accepts, and only their words

## See also

- [Defining a kind](/guide/defining-a-kind) — the full `defineKind` surface
- [`@smartput/measure`](/packages/measure) — the print-side table, if your
  document is a page rather than a screen
- [Inputs and error messages](/guide/inputs) — the accessibility wiring this
  field's chrome leaves out for brevity
