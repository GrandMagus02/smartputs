---
title: An estimate field, in 1.5 KB
description: "\"90 min\", \"1.5h\", \"2h + 15m\" — the smallest field in the collection, and the one that does not need an engine."
---

# An estimate field, in 1.5 KB

Every issue tracker has this box. It holds an estimate, or a timer, or a
timeout in a config screen, and what goes in it is one number and one unit.

That field does not need a parser that can read `1 kg + 500 g`, and it should
not pay for one. [The micro path](/packages/shared) is the whole of it:

```ts
import { parseDuration } from "@smartput/duration/validate";

parseDuration("90 min");   // { ok: true, value: 90, unit: "min", raw: "90" }
parseDuration("1.5h");     // { ok: true, value: 1.5, unit: "h",  raw: "1.5" }
parseDuration("soon");     // { ok: false, code: "unknown-unit", input: "soon" }
```

No engine, no registry, no `decimal.js`, and no throw — `Ok | Err`, which is
what lets you call it on every keystroke without a `try`.

<SpValidatedInput kind="duration" hint="One number, one unit. The parse line is
the raw return value: this input has no engine behind it at all." />

## Storing it

Pick a storage unit once and convert on the way in. `as` is the same table's
converter, so the field and the database agree by construction:

```ts
import { as } from "@smartput/shared";
import { DURATION_UNITS } from "@smartput/duration/units";

const parsed = parseDuration(input);
if (parsed.ok) {
  const minutes = as(DURATION_UNITS, parsed, "min");   // Ok<"min">
  issue.estimateMinutes = minutes.ok ? minutes.value : null;
}
```

Store the number **and** the authored unit if the field is going to be shown
again. `90` minutes and `1.5` hours are the same estimate and not the same
sentence, and re-rendering `1.5h` as `90 min` is a small, constant betrayal of
what somebody typed.

## Displaying it back

```ts
import { format } from "@smartput/shared";

format(DURATION_UNITS, { ok: true, value: 90, unit: "min" });   // "90 min"
```

`format` writes the symbol form, not the English noun — that is deliberate. The
plural-aware, locale-aware `"1.5 hours"` comes out of the engine's printer, and
it needs the vocabulary and `Intl.PluralRules` that the 1.5 KB budget exists to
avoid. If your field wants the words, it wants the engine.

## `1h 30m`, and the decision it forces

The micro path reads one quantity. Compound durations are two:

```ts
parseDuration("1h 30m");   // { ok: false, code: "trailing", input: "1h 30m" }
```

The engine reads them as arithmetic, which they are:

```ts
engine.evaluate("1h + 30m").formatted;   // "1.5 hours"
engine.evaluate("1h 30m");               // UnitParseError
```

Two quantities side by side with no operator between them is not addition
*in general* — `10 m 20 s` is a fine way to write a duration and a poor way to
write anything else, and the engine will not guess for you. So if your field
wants `1h 30m`, that is your product's decision to make, in your code, on the
way in:

```ts
// Juxtaposition means addition — a rule this FIELD has, not one the parser has.
const chain = (input: string) => input.replace(/(\d[\d.,]*\s*[a-z]+)\s+(?=[\d.])/gi, "$1 + ");

engine.evaluate(chain("2h 15m")).formatted;   // "2.25 hours"
```

Three lines, and they belong in the component precisely because they are a
guess. Keep the rewritten string visible in the confirmation line, so a person
who typed something the rule mangled can see that it did.

<SpEvaluate
  model-value="1h + 30m"
  :examples="['1h + 30m', '90 min in h', '2 h * 3', '1 wk + 2 d', '30 h - 30 min']"
  hint="This one is the engine, for comparison — the same field once it accepts arithmetic." />

## Which door, again

| The field holds | Use | Cost |
| --- | --- | --- |
| `90 min` | `parseDuration` | ~1.5 KB |
| `90 min`, and you want value objects | [`Duration`](/api/value-classes) | ~2 KB |
| `1h + 30m`, `2h * 3` | `createEngine` | the engine |
| `1h 30m` | `createEngine` + your own rewrite | the engine, plus a rule you own |

The jump from row one to row three is real — the engine brings `decimal.js` and
a registry — and it buys arithmetic, cross-kind conversion and completion. A
timeout box in a settings panel does not need any of that. A time-tracking
input probably does.

## Checklist

- import from `@smartput/duration/validate`, not from the `@smartput/kinds`
  barrel — the barrel holds every kind at once and is for demo pages like this
  one
- validate on blur, not on the first keystroke (see [Inputs](/guide/inputs))
- convert once, with `as`, into a unit the schema names
- keep the authored unit alongside the number
- if you accept `1h 30m`, do the rewrite yourself and show the result

## See also

- [`@smartput/shared`](/packages/shared) — the parser, the algebra, the budget
- [`@smartput/duration`](/packages/duration) — the table these units come from
- [Inputs and error messages](/guide/inputs) — the accessible chrome around it
