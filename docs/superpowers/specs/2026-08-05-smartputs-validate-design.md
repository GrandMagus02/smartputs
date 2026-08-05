# smartputs Validate — Design Spec

**Date:** 2026-08-05
**Status:** Approved, pending implementation plan

A second, engine-free entry point into every ratio kind: a byte-minimal
validator, a set of free operation functions, and an immutable value class —
each on its own subpath, each paying only for what it imports.

The engine this extends is specified in `2026-08-04-smartputs-design.md`.
Nothing in the lexer, Pratt parser, solver, evaluator or formatter changes.

## 1. Why this exists

The library today has one door: `createEngine()` → `evaluate("30 deg + 15 deg")`.
That door is the right one for a launcher and the wrong one for an HTML input.
A form that needs to know whether `"30deg"` is a valid angle currently has to
build a registry, a lexer, a Pratt parser and a solver, and pull `decimal.js`,
to answer a yes/no question a regex could answer.

So people write the regex. And then they write a second one for the unit they
forgot, and a conversion that is off by 180/π, and the library has taught them
nothing.

The goal is that reaching for smartputs to validate one angle costs
approximately what reaching for the regex costs, and that having reached for it,
conversion, arithmetic and fuzzy correction are one import away rather than a
rewrite away.

### The three paths, after this spec

| Path | Entry | Numbers | Cost | For |
| --- | --- | --- | --- | --- |
| **Micro — functions** | `@smartput/angle/validate` | JS `number` | ~600 B | HTML inputs, guards, coercion |
| **Micro — class** | `@smartput/angle/class` | JS `number` | ~1.4 KB | app code holding a value |
| **Engine** | `createEngine()` | `Decimal` | engine-weight | expressions, locales, ambiguity |

They interoperate. They are not merged — see §11.

## 2. Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| V1 | Each kind package splits into `units.ts` (table) and `index.ts` (descriptor); the descriptor derives its aliases from the table | One source of truth. The lexicon's display/symbol/typical data — the bulk of the file — never reaches the micro path. |
| V2 | Unit ratios are stored as **decimal strings** | `angle` guards a 30-digit π against float drift. A shared table cannot be floats without breaking that. Micro path does `Number(r)`, engine path does `new Decimal(r)`. |
| V3 | Micro path uses JS `number`, and carries `raw: string` | `decimal.js` is ~30 KB — 50× the entire byte budget. `raw` lets a caller who needs exactness reach for Decimal themselves at zero cost to everyone else. |
| V4 | Free ops return `Ok \| Err` and short-circuit; class methods throw | Two algebras, each idiomatic for its caller. Result-threading through `a.add(b).sub(c)` is miserable; try/catch in a keystroke validation loop is worse. |
| V5 | Fuzzy is an injected `resolve` callback, not a mode | Edit-distance code shakes out entirely when unused. Shipping fuzzy later touches no existing code. |
| V6 | Classes are built by a `createValueClass(table)` factory, not hand-written per kind | Mirrors how core already builds `createFacade`. One implementation, one set of tests. |
| V7 | `toString()` is compact (`"30deg"`), not pretty (`"30 degrees"`) | Round-tripping through `parseAngle` is the micro path's contract. Locale formatting stays engine-side. |
| V8 | Size budgets are enforced by a CI test, not documented | The budget *is* the feature. `check-deps.ts` is the precedent: the repo already enforces a table rather than trusting it. |
| V9 | Micro path is `en` aliases only | Locale vocabulary is an engine concern. Shipping Ukrainian aliases into a 600 B budget is not possible and not wanted. |
| V10 | No DOM type appears anywhere in this spec. Binding an input is deferred to its own spec — see §10 | Kind packages stay usable in Node, Bun and workers, and a DOM test environment plus two framework peer dependencies do not gate the twelve kinds behind them. |
| V11 | Packages gain a build step, `sideEffects: false`, and subpath exports | Packages currently export raw `./src/index.ts`. Every byte claim in this document is unverifiable without this. It is a prerequisite, not a nice-to-have. |

### Rejected

