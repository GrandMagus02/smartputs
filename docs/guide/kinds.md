---
title: Kinds and units
description: What a kind is, which ones ship today, and how values are represented.
---

# Kinds and units

A **kind** is a domain of values that share a canonical unit and a set of legal
operations — `length`, `mass`, `duration`, `money`, `color`. A **unit** is one
way of writing a value of that kind.

Everything the engine knows about a domain lives in one descriptor. There is no
second registration mechanism and no privileged built-in path: `length` is
registered through the same `defineKind` a third-party package would call.

## The built-in kinds

These ship in `@smartput/kinds` and are exported as `BUILTIN_KINDS`.

The **Validate** column is the engine-free micro path: a parser, an operation
algebra and an immutable class, none of which needs a registry or `decimal.js`
— see [Validating without the engine](/guide/validating).

| Kind | Canonical | Units | Validate |
| --- | --- | --- | --- |
| `number` | `one` | *(dimensionless)* | `@smartput/number/validate` |
| `percent` | `%` | `%` | `@smartput/percent/validate` |
| `boolean` | *(opaque)* | `bool` — what a [comparison](/guide/comparison) evaluates to, and the one built-in unit nobody types | — |
| `length` | `m` | `mm` `cm` `m` `km` `in` `ft` `yd` `mi` | `@smartput/length/validate` |
| `mass` | `g` | `mg` `g` `kg` `t` `oz` `lb` | `@smartput/mass/validate` |
| `duration` | `s` | `ms` `s` `min` `h` `d` `wk` | `@smartput/duration/validate` |
| `temperature` | `c` | `c` `f` `k` — affine, paired with `tempdelta` | `@smartput/temperature/validate` |
| `tempdelta` | `c` | `c` `f` `k` — the *difference* between two temperatures | `@smartput/temperature/validate` |
| `angle` | `rad` | `rad` `deg` `grad` `turn` | `@smartput/angle/validate` |
| `datasize` | `b` | `b` `kb` `mb` `gb` `tb` `kib` `mib` `gib` `tib` | `@smartput/datasize/validate` |
| `speed` | `mps` | `mps` `kph` `mph` `knot` | `@smartput/speed/validate` |
| `area` | `m2` | `m2` `cm2` `km2` `hectare` `acre` | `@smartput/area/validate` |
| `volume` | `l` | `l` `ml` `m3` `gal` `pint` | `@smartput/volume/validate` |
| `datarate` | `bps` | `bps` `kbps` `mbps` `gbps` `tbps` | `@smartput/datarate/validate` |
| `power` | `w` | `w` `kw` `mw` `gw` `hp` | `@smartput/power/validate` |
| `energy` | `j` | `j` `kj` `mj` `wh` `kwh` `mwh` `cal` `kcal` `btu` | `@smartput/energy/validate` |
| `tempo` | `bpm` | `bpm` `hz` | `@smartput/tempo/validate` |

`datarate` and `energy` are **bridging** kinds — datasize ÷ duration and power ×
duration. Each names its operand kinds by id string, so it depends on neither
side of the bridge: `1 gb / 10 s in mbps` is `800mbps` and `5 kw * 2 h in kwh`
is `10kwh`, and neither `datasize` nor `power` knows the other kind exists.
`boolean` has no words in any language and is the one built-in unit nobody
types — a comparison produces it, and `bool` reaching a user would be a bug.

Two more kinds ship but are **not** in `BUILTIN_KINDS`:

| Kind | Where from | Validate | Why opt-in |
| --- | --- | --- | --- |
| `measure` | `@smartput/kinds` | `@smartput/measure/validate` | Typographic units — `inch` `mm` `cm` `pt` `pc` `px`. Its `mm`/`cm` aliases collide with `length`, so registering it by default would make `10 cm` ambiguous for everyone. Import it by name — and note the micro path has no such conflict: `parseLength` and `parseMeasure` are two functions someone called deliberately. |
| `money` | [`@smartput/rate`](/api/rate) | — | Its unit ratios are not constants — they come from a rate table you inject. The micro path has no engine to inject one into, so there is nowhere for a hard-coded FX table to live that would not be worse than no feature. |
| `datetime` | [`@smartput/datetime`](/guide/datetime) | — | `temporal-polyfill` and `chrono-node` together are several times the size of the engine. An engine that never sees a date should not carry them, and its recognition needs both — nothing on this path applies. |

`duration` lives in `@smartput/kinds` rather than in `@smartput/datetime`
because it is a pure ratio kind — canonical seconds, no calendar.
`30 hours - 10 minutes` needs no Temporal and no timezone. Only `datetime`,
where DST and calendar arithmetic are genuinely hard, pulls the heavy
dependencies.

<SpDuration />

<SpConvert />

## Two value modes

### Ratio kinds

Anything that sits on a ratio line: a table of units with a multiplier onto the
canonical unit.

```ts
type RatioSpec = {
  mode: "ratio";
  canonical: string;                       // "m", "g", "b", "eur"
  units: Record<string, UnitDef | number>; // a bare number is shorthand for { ratio }
  affine?: { deltaKind: KindId };          // Temperature ↔ TempDelta
  dpiUnit?: string;                        // the unit whose ratio reads meta.dpi
};
```

Plain numbers are widened to `Decimal` at registration, so unit tables stay
readable and nothing downstream ever sees a float.

Ratio kinds get `+ - * /` and `in` generated for free. You only write `ops` for
cross-kind cases.

