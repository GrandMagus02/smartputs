---
title: An import that reads the spreadsheet
description: A pasted column of "500 g", "1,5 kg", "2 lbs", "three" — parsed row by row through the micro path, with the failures kept rather than dropped.
---

# An import that reads the spreadsheet

Somebody exported a sheet a colleague kept by hand for four years. The weight
column has `500 g`, `1,5 kg`, `2 lbs`, `16oz`, a blank, and the word `three`.

The usual answer is a CSV importer that accepts a number and a unit dropdown,
which loses the four years. This one reads the column:

<SpPastedColumn />

## One parse per row, no engine anywhere

```ts
import { parseMass } from "@smartput/mass/validate";
import { as } from "@smartput/shared";
import { MASS_UNITS } from "@smartput/mass/units";

const rows = pasted.split("\n").map((line) => line.trim()).filter(Boolean).map((raw) => {
  const parsed = parseMass(raw);
  if (!parsed.ok) return { raw, error: parsed.code };       // keep the text
  const grams = as(MASS_UNITS, parsed, "g");
  // Both: what they wrote, and what you store.
  return { raw, authored: parsed, grams: grams.ok ? grams.value : null };
});
```

About 1.5 KB, no `decimal.js`, no registry, and no `try`. A thousand rows is a
thousand object lookups — this runs in a keystroke, which is why the demo above
reparses the whole textarea on every edit rather than on a button.

## Keep the rows that failed

The single most important line in that snippet is `return { raw, error }`. An
importer that silently drops what it could not read is an importer that loses
data quietly, and the loss surfaces a month later as a total that is wrong by
an amount nobody can account for.

Three states, all visible:

| State | What the row shows | What the import does |
| --- | --- | --- |
| parsed | the value, in the storage unit | imports |
| unreadable | the original text and a sentence | waits for the person |
| empty | nothing | skipped, counted |

And a tally above the table, because "412 of 480 rows ready" is the number the
person actually needs before they press the button.

## The messages are yours

`parseMass("three")` returns `{ ok: false, code: "unknown-unit", input: "three" }`
and never a sentence. The map from the six [`ErrCode`](/api/validate#errcode)
values to English lives in the app — see [Inputs and error
messages](/guide/inputs), which builds exactly that map and reads the unit list
for it off the table so a new unit shows up in the message the same day.

For an importer the wording differs from a form field's: the person is not
fixing their own typing, they are triaging somebody else's file. `Row 38: "three"
is not a mass — expected something like 500 g` beats `Invalid input` by more
here than anywhere else in this collection.

## Decimal commas, and the switch they need

```ts
parseMass("1.5 kg");   // { ok: true, value: 1.5, unit: "kg" }
parseMass("1,5 kg");   // { ok: false, code: "trailing", input: "1,5 kg" }
```

That refusal is deliberate, and a pasted column is exactly where you meet it. A
sheet written in Kyiv or Cologne has commas where yours has points — and
`1,500` is one and a half there and one thousand five hundred here. Telling
those apart needs `Intl` and a locale's number format, which is the engine's
job; a 1.5 KB parser that guessed would be wrong by a factor of a thousand on
somebody's inventory.

A *file*, though, has one convention throughout, and the person who pasted it
knows which. So it is a switch, at the top of the import, applied to the file:

```ts
const normalize = (line: string) => (commaIsDecimal ? line.replace(/,/g, ".") : line);
```

Tick the box in the demo and the `1,5 kg` row turns green. Decide it once for
the file, never per row — a rule that changes between line 40 and line 41 is
the same guess in slower motion. If you would rather not decide at all, the
engine reads locale numbers properly, which is the next section.

## When you do want the engine

Two cases, both real:

- **The cells hold expressions.** `2 x 500 g`, `1 kg + 200 g`. That is
  arithmetic and the micro path does not do arithmetic.
- **The column mixes kinds.** A "size" column holding both `2 kg` and `30 cm`
  needs something that can say which kind each row is, and that is
  `engine.suggest()` per row, with the ambiguous ones queued for a human.

Both cost the engine, and both are worth it for exactly those columns. Do not
pay for it on the four columns that hold one kind each.

## Checklist

- import the one kind's `/validate` subpath, not the `@smartput/kinds` barrel
- parse every row; never drop an unreadable one
- convert once, into the unit the schema stores, with `as`
- show a tally, a per-row state, and the original text for every failure
- decide the number format for the file, not row by row
- keep the authored unit if the value will ever be shown again

## See also

- [`@smartput/shared`](/packages/shared) — the parser and its budget
- [Inputs and error messages](/guide/inputs) — the `ErrCode` map
- [Locales](/guide/locales) — separators, grouping, and what is ambiguous