| Rejected | Instead | Why |
| --- | --- | --- |
| One class family shared by micro and engine paths | Two, with a documented bridge | Merging means `Decimal` in the micro bundle, which defeats the entire spec. |
| Build-time codegen of standalone validators | A shared parser + per-kind table | Reaches hand-written byte parity, but adds generated files, a regen step, and drift risk, to save ~200 B. |
| `strict`/`loose` as per-kind declared profiles in `defineKind` | A per-call option | Profile tables would ship with the kind and could not be shaken. |
| `parseAngleStrict` / `parseAngleLoose` as separate exports | One function, one option | Perfect shaking, but doubles the exported surface on twelve kinds. |
| Lazy-getter result objects (`{ get rad(), get deg() }`) | Free `toAngle()` + class `.to()` | Every getter ships whether used or not, and the closure holds the whole ratio table. Unshakeable. |
| Cross-kind ops in the micro path (`length / duration → speed`) | Engine only | Needs a registry and an `OpSignature` table. That is the engine. |
| Locale-aware decimal separators (`30,5deg`) | Engine only | Needs `Intl` and the locale's `numberFormat`. |

## 3. Package layout

One new package:

```
@smartput/validate     parser, ops, class factory, pattern generator. Zero deps.
```

Every ratio kind package gains three subpaths:

```
@smartput/angle              defineKind descriptor          (unchanged)
@smartput/angle/units        UnitTable + unit union type
@smartput/angle/validate     parseAngle, isAngle, addAngle, toAngle, ...
@smartput/angle/class        Angle
@smartput/angle/fuzzy        fuzzy resolver                 (deferred, §9)
```

Plus convenience barrels, documented as *not* the byte-safe default:

```
@smartput/kinds/validate     re-exports every kind's validate surface
@smartput/kinds/class        re-exports every kind's class
```

With `sideEffects: false` and ESM output, a barrel import still shakes
correctly under Rollup/esbuild/Vite. It is called out because it will not shake
under a bundler that gives up on re-exports, and the per-kind subpath always
will.

### Coverage

Twelve kinds across eleven packages:

| Kind | Package | Canonical | Units | Mode |
| --- | --- | --- | --- | --- |
| `number` | `@smartput/number` | `one` | `one` | ratio, unitless — §7.1 |
| `percent` | `@smartput/percent` | `%` | `%` | ratio — §7.2 |
| `length` | `@smartput/length` | `m` | `mm cm m km in ft yd mi` | ratio |
| `mass` | `@smartput/mass` | `g` | `mg g kg t oz lb` | ratio |
| `duration` | `@smartput/duration` | `s` | `ms s min h d wk` | ratio |
| `angle` | `@smartput/angle` | `rad` | `rad deg grad turn` | ratio |
| `datasize` | `@smartput/datasize` | `b` | `b kb mb gb tb kib mib gib tib` | ratio |
| `speed` | `@smartput/speed` | `mps` | `mps kph mph knot` | ratio |
| `area` | `@smartput/area` | `m2` | `m2 cm2 km2 hectare acre` | ratio |
| `volume` | `@smartput/volume` | `l` | `l ml m3 gal pint` | ratio |
| `measure` | `@smartput/measure` | `inch` | `inch mm cm pt pc px` | ratio, dynamic `px` — §7.3 |
| `temperature` | `@smartput/temperature` | `c` | `c f k` | affine — §7.4 |
| `tempdelta` | `@smartput/temperature` | `c` | `c f k` | ratio, pairs with temperature |

Excluded, with reasons:

| Excluded | Why |
| --- | --- |
| `money` (`@smartput/rates`) | Unit ratios come from an injected live rate table. A micro path with no engine has nowhere to inject it, and a stale hard-coded FX table is worse than no feature. |
| `datetime` (`@smartput/datetime`) | Opaque kind. Its "units" are IANA zones and its recognition is `chrono-node`. Nothing here applies. |
| `geo` | Not shipped. |

### A collision that stops existing

`measure` is excluded from `BUILTIN_KINDS` because its `mm`/`cm` aliases collide
with `length`, making `10 cm` ambiguous for every engine consumer.

The micro path has no shared registry. `parseLength("10cm")` and
`parseMeasure("10cm")` are two functions that were called deliberately, and
neither is ambiguous. So `measure` is a first-class citizen here with no opt-in
caveat — one of the few places where having less machinery gives a better
answer.

## 4. The data layer

### `units.ts`