**A ratio does not have to be a constant.** `ratio` may be
`(ctx: EvalCtx) => Decimal`, resolved at conversion time against the context the
engine threads in. That one allowance is what lets `money` read live FX out of
an injected rate table, and `measure`'s `px` read a dpi off `Value.meta`,
without either kind being a special case anywhere in the solver.

### Affine kinds

Temperature is not a ratio kind: 20 °C is not twice 10 °C, and `20 C + 5 C` is
only meaningful if the right operand is a *difference*. So `temperature`
declares `affine: { deltaKind: "tempdelta" }` and the two kinds ship as a pair —
subtracting two temperatures yields a `tempdelta`, and adding a `tempdelta` to a
temperature yields a temperature.

<SpEvaluate
  model-value="30 C - 20 C"
  :examples="['212 F in C', '30 C - 20 C', '20 C + 5 C', '300 k in c']"
  hint="Subtracting two temperatures changes the kind. The result is a difference of 10 degrees, not a reading of 10 degrees." />

### Opaque kinds

For color, datetime, and anything that is not a scalar:

```ts
type OpaqueSpec = {
  mode: "opaque";
  units?: readonly string[];                                // unit ids, no words
  ordered?: boolean;                                        // opt in to < <= > >=
  parse?: (token: string, ctx: EvalCtx) => unknown | null;  // null = not mine
  equals?: (a: unknown, b: unknown) => boolean;
};
```

An opaque unit is a label rather than a position on a ratio line —
[`datetime`](/guide/datetime)'s units are IANA time zones — but it is indexed,
weighted, chosen by the solver and usable as an `in` target like any other. No
ops are generated for an opaque kind, so every operation it supports is an
explicit signature, and recognition of anything not shaped like
`<number><unit-word>` goes through a
[literal matcher](/api/define-kind#literals).

`units` is a list of **ids** and holds no word at all, the same as a ratio
kind's unit keys: the names go in a [`Vocabulary`](/guide/locales), so
`Europe/Kyiv` can be called `kyiv` in one language and `Київ` in another without
the kind knowing either exists.

`ordered` is opt-in rather than a default because an opaque kind's canonical is
whatever that kind chose. `datetime`'s is an instant and orders; `place`'s is a
GeoNames feature id, and `kyiv > warsaw` would have been a confident answer
about nothing.

## The value model

Internally a value is flat, and no class instances are allocated during solving:

```ts
interface Value {
  readonly kind: KindId;
  readonly canonical: Decimal;   // always in the kind's canonical unit
  readonly unit: string;         // the authored unit, drives formatting
  readonly meta?: Readonly<Record<string, unknown>>;
}
```

Two properties follow from this and are worth stating as rules:

**The result keeps the left operand's unit.** `1 kg + 500 g` is `1.5 kilograms`,
not `1500 g`. Arithmetic runs in canonical grams either way; only the display
unit is inherited.

**Nothing rounds mid-expression.** Full `Decimal` precision travels through the
whole AST; rounding happens once, in `format()`.

<SpEvaluate
  model-value="500 g + 1 kg"
  :examples="['1 kg + 500 g', '500 g + 1 kg', '100 g in oz', '3 lbs']"
  hint="Swap the operands and the canonical value is identical — only the unit and the formatted string change." />

## Cross-kind operations

The evaluator knows nothing about dates or speed. Every operation that crosses a
kind boundary is a declared signature:

```ts
type OpSignature = {
  op: "+" | "-" | "*" | "/" | "in";
  left: KindId;
  right: KindId;
  result: KindId;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
};
```

There is deliberately **no general dimensional algebra**. A dimension-vector
engine would be the second-largest subsystem in the library and would earn its
keep only for quantities nobody types into a launcher. Six hand-written
signatures cover speed, area and volume.

An operation with no matching signature is a `DimensionMismatchError`:

<SpEvaluate
  model-value="5 kg + 3 km"
  :examples="['5 kg + 3 km', '5 kg * 2', '2 km / 4']"
  hint="Adding mass to length has no signature, so it fails at solve time with both kinds named." />

## Patching a kind

`extendsKind` merges into an existing kind rather than replacing it — the way
you add units or operations to a built-in without forking it.

```ts
const extraColors = defineKind({
  id: "color-extra",
  extendsKind: "color",
  value: { mode: "ratio", canonical: "#ff0000", units: { "#7f0000": 0.5 } },
});
```

Words are not part of the patch. A kind carries none in any language, so the
names for the new units arrive the same way every other kind's do — as a
`Vocabulary` naming the **base** kind, since that is the id the registry ends
up holding:

```ts
const ukColorNames = defineVocabulary({
  locale: "uk",
  kind: "color",
  units: { "#ff0000": { aliases: ["червоний", "червона"] } },
});

const engine = createEngine({
  kinds: [color, extraColors],
  locales: [composeLocale(ukrainian, [ukColorNames])],
});
```

| Field | Merge rule |
| --- | --- |
| `units`, `literals`, `ops` | merged; the patch wins on key collision |
| `prior`, `format`, `canonical` | replaced when present |
| `value.mode` mismatch | throws at registration, never at parse time |

Registration order is irrelevant. Conflicts surface as `KindConflictError`
naming both sources, at `createEngine()` time — a bad plugin fails on boot, not
on the first keystroke.

## Next

- [Validating without the engine](/guide/validating) — the micro path in the
  table above, at engine-free weight.
- [Defining a kind](/guide/defining-a-kind) — build one interactively.
- [Ambiguity and weights](/guide/weights) — how competing candidates are ranked.
