---
title: "@smartput/query"
description: "A sentence to a database query, in SQL or Mongo."
---

# @smartput/query

`QueryEngine` reads a schema and a phrase; the dialect compilers are
separate subpaths so a Postgres app never bundles the Mongo one. The grammar
knows about ranges, places and units because it reads the same kinds the engine
does.

## Try it

<SpQuery />

`@smartput/query` turns a sentence into a database query. Not by asking a model,
and not by pattern-matching whole sentences: it owns a clause grammar, and it
reads every *value* inside that grammar through an engine you built.

```
orders over 500 usd
customers signed up last week
top 10 customers by revenue last month
shipments within 50 km of kyiv
```

The value half of each of those is already solved elsewhere in this repo.
`500 usd` is [money](/packages/rate), `last week` is a [range](/packages/range-core),
`50 km` is a length and `kyiv` is a [place](/packages/geo). What this package
adds is the two things no engine can know, because they are facts about your
schema rather than about English: **which column was meant**, and **what that
column stores**.

## What it is not

It refuses more than it accepts, deliberately. There is no correlated subquery,
no set difference, no nested aggregation and no memory of the previous sentence.
Those throw `UnsupportedQueryError` with the construct named, so a host can hand
that same string to a language model and know exactly why.

The trade is the one a rules-only parser can actually win: it is deterministic,
it runs offline in under a millisecond, it never invents a column, and — because
every value leaves through a bound parameter — it cannot be injected into.

## A schema

A schema is a declaration, and the interesting field is `kind`.

```ts
import { defineSchema } from "@smartput/query";

const shop = defineSchema({
  tables: [
    {
      name: "orders",
      aliases: ["order", "purchase", "sale"],
      key: "id",
      columns: [
        { name: "id" },
        { name: "customer_id" },
        // Stored in cents. `unit` names something the engine knows, and
        // `scale` says how many of those one stored number is worth.
        { name: "total_cents", aliases: ["total", "amount", "price"],
          kind: "money", unit: "usd", scale: 100 },
        { name: "weight_g", aliases: ["weight"], kind: "mass", unit: "g" },
        { name: "placed_at", aliases: ["placed", "ordered"], kind: "datetime" },
        // No kind at all: the words are yours, not the language's.
        { name: "status", values: ["pending", "paid", "shipped", "cancelled"] },
      ],
    },
    {
      name: "customers",
      aliases: ["customer", "client"],
      key: "id",
      labels: ["name"],
      columns: [
        { name: "id" },
        { name: "name" },
        { name: "email" },
        { name: "country_code", aliases: ["country"], kind: "place" },
        { name: "created_at", aliases: ["signed up", "joined"], kind: "datetime" },
      ],
    },
  ],
  joins: [{ from: "orders.customer_id", to: "customers.id" }],
  metrics: [
    { name: "revenue", aliases: ["spend"], fn: "sum", column: "orders.total_cents" },
  ],
});
```

`kind` is a smartput `KindId`, so a money column accepts whatever *your* engine
reads as money. `metrics` exist because the interesting half of a schema's
vocabulary is not its column names — nobody types `sum of total_cents`, they
type `revenue`.

## An engine, and a query engine

You build the engine. The kinds you register decide what a filter can say.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datetime } from "@smartput/datetime";
import datetimeEn from "@smartput/datetime/locale/en";
import { dateRange } from "@smartput/date-range";
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";
import { place } from "@smartput/country";
import placeEn from "@smartput/country/locale/en";
import { QueryEngine } from "@smartput/query";
import { SqlCompiler } from "@smartput/query/sql";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn, moneyEn, placeEn])],
  kinds: [...BUILTIN_KINDS, datetime, dateRange, place, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1 }),
});

const q = new QueryEngine({ schema: shop, engine });
const sql = new SqlCompiler();

q.compile("orders over 500 usd", sql);
// { text: 'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1',
//   params: [50000] }
```

Note the parameter. The engine read dollars, the column declared that it stores
cents, and `50000` is what a driver binds. Ask in euros and the rate table runs
first:

```ts
q.compile("orders over 500 eur", sql).params;   // [55000]
```

Nothing in the sentence said "cents" and nothing in the sentence said "convert".

## The same sentence, a second dialect

```ts
import { MongoCompiler } from "@smartput/query/mongo";

q.compile("orders over 500 eur", new MongoCompiler());
// { collection: "orders",
//   pipeline: [{ $match: { total_cents: { $gt: 55000 } } }],
//   find: { filter: { total_cents: { $gt: 55000 } } } }
```

Everything upstream of the compiler is shared — the parse, the column
resolution, the rate conversion, the ambiguity rules. A dialect is a class
implementing `Compiler<T>` and nothing else:

```ts
import type { Compiler, CompileCtx, QueryIr } from "@smartput/query";