```ts
// packages/angle/src/units.ts
import type { UnitTable } from "@smartput/validate";

export type AngleUnit = "rad" | "deg" | "grad" | "turn";

export const ANGLE_UNITS: UnitTable<AngleUnit> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    grad: "0.0157079632679489661923132169164",
    turn: "6.28318530717958647692528676656",
  },
  alias: {
    rad: "rad", radian: "rad", radians: "rad",
    deg: "deg", degree: "deg", degrees: "deg",
    grad: "grad", gradian: "grad", gradians: "grad", gon: "grad",
    turn: "turn", turns: "turn", rev: "turn", revolution: "turn",
  },
};
```

Ratios are strings (V2). The π-derived values are written to 30 significant
digits, matching the literal `angle/index.ts` guards today; `Number()` truncates
to double precision on the micro side and `new Decimal()` keeps all of it on the
engine side.

`alias` is a flat lowercase map, not a per-unit array — it is the shape the
parser actually reads, so no runtime inversion is needed and no inversion code
ships.

### `index.ts` derives from `units.ts`

The descriptor keeps everything the micro path does not want — `symbol`,
`display`, `typical`, `ops` — and stops hand-writing its alias arrays:

```ts
import { ANGLE_UNITS } from "./units";

export const angle = defineKind({
  id: "angle",
  value: {
    mode: "ratio",
    canonical: ANGLE_UNITS.canonical,
    units: decimalRatios(ANGLE_UNITS),          // Record<U, Decimal>
  },
  lexicon: {
    rad: { aliases: aliasesFor(ANGLE_UNITS, "rad"), symbol: "rad",
           display: { one: "radian", other: "radians" }, typical: [0.1, 7] },
    // ...
  },
});
```

`decimalRatios` and `aliasesFor` are two small helpers exported from
`@smartput/core` (not from `@smartput/validate` — core must not depend on it).
They run once, at descriptor construction, on the engine path only.

**Drift is now impossible in the direction that matters.** A unit added to
`units.ts` is immediately parseable by both paths. A unit added only to the
lexicon fails a contract test (§12).

**Plural aliases are new.** Today's lexicons list `["deg", "degree"]` and rely
on the locale analyzer's suffix stripper to reach `degrees`. The micro path has
no analyzer, so plurals are enumerated in `units.ts`. The engine path gains them
too, which is harmless — the analyzer already produced the same lemma.

## 5. The parser

```ts
// @smartput/validate

type Ok<U extends string> = {
  readonly ok: true;
  readonly value: number;
  readonly unit: U;
  readonly raw: string;      // the number as authored, for Decimal handoff
};

type ErrCode =
  | "empty"          // "" or whitespace only
  | "nan"            // no number found
  | "missing-unit"   // number parsed, no unit, no defaultUnit
  | "unknown-unit"   // unit word is not an alias
  | "wrong-unit"     // opts.unit was set and the input disagreed
  | "trailing";      // input continued past the unit

type Err = { readonly ok: false; readonly code: ErrCode; readonly input: string };

type Parsed<U extends string> = Ok<U> | Err;

type Ctx = { readonly dpi?: number };

interface UnitTable<U extends string> {
  readonly canonical: U;
  readonly ratio: Readonly<Record<U, string | ((ctx: Ctx) => number)>>;
  readonly offset?: Readonly<Partial<Record<U, string>>>;
  readonly alias: Readonly<Record<string, U>>;
}

interface ParseOptions<U extends string> {
  mode?: "strict" | "loose";                              // default "loose"
  unit?: U;                                               // require this unit
  defaultUnit?: U;                                        // bare number lands here
  ctx?: Ctx;                                              // dpi for measure
  resolve?: (word: string, t: UnitTable<U>) => U | undefined;
}

function parse<U extends string>(t: UnitTable<U>, input: string, opts?: ParseOptions<U>): Parsed<U>;
```

### Grammar

```
value  := ws? sign? digits ("." digits)? exponent? ws? unit? ws?
sign   := "+" | "-"
digits := [0-9]+
exponent := ("e" | "E") sign? digits
unit   := [a-zA-Z%°²³]+ | "%"
```

No thousands separators, no locale decimal comma, no expressions. Those are the
engine's job and saying so is cheaper than half-supporting them.

### `strict` vs `loose`

The complete difference:

| Input | `strict` | `loose` | Note |
| --- | --- | --- | --- |
| `30deg` | ok | ok | |
| `30 deg` | ok | ok | inner space always allowed |
| `-30.5deg`, `+30deg`, `1e3deg` | ok | ok | |
| `  30deg  ` | `trailing` | ok | loose trims |
| `30DEG`, `30Deg` | `unknown-unit` | ok | loose lowercases |
| `30` | `missing-unit` | ok iff `defaultUnit` set, else `missing-unit` | |
| `30,5deg` | `nan` | `nan` | locale decimals are engine-only |
| `30smth` | `unknown-unit` | `unknown-unit` | |
| `30 deg extra` | `trailing` | `trailing` | |
| `` / `   ` | `empty` | `empty` | |

`strict` is `loose` minus `trim()` minus `toLowerCase()` minus the bare-number
fallback. About thirty bytes of difference, and a meaningful contract: `strict`
accepts exactly what `toString()` and `format()` emit, so a round-trip test is a
real test.

`opts.unit` is orthogonal to mode: it turns any other valid unit into
`wrong-unit`. `parseAngle(v, { unit: "deg" })` is the "this field is in degrees"
case.

### Convenience

```ts
function is<U extends string>(t: UnitTable<U>, input: string, opts?: ParseOptions<U>): boolean;
function patternFor<U extends string>(t: UnitTable<U>, opts?: { mode?: "strict" | "loose" }): string;
```

`is` is `parse(...).ok` and exists so the common case reads as a predicate.

`patternFor` emits an HTML `pattern` attribute value covering the same grammar —
native validation as a no-JS fallback, and a free `inputmode` hint. It is a
separate export so a caller who never renders a form does not ship a regex
builder.

## 6. Operations

```ts
type Input<U extends string> = string | Ok<U>;

function add<U>(t: UnitTable<U>, a: Input<U>, b: Input<U>, opts?): Parsed<U>;
function sub<U>(t: UnitTable<U>, a: Input<U>, b: Input<U>, opts?): Parsed<U>;
function scale<U>(t: UnitTable<U>, a: Input<U>, factor: number, opts?): Parsed<U>;
function negate<U>(t: UnitTable<U>, a: Input<U>, opts?): Parsed<U>;
function convert<U>(t: UnitTable<U>, a: Input<U>, to: U, opts?): number | undefined;
function as<U>(t: UnitTable<U>, a: Input<U>, to: U, opts?): Parsed<U>;
function equals<U>(t: UnitTable<U>, a: Input<U>, b: Input<U>, epsilon?: number, opts?): boolean;
function compare<U>(t: UnitTable<U>, a: Input<U>, b: Input<U>, opts?): -1 | 0 | 1 | undefined;
function format<U>(t: UnitTable<U>, a: Ok<U>): string;
```

Behaviour:

- **Left operand's unit wins.** `add(T, "1kg", "500g")` is `1.5 kg`, matching the
  engine's documented rule. Arithmetic runs in canonical units either way.
- **Strings are accepted** and parsed internally. `addAngle("30deg", "15deg")`
  works without a prior parse. Importing an op therefore pulls `parse`;
  importing only `parse` does not pull the ops.
- **Errors short-circuit** (V4). `if (!a.ok) return a`. The first failure wins
  and carries its own `input`, so the message names the operand that broke.
- **`compare` and `convert` return `undefined`** on bad input rather than a
  sentinel number. `equals` returns `false`. These three cannot return `Err`
  without changing their useful return type, and `undefined` is honest.
- **No cross-kind ops.** `length / duration` does not produce a speed here.

Each kind re-exports thin arrow wrappers — no factory closures, so nothing needs
`/*#__PURE__*/` and nothing is retained by accident:

```ts
// packages/angle/src/validate.ts
import { add, is, parse, convert, /* ... */ } from "@smartput/validate";
import { ANGLE_UNITS, type AngleUnit } from "./units";

export type { AngleUnit };
export { ANGLE_UNITS };

export const parseAngle = (s: string, o?: ParseOptions<AngleUnit>) => parse(ANGLE_UNITS, s, o);
export const isAngle    = (s: string, o?: ParseOptions<AngleUnit>) => is(ANGLE_UNITS, s, o);
export const addAngle   = (a: Input<AngleUnit>, b: Input<AngleUnit>) => add(ANGLE_UNITS, a, b);
export const toAngle    = (a: Input<AngleUnit>, u: AngleUnit) => convert(ANGLE_UNITS, a, u);
// sub, scale, negate, as, equals, compare, format, patternFor — same shape
```

