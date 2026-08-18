---
title: A filter bar that compiles
description: One sentence — "orders over 500 usd last week" — to a parameterised WHERE clause, in SQL or Mongo, with the units and currencies converted on the way.
---

# A filter bar that compiles

The alternative to this is a row of dropdowns: column, operator, value, `+ Add
filter`. It works, it is four interactions per condition, and nobody has ever
enjoyed using one.

<SpQuery />

```ts
q.compile("orders over 500 usd", new SqlCompiler());
// { text: 'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1',
//   params: [50000] }
```

Two things in that output are worth staring at. The clause is
**parameterised** — no value is ever interpolated into the text, so a sentence
cannot become an injection. And the parameter is `50000`, not `500`: the column
declared that it stores cents, and the conversion happened between the reading
and the compiler.

## The schema is where the intelligence is

```ts
const shop = defineSchema({
  tables: [{
    name: "orders",
    aliases: ["order", "purchase", "sale"],
    columns: [
      { name: "total_cents", aliases: ["total", "amount", "price"],
        kind: "money", unit: "usd", scale: 100 },
      { name: "weight_g", aliases: ["weight"], kind: "mass", unit: "g" },
      { name: "placed_at", aliases: ["placed", "ordered"], kind: "datetime" },
      { name: "status", values: ["pending", "paid", "shipped", "cancelled"] },
    ],
  }],
  metrics: [{ name: "revenue", aliases: ["spend"], fn: "sum", column: "orders.total_cents" }],
});
```

`kind` is what lets `orders over 500 usd` find a column nobody named: the
operand reads as money, exactly one column on `orders` is money, so that is the
column. Declaring kinds is worth more than declaring names, and it is the
difference between a filter bar and a search box that mostly fails.

`metrics` are there because nobody types `sum of total_cents`. They type
`revenue`, and the schema is where your product's word for it belongs.

## Everything the field accepts comes from the kinds you registered

```ts
const q = new QueryEngine({ schema: shop, engine });
```

That `engine` is the one you built. Register [`money`](/packages/rate) and the
bar reads `over 500 usd`; register [`dateRange`](/packages/date-range) and it
reads `last week`; leave a kind out and its sentences simply are not in the
grammar. There is no separate query vocabulary to maintain — the filter bar
speaks exactly the language your other inputs already do.

## Two dialects, one reading

```ts
q.compile("orders over 500 eur", new MongoCompiler());
// { collection: "orders",
//   pipeline: [{ $match: { total_cents: { $gt: 55000 } } }],
//   find: { filter: { total_cents: { $gt: 55000 } } } }
```

Everything upstream of the compiler is shared: the parse, the column
resolution, the rate conversion, the ambiguity rules. A dialect is a
`Compiler<T>` and nothing else, which is the useful shape when the same bar has
to drive a Postgres list view and a Mongo-backed export.

## Ranges are half-open, and say so

`last week` is a span, and a span in a `WHERE` clause is two comparisons. The
IR uses `>= start` and `< end` — half-open — so consecutive weeks tile without
overlapping and a row at exactly midnight belongs to one of them rather than
both. That is a decision the compiler makes for you; the reason to know it is
that your own `Compiler` implementation has to keep it.

## Showing the reading

The same rule as every other recipe: put the interpretation on screen.
A filter bar has a natural place for it — chips.

```ts
const ir = q.parse("orders over 500 usd last week");
// one chip per condition: "total > $500.00", "placed_at in 10–16 Aug"
```

Chips are also where a person removes a condition the sentence got wrong, which
a raw `WHERE` clause gives them no way to do.

## What it is not

It is not natural-language-to-SQL in the LLM sense. There is no model, nothing
is guessed, and a sentence outside the grammar is a refusal rather than an
invented query. That is the point: a filter bar that occasionally invents a
join is worse than a dropdown, and this one compiles or says it cannot.

## Checklist

- every column that holds a quantity declares its `kind`, `unit` and `scale`
- product words live in `aliases` and `metrics`, not in the parser
- the compiler's params are bound by the driver — never interpolated
- unreadable sentences fail visibly; the bar never guesses a query
- the parsed conditions are shown as removable chips

## See also

- [`@smartput/query`](/packages/query) — the schema, the IR, both compilers
- [Date field](/guide/examples/date-field) — the same date kinds, one value
- [Money field](/guide/examples/money-field) — the rate table `500 eur` uses