class CypherCompiler implements Compiler<string> {
  readonly dialect = "cypher";
  compile(ir: QueryIr, ctx: CompileCtx): string {
    /* … */
  }
}
```

Write one and you inherit every sentence the grammar can read, including the
units, the currencies, the calendars and the gazetteer.

## Finding the column you did not name

`orders over 500 usd` names no column. The operand reads as money, exactly one
column on `orders` is money, so that is the column. This is what the `kind`
field buys, and it is why a schema that declares kinds is worth far more than
one that declares only names.

When more than one column could take the value, that is an ambiguity and not a
preference:

```ts
q.compile("orders last week", sql);
// AmbiguousQueryError: "last week" could filter more than one column:
//   orders.placed_at | orders.shipped_at
```

Name it and the ambiguity is gone — `orders placed last week`. This is the same
rule core applies to `10 m`: a genuine tie is reported, never guessed.

## Ranges are half-open

The range kinds store their end exclusive, and that survives all the way into
the emitted predicate:

```sql
"orders"."placed_at" >= $1 AND "orders"."placed_at" < $2
```

A compiler that wrote `<=` there would silently include the first row of the
next week, and no test of the SQL alone would show it.

## Joins

Only along declared edges, and only when the path is unique. Two paths of the
same length is an `AmbiguousJoinError` carrying both — a schema with
`billing_address_id` and `shipping_address_id` has two one-hop routes to
`addresses`, and picking either answers a different question than the one asked.

## Aggregates

An aggregate anywhere in the query forces a group, and the source's identity —
its `key` plus its `labels` — is what it groups by unless you said otherwise.

```ts
q.compile("top 10 customers by revenue", sql).text;
// SELECT "customers"."id", "customers"."name", SUM("orders"."total_cents") AS "revenue"
// FROM "customers" JOIN "orders" ON "customers"."id" = "orders"."customer_id"
// GROUP BY "customers"."id", "customers"."name"
// ORDER BY SUM("orders"."total_cents") DESC LIMIT 10
```

A filter on an aggregate becomes a `HAVING`, and the split between `WHERE` and
`HAVING` is made once by the linker rather than once per dialect:

```ts
q.compile("customers with more than 10 orders", sql).text;
// … GROUP BY "customers"."id", "customers"."name" HAVING COUNT(*) > $1
```

## Known limits

- **Range coverage is the range packages' vocabulary, not this grammar's.**
  `last week`, `last month` and `this month` are spans; `last quarter` is not in
  the table, so it reads as a single instant and narrows to that day. The
  emitted predicate is legal and is not what the phrase means — check a phrase
  before relying on it, and add it to the range kind if it is missing.
- **Currency symbols are not read on input.** `500 usd` works; `$500` does not,
  because the engine's money kind registers codes and names rather than symbol
  prefixes. That is a gap in the kind, not in this grammar.
- **A calendar day against a timestamp column is widened in nanoseconds**, so a
  day containing a DST transition is off by the hour that transition moved.
  Phrase it as a range when that matters — a range carries real calendar ends.
- **Mixed `and`/`or` without parentheses is refused.** English does not agree
  with itself about which binds tighter, and guessing here would be guessing at
  intent.
- **`$geoWithin` needs a point field.** A table declaring only `lat`/`lon`
  compiles to SQL and is refused by the Mongo compiler, which says so rather
  than emitting a collection scan.

## Installing

```sh
npm add @smartput/query
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/query` | The package root. |
| `@smartput/query/sql` | `SqlCompiler` — parameterised SQL, never string-concatenated. |
| `@smartput/query/mongo` | `MongoCompiler` — a filter document. |

## Runtime exports

Type-only exports are erased and do not appear here.

`AmbiguousJoinError` · `AmbiguousQueryError` · `MAX_PHRASE_WORDS` · `OperandReader` · `QueryEngine` · `QueryParseError` · `QueryParser` · `Schema` · `SchemaError` · `UnknownColumnError` · `UnsupportedQueryError` · `bindingOf` · `defineSchema` · `geoOf` · `lex` · `queryEn` · `rangeOf`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| query root (grammar + schema, no dialect) | ≤ 59.5 kB | ≤ 21.9 kB |
| query/sql | ≤ 36.5 kB | ≤ 14.7 kB |
| query/mongo | ≤ 38.1 kB | ≤ 15.2 kB |

## Dependencies

- [`@smartput/core`](/packages/core)

## See also

- [Querying a database](/packages/query)