Naming is uniform across kinds: `parseX`, `isX`, `addX`, `subX`, `scaleX`,
`negateX`, `toX`, `asX`, `equalsX`, `compareX`, `formatX`, `patternForX`.

## 7. Per-kind specifics

### 7.1 `number` — the unitless kind

`number` has one unit, `one`, with no aliases. So:

```ts
parseNumber("30")      // { ok:true, value:30, unit:"one", raw:"30" }
parseNumber("30kg")    // { ok:false, code:"unknown-unit" }
```

`defaultUnit: "one"` is baked into the wrapper, so a bare number parses in both
modes and `missing-unit` is unreachable for this kind. This is the `<input
type="number">` case and it should be the smallest entry in the whole library.

### 7.2 `percent`

One unit, `%`, ratio `0.01`, aliases `%`, `percent`, `pct`.

```ts
parsePercent("20%")            // { ok:true, value:20, unit:"%", raw:"20" }
toPercent(parsePercent("20%")) // 20 — value in its own unit
```

Canonical here is the plain ratio (`20%` is `0.2` canonically), matching the
engine. `formatPercent` emits `"20%"`.

`20% of 50` is an `OpSignature` and stays engine-only.

### 7.3 `measure` — dynamic `px`

`px` has no constant ratio: it is `1/dpi`, and the engine reads `dpi` off
`Value.meta`. The micro path has no `meta`, so `ratio` accepts a function and the
context arrives through options:

```ts
ratio: {
  inch: "1",
  mm: "0.03937007874015748031496062992126",
  cm: "0.39370078740157480314960629921260",
  pt: "0.01388888888888888888888888888889",
  pc: "0.16666666666666666666666666666667",
  px: (ctx) => 1 / (ctx.dpi ?? 96),
}
```

```ts
parseMeasure("10px")                       // ok — 96 dpi assumed
toMeasure("10px", "mm", { ctx: { dpi: 144 } })   // 1.7638...
```

The `typeof r === "function"` branch costs about fifteen bytes and is paid by
every kind. Accepted: it is the difference between `measure` working and
`measure` being a second exclusion.

`measure` and `length` both define `mm` and `cm` and that is fine here — see §3.

### 7.4 `temperature` and `tempdelta` — affine

`temperature` declares `offset`. Conversion is `(v + offsetFrom) * ratioFrom /
ratioTo - offsetTo`, in that order, matching core:

```ts
// temperature
ratio:  { c: "1", f: "0.55555555555555555556", k: "1" }
offset: { f: "-32", k: "-273.15" }
```

The class factory reads `table.offset`. When present it **omits** `add`, `sub`,
`scale` and `negate`, and **adds** `diff` — the same rule `createFacade` already
applies, for the same reason: `20°C × 2` has no meaning.

```ts
Temperature.parse("30c").diff(Temperature.parse("20c"))  // TempDelta 10c
TempDelta.parse("10c").add(TempDelta.parse("5c"))        // TempDelta 15c
Temperature.parse("30c").add(TempDelta.parse("5c"))      // Temperature 35c
```

`temperature.add(TempDelta)` is the one exception to the omission: the factory
takes an optional `delta` binding, and `@smartput/temperature/class` wires the
two classes to each other. Both live in the same package, so there is no
circular import.

Free ops mirror this: `@smartput/temperature/validate` exports
`diffTemperature` but no `addTemperature`, and a full ratio op set for
`tempdelta`.

Aliases include `°c`, `°f` and bare `c`/`f`/`k`, since `30°C` is the form people
type.

### 7.5 Derived kinds — `speed`, `area`, `volume`

Ordinary ratio tables here. Their `OpSignature`s (`length / duration → speed`,
`length * length → area`, `area * length → volume`) are engine-only.

`m2`, `cm2`, `km2`, `m3` gain `m²`, `cm²`, `km²`, `m³` aliases so the symbol
forms round-trip.

## 8. Classes

