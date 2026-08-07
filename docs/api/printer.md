---
title: Printer
description: Render a Program back to text — three modes, a round-trip contract, and a Value formatter.
---

# Printer

```ts
class Printer {
  constructor(cfg: { registry: Registry; locale: Locale; rates?: RateLookup; rounding?: Decimal.Rounding });
  print(program: Program, opts?: PrintOptions): string;
  node(program: Program, id: NodeId, opts?: PrintOptions): string;
  value(v: Value, opts?: FormatOptions): string;
}
```

`@smartput/core/print`. The stage [the pipeline](/guide/pipeline) did not have
before: turning a parsed `Program` back into a string, alongside the job
`formatValue` already did — turning a computed `Value` into one. Two jobs in
one class because both need the same registry and locale.

```ts
import { Printer } from "@smartput/core/print";

const printer = new Printer({ registry, locale: en });
printer.print(program); // program parsed from "1 kg + 500 g" → "1 kg + 500 g"
printer.value(value); // value evaluate() computed → "1.5 kilograms"
```

## print() and node()

`print()` renders the whole `Program`. `node(program, id, opts)` renders the
subtree rooted at one node — same modes, same options — for a caller that
wants one operand's text rather than the whole expression, which is exactly
why every node carries a stable [`NodeId`](/api/stages#parser).

## The three modes

```ts
type PrintMode = "canonical" | "verbatim" | "resolved";
```

| Mode | Reads | Produces | For |
| --- | --- | --- | --- |
| `canonical` | `Program` | normalized units, canonical spacing | round-trip tests, "what we understood" |
| `verbatim` | `Program.input.source` + spans | exactly what the user typed | echoing input, diffing against canonical |
| `resolved` | `Program` + `Resolution` | the solver's chosen units substituted | making ambiguity visible |

```ts
// program parsed from "10 m + 5 min"
const resolution = solver.best(program); // needed only for "resolved"

printer.print(program, { mode: "canonical" }); // "10 m + 5 min"
printer.print(program, { mode: "verbatim" }); // "10 m + 5 min"
printer.print(program, { mode: "resolved", resolution }); // "10 min + 5 min"
```

**`resolved` is the mode that earns the stage.** The engine silently picks
between `m`-as-metres and `m`-as-minutes; every other mode hides that choice.
`10 m + 5 min` — ambiguous on its left operand, unambiguous on its right —
prints as `10 min + 5 min` under `resolved`: the solver read the whole
expression as `duration`, so it substitutes the unit it actually chose for
`m`. `resolved` without a `resolution` throws rather than quietly falling back
to `canonical` — a caller who asked to see the choice made deserves an error,
not a page that silently stopped showing it.

## The round-trip contract

For every input in the corpus, `parse(print(program, { mode: "canonical" }))`
evaluates to the same `Value` — checked by `print/roundtrip.test.ts` over
every row of `packages/core/corpus/en.tsv`. **It holds for `canonical` with
default options only.** `symbols`, `spacing` and `spelled` are excluded from
that guarantee by design, and `roundtrip.test.ts` only ever calls `print` with
none of them set.

A concrete case where `symbols` breaks it: `speed`'s `mps` unit declares the
symbol `"m/s"`, which is indistinguishable from division on reparse. Parsing
`"10 mps"` and printing it back:

```ts
printer.print(program, { mode: "canonical" }); // "10 mps"
printer.print(program, { mode: "canonical", symbols: true }); // "10 m/s"
```

Reparsing `"10 m/s"` does not recover the speed quantity — it reads as a
binary division of `"10 m"` (ambiguous length/duration) by `"1 s"`, a
different `Program` entirely.

## Options

```ts
interface PrintOptions {
  mode?: PrintMode;          // default "canonical"
  resolution?: Resolution;   // required for "resolved"
  unit?: string;              // rebase every quantity of the result kind
  precision?: number;         // significant digits, for a quantity `unit` rebases
  symbols?: boolean;           // "3 m²" vs "3 m2"
  spacing?: "tight" | "normal"; // "10kg+5kg" vs "10 kg + 5 kg"
  spelled?: boolean;           // "thirty degrees plus fifteen degrees"
}
```

### unit

Rebases every quantity of the result kind onto this unit, resolved once per
call through the registry's alias index — a typo fails loudly exactly once,
not silently per node.

```ts
printer.print(program, { mode: "canonical", unit: "cm" });
```

**Limitation, by design:** an ambiguous quantity under `canonical` is never
rebased, even when one of its candidates matches `unit` — with no
`Resolution`, `canonical` genuinely does not know that node's kind, which is
the same reason it echoes the raw surface there instead of an alias. This can
leave a printed line looking mixed-unit:

```ts
// "10 m + 5 km" — "10 m" is ambiguous (length/duration), "5 km" is not
printer.print(program, { mode: "canonical", unit: "cm" });
// "10 m + 500,000 cm" — only the unambiguous operand rebased

printer.print(program, { mode: "resolved", resolution, unit: "cm" });
// "1,000 cm + 500,000 cm" — resolved has a chosen kind for both, so both rebase
```

### precision

Significant digits for a quantity `unit` actually rebases. Before `unit` can
rebase anything, `canonical`/`resolved` reprint the literal the user typed
rather than a number the printer computed, so `precision` has nothing to
apply to — harmless, not an error, on a program `unit` does not touch.

### symbols

"3 m²" rather than "3 m2" — reads the unit's declared `symbol`, falling back
to its first alias when it has none, never inventing one.

```ts
// "3 m2" — area, unambiguous
printer.print(program, { mode: "canonical" }); // "3 m2"
printer.print(program, { mode: "canonical", symbols: true }); // "3 m²"
```

**Limitation, by design:** on an ambiguous node whose candidates share one
symbol as well as one alias table — `temperature` and `tempdelta` register the
identical alias list, decorative degree-signed entries included —
`symbols: true` is inert, because there is no unclaimed spelling left to
reveal which candidate was chosen:

```ts
// "30 C - 20 C" — ambiguous between temperature and tempdelta
printer.print(program, { mode: "resolved", resolution }); // "30 C - 20 C"
printer.print(program, { mode: "resolved", resolution, symbols: true }); // "30 C - 20 C" — unchanged
```

### spacing

`"tight"` squeezes the number-unit gap and the space around a symbolic
operator (`+ - * /`); a keyword operator (`in`, `of`, `off`) always keeps its
surrounding spaces, even under `"tight"` — gluing two words together would
produce a different, unreadable word, not just a differently-spaced one.

```ts
// "1 kg + 500 g"
printer.print(program, { mode: "canonical", spacing: "tight" }); // "1kg+500g"
```

### spelled

"thirty degrees plus fifteen degrees" — reuses the locale's numeral speller
and `UnitLexeme.display`, selecting a plural category from the number printed
beside each unit. Throws if the configured locale declares no speller at all,
the same refusal `resolved` makes for a missing `Resolution` rather than a
silent fallback to digits.

```ts
// "30 deg + 15 deg"
printer.print(program, { mode: "canonical", spelled: true });
// "thirty degrees plus fifteen degrees"
```

An ambiguous quantity under `canonical` is unaffected by `spelled` for the
same reason it is unaffected by `unit`: with no chosen candidate there is no
unit — or plural category — to derive, so the whole quantity is echoed exactly
as typed, digits included.

## verbatim's one honest limitation

`print(program, { mode: "verbatim" })` always reproduces the source exactly —
it returns `program.input.source` directly, whatever normalization did or did
not do to it. `node(program, id, { mode: "verbatim" })` is different: it maps
the node's span back through `NormalizedInput.mapSpan` and slices the source,
which cannot be exact once NFKC has changed the source *at all* — not only
when it changes length; a same-length fold like `"①"` → `"1"` triggers it too
— every span maps to the whole source at that point (see [The pipeline](/guide/pipeline#stage-1-normalizer)),
so there is no single node's text left to return. `node()` throws there rather
than silently handing back the wrong slice:

```ts
// "30 ㎏" — U+338F SQUARE KG, NFKC-folds to "kg" (1 char → 2)
printer.print(program, { mode: "verbatim" }); // "30 ㎏" — exact, whole-program case
printer.node(program, program.root.id, { mode: "verbatim" });
// throws: "verbatim cannot address a single node after NFKC changed the
// source's length"
```
