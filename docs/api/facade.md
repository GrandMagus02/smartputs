---
title: createFacade
description: Generated Quantity classes — a typed object surface over the same registry.
---

# createFacade / createFacades

Not every caller wants to parse a string. When you already know you are holding
a mass, a `Quantity` class is a better surface than an expression: typed
arithmetic, conversion, comparison and JSON, with no parser in the way.

```ts
import { createFacades } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";

// Keys are kind ids, so the classes are conventionally renamed on the way out.
const { mass: Mass, temperature: Temperature } = createFacades({
  kinds: BUILTIN_KINDS,
  locale: en,
});

const m = new Mass(1.5, "kg");

m.toString();               // "1.5 kilograms"
m.to("g").toString();       // "1500"        — a Decimal, not a Quantity
m.as("g").toString();       // "1,500 grams" — a Quantity in the new unit
m.add(new Mass(500, "g"));  // 2 kilograms
m.equals("1500 g");         // true
JSON.stringify(m);          // {"value":"1.5","unit":"kg"}

new Temperature(30, "c").diff(new Temperature(20, "c")).toString(); // "10°C", a tempdelta
```

One class per registered kind, all sharing a single registry, so a cross-kind
result lands in the right class: subtracting two temperatures returns a
`tempdelta` quantity, not a temperature.

## createFacades()

```ts
function createFacades(args: {
  kinds: Kind[];
  locale: Locale;
  rates?: RateLookup;
}): Record<KindId, QuantityClass>
```

Builds every class in one pass. Registration order does not matter: an affine
kind's `add`/`diff` look up their delta kind's class inside a closure that runs
when the method is *called*, by which time every class exists.

Pass `rates` for a money-shaped kind, whose unit ratios are functions rather
than constants. Without it the class builds fine and then throws
`MissingRateError` the first time an operation has to convert.

## createFacade()

```ts
function createFacade(args: {
  kind: NormalizedKind;
  registry: Registry;
  locale: Locale;
  deltaFacades?: Map<KindId, QuantityClass>;
  rates?: RateLookup;
}): QuantityClass
```

The single-kind form, taking an already-normalized kind and registry.
`createFacades` is the entry point unless you are building the registry
yourself.

## Quantity

```ts
interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly dpi?: number | undefined;

  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): QuantitySnapshot;

  /** Ratio kinds only; absent on an affine kind. */
  add?(other: QuantityInput): Quantity;
  sub?(other: QuantityInput): Quantity;
  scale?(factor: Decimal | number | string): Quantity;
  negate?(): Quantity;

  /** Affine kinds only. */
  diff?(other: QuantityInput): Quantity;

  /** Only on a kind that declares `dpiUnit`. */
  withDpi?(dpi: number): Quantity;
}
```

The optional members are the whole point of the shape. Temperature has no `add`
— adding two readings is meaningless — and has `diff`, which returns a
`tempdelta`. A kind that does not declare `dpiUnit` has neither `withDpi()` nor
a `dpi` getter, so a money quantity cannot grow a dpi that nothing reads.

Instances are frozen. Every operation returns a new quantity.

## QuantityClass

```ts
interface QuantityClass {
  new (
    value: Decimal | number | string,
    unit: string,
    meta?: Record<string, unknown>,
  ): Quantity;
  from(input: QuantityInput): Quantity;
  parse(text: string): Quantity;
  readonly kindId: KindId;
}

type QuantityInput = Quantity | QuantitySnapshot | number | string;

interface QuantitySnapshot {
  readonly value: string | number;  // toJSON emits a decimal string; a
                                    // micro-path ValueInstance carries a double
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}
```

`from()` accepts anything a caller is likely to be holding: another quantity of
the same kind, a `toJSON()` snapshot, a bare number (read as the canonical
unit), or a string (parsed).

`parse()` reads the facade's own vocabulary — the registry's alias index for
this kind, plus each unit's symbol and plural display forms. That is what makes
`X.parse(x.toString())` a round trip rather than a coincidence:

```ts
Mass.parse("1.5 kilograms"); // 1.5 kg
Mass.parse("1,500 g");       // 1500 g — locale group symbol included
```

The number is split from the unit using the *locale's* group and decimal
symbols, so a locale that groups with U+202F reads its own output back.

::: warning Two limits worth knowing
`Money.parse(new Money(30, "usd").toString())` throws: `toString()` produces
`"$30.00"` and a leading `$` is not something the parser takes. See
[the money guide](/guide/money#known-limitation).

`combine`-style arithmetic on the facade converts silently. `Quantity` has no
assumption channel, so a facade-level `add` across two currencies derives a
cross rate without recording it — the engine path
[discloses this correctly](/guide/money#cross-rates-are-never-silent); the
facade cannot.
:::

## Measurement with dpi

`measure` is the one kind whose unit ratio depends on `Value.meta`, and it
declares `dpiUnit: "px"` to say so. That declaration — not inference — is what
gives its quantities the dpi surface:

```ts
import { createFacades } from "@smartput/core";
import { measure } from "@smartput/kinds";

const { measure: Measure } = createFacades({ kinds: [measure], locale: en });

const px = new Measure(96, "px", { dpi: 96 });

px.dpi;                            // 96
px.to("inch").toString();          // "1"
px.withDpi(300).to("inch").toString(); // "0.32"
```

## See also

- [Kinds and units](/guide/kinds) — the `Value` model underneath.
- [`@smartput/rates`](/api/rates) — the `rates` argument.