```ts
import { Angle } from "@smartput/angle/class";

const a = Angle.parse("30deg");
const b = a.add(new Angle(30, "deg"));

a.toString();   // "30deg"  — a is untouched
b.toString();   // "60deg"
b.to("rad");    // 1.0471975511965976
b.as("rad");    // Angle { value: 1.0471975511965976, unit: "rad" }
a < b;          // true — valueOf() returns the canonical magnitude
```

### Surface

```ts
interface ValueClass<U extends string, V> {
  new (value: number | string, unit: U): V;
  parse(input: string, opts?: ParseOptions<U>): V;        // throws ValidationError
  tryParse(input: string, opts?: ParseOptions<U>): V | Err;
  from(input: string | Ok<U> | V): V;                     // throws ValidationError
  readonly kind: string;
  readonly canonical: U;
  readonly units: readonly U[];
}

interface Value<U extends string, V> {
  readonly value: number;
  readonly unit: U;

  to(unit: U): number;
  as(unit: U): V;

  add(other: string | Ok<U> | V): V;      // ratio kinds only
  sub(other: string | Ok<U> | V): V;      // ratio kinds only
  scale(factor: number): V;               // ratio kinds only
  negate(): V;                            // ratio kinds only
  diff(other: string | Ok<U> | V): Delta; // affine kinds only

  equals(other: string | Ok<U> | V, epsilon?: number): boolean;
  compare(other: string | Ok<U> | V): -1 | 0 | 1;

  toString(): string;                     // "30deg"
  toJSON(): { value: number; unit: U };
  valueOf(): number;                       // canonical magnitude
}
```

Which methods exist is decided by the table, exactly as `createFacade` does it
today. A `Temperature` has no `.add(Temperature)` and no `.scale()`; a
`Measure` additionally takes a `dpi` in its constructor options and exposes
`.withDpi(n)`.

### Immutability

- `Object.freeze(this)` at the end of the constructor.
- `value` and `unit` are own frozen properties; `readonly` in TS *and* frozen at
  runtime, because a `readonly` that only exists at compile time is a comment.
- Every method returns a new instance. No method returns `this`.
- Enforced by test, not convention: a shared suite asserts `Object.isFrozen`,
  asserts that mutation throws in strict mode, and asserts identity inequality
  for every returned instance.

### Errors

Class methods **throw** `ValidationError` (V4), a subclass of `SmartputError`
carrying `code: ErrCode` and `input: string` so a `catch` block can branch
without string matching. `tryParse` is the escape hatch for callers who want the
`Err`.

`SmartputError` lives in `@smartput/core`, which the micro path must not import.
So `ValidationError` is defined in `@smartput/validate` with the same
`name`/`code`/`input` shape, and core re-exports a type-only alias. Two classes,
one contract, no dependency — stated here so nobody "fixes" it later.

### Construction

```ts
export const Angle = /*#__PURE__*/ createValueClass(ANGLE_UNITS, "angle");
```

One factory call per kind (V6). The `/*#__PURE__*/` annotation is what lets an
unused kind's class drop out of a barrel import.

## 9. Fuzzy resolution

Not in this round. The seam is:

```ts
resolve?: (word: string, t: UnitTable<U>) => U | undefined;
```

`parse` calls it only after its own alias lookup misses, so the happy path pays
nothing and an absent `resolve` is one `undefined` check.

Later:

```ts
import { fuzzy } from "@smartput/angle/fuzzy";
parseAngle("30d", { resolve: fuzzy });   // { ok:true, value:30, unit:"deg" }
```

A generic `fuzzy` in `@smartput/validate` (bounded Damerau-Levenshtein over
`Object.keys(t.alias)`, threshold by alias length) covers every kind, and a kind
may ship its own if its aliases need special handling. Nothing in this spec's
implementation changes when it lands.

The class surface gets it through `ParseOptions` on `parse`/`tryParse`. It is
deliberately not available on `new Angle(...)` — a constructor that
approximately understands its arguments is a bad constructor.

## 10. DOM binding — deferred to its own spec

`@smartput/input` — a `bindInput(el, parseAngle, opts)` helper over the
Constraint Validation API, plus React and Vue adapters — is **out of scope
here** and gets its own spec.

Deferred rather than dropped, and the reason is that it is a different kind of
work. Everything else in this document is byte-counting and table-driven
rollout, verifiable with `bun test`. A DOM binding needs a DOM test environment,
`setCustomValidity` semantics across browsers, and two framework peer
dependencies with their own version matrices. Bundling that into this spec would
mean its phase gates the twelve kinds behind it.

What this spec ships so that binding stays a thin layer later, with no
redesign:

| Provided here | What the later spec builds on it |
| --- | --- |
| `Err.code` — a stable `ErrCode`, not a string | maps to a message without parsing English |
| `Err.input` — the offending text | quotes the input in that message |
| `patternFor(table)` | `pattern` attribute for no-JS native validation, plus an `inputmode` hint |
| `format(t, ok)` — the compact canonical form | coerce-on-blur rewrites `el.value` to it |
| `parseX` returning a `Result`, never throwing | safe to call on every keystroke |

No DOM type appears in any package this spec touches, so a kind package stays
usable in Node, Bun and workers regardless of what the later spec decides.

## 11. Two class families

| | `@smartput/angle/class` → `Angle` | `createFacades()` → `Quantity` |
| --- | --- | --- |
| numbers | JS `number` | `Decimal` |
| `toString()` | `"30deg"` | `"30 degrees"`, locale-aware |
| cross-kind ops | none | via registry + `OpSignature` |
| locale | none | full |
| errors | throws `ValidationError` | throws `SmartputError` subclasses |
| cost | ~1.4 KB | engine-weight |

Not merged, deliberately (see Rejected). They interoperate in both directions:

```ts
Angle.from(quantity)                // Quantity has .value/.unit; Decimal → number
Angle.from(parseAngle("30deg"))     // Ok<U> is a valid input
Quantity.from(angle)                // Angle satisfies QuantityInput
```

`QuantitySnapshot.value` widens from `string` to `string | number` to make the
second line type-check. That is the only change to an existing public type in
this spec.

**Precision boundary, stated plainly:** crossing from `Quantity` to `Angle`
narrows `Decimal` to a double and can lose digits. `Ok.raw` exists so the
reverse crossing is lossless. Documented at both call sites.

## 12. Testing

**Per-kind corpus.** A table-driven suite, one file per kind, listing valid and
invalid inputs with their expected `ErrCode`. Generated from a shared harness so
adding a kind is adding a table. The `en` corpus in `packages/core/corpus` is
the precedent.

**Round-trip property.** For every kind and every unit,
`parse(format(parse(s))) ≡ parse(s)`, in `strict` mode. This is what makes V7's
"compact `toString`" a contract rather than a preference.

**Conversion identity.** For every kind and every pair of units,
`to(to(v, a), b)` returns to within `1e-9` relative of `v`. Catches a transposed
ratio in any of the twelve tables.

**Cross-path agreement.** For every kind, a sample of inputs must produce the
same canonical magnitude through the micro path and through `createEngine()`,
within double precision. This is the test that would have caught a `units.ts`
that drifted from its descriptor — and the reason V1's derivation direction
matters.

**Contract test.** For every package exporting a kind: `units.ts` and the
descriptor's `units` have identical key sets; every lexicon alias appears in
`alias`; every `alias` value is a real unit. Extends
`packages/kinds/src/surface.test.ts`.

**Immutability suite.** Shared, run against every class (§8).

**Size budget.** §13.

## 13. Build and size budgets

### Build

Prerequisite work (V11), and the first tasks in the plan:

1. Per-package build — `bun build` to ESM, `tsc --emitDeclarationOnly` for types.
2. `"sideEffects": false` on every package.
3. `exports` maps with `./units`, `./validate`, `./class` (and later `./fuzzy`).
4. `scripts/check-deps.ts` extended: every package exporting a ratio kind must
   declare all three subpaths, and `@smartput/validate` must have zero
   dependencies.

The dependency table `check-deps.ts` enforces gains two rows. Every kind package
adds `@smartput/validate` alongside `@smartput/core` — `units.ts` imports
`UnitTable` as a **type only**, but `validate.ts` and `class.ts` import its
functions at runtime, so it is a real dependency and must be declared:

| Package | Runtime dependencies |
| --- | --- |
| `validate` | none |
| `<kind>` | `@smartput/core`, `@smartput/validate` |

The standing target — **`@smartput/core` ships one runtime dependency** — is
untouched. Core does not import `@smartput/validate`; the dependency runs the
other way.

### Budgets

`scripts/check-size.ts` builds each entry with `bun build --minify`, measures
raw and gzip, and fails on exceeding budget. Wired into `bun run check`.

The shared parser is paid once; per-kind cost is the table. Rough model:
~40 B per unit plus ~20 B per alias, minified.

| Entry | Minified | Gzip |
| --- | --- | --- |
| `@smartput/number/validate` — `parseNumber` only | < 350 B | < 220 B |
| `@smartput/angle/validate` — `parseAngle` only | < 600 B | < 350 B |
| `@smartput/angle/validate` — `+ addAngle`, `toAngle` | < 900 B | < 500 B |
| `@smartput/angle/class` | < 1.4 KB | < 700 B |
| `@smartput/datasize/validate` (9 units, widest table) | < 800 B | < 450 B |
| each additional kind at the same entry | < 400 B | < 250 B |

**These numbers are budgets, not measurements.** The first implementation task
after the build lands is to measure the real figures and commit them; if a
budget proves wrong, the spec is amended with the measured value and the reason,
not quietly raised. A budget nobody can hit was a bad budget; a budget that
drifts upward silently is a broken feature.

### The honest comparison

A hand-written single-unit check is about 40 bytes:

```js
const isAngle = (s) => /^-?\d+(\.\d+)?deg$/.test(s);
```

`parseAngle` will not match that, and this spec does not claim it will. What
600 bytes buys over 40: four units instead of one, aliases and plurals, a typed
error code instead of `false`, exponent and sign handling, `strict`/`loose`,
`opts.unit`, and a conversion, arithmetic, class and fuzzy path that are each one
import away rather than a rewrite away.

The claim is that 600 bytes is *close enough to free* that nobody reaches for the
regex — not that the regex was beaten on bytes.

## 14. Phasing

Twelve kinds is too much to land at once. The plan runs in three phases, and
each one is independently shippable and independently verifiable.

| Phase | Scope | Done when |
| --- | --- | --- |
| **P1 — Build** | Per-package build, `sideEffects: false`, subpath exports, `check-size.ts`, extended `check-deps.ts`. No new features. | `bun run check` passes and reports a measured byte figure for one existing entry. |
| **P2 — Seam** | `@smartput/validate` in full: parser, ops, `createValueClass`, `patternFor`, `ValidationError`. `angle` as the sole consumer — `units.ts`, derived descriptor, `validate.ts`, `class.ts`. | Every test class in §12 passes for `angle`, and the §13 budgets for angle are measured and committed. |
| **P3 — Rollout** | The other eleven kinds. Mechanical: a table, a derived descriptor, two wrappers, a corpus. `measure`'s dynamic `px` and `temperature`/`tempdelta`'s affine pairing are the only two that are not copy-shaped. | Contract, round-trip, conversion-identity and cross-path tests pass for all twelve. Barrels exported from `@smartput/kinds`. |

P3 is the last phase here. DOM binding is §10's own spec and nothing in P1–P3
waits on it.

P2 is where the invention is. If the shared parser cannot hit the angle budget,
that is discovered against one kind rather than twelve, and §13's amendment rule
applies before the rollout multiplies the cost.

Fuzzy resolution (§9) is unscheduled. Its seam lands in P2 so that it stays a
pure addition whenever it comes.

## 15. Documentation

- `docs/guide/validating.md` — the micro path, the three-door table, when to use
  which.
- `docs/api/validate.md` — full `@smartput/validate` surface, `patternFor` included.
- `docs/api/value-classes.md` — the class surface and the `Quantity` bridge.
- `docs/guide/kinds.md` — a validate column in the kinds table.
- `docs/guide/roadmap.md` — a milestone row for this work.

## 16. Out of scope

DOM binding, `bindInput`, and the React and Vue adapters — deferred to their own
spec, with the seams they need listed in §10. Money and datetime validators
(§3). Non-English aliases (V9). Locale decimal separators. Expressions of any
kind — `"30deg + 15deg"` as a *string* is the engine's job;
`addAngle("30deg", "15deg")` is this spec's. Number words (`"thirty deg"`).
Ranges (`"10-20deg"`). Compound units (`"5ft 3in"`). Async anything. Fuzzy
resolution ships later against the seam in §9.
