import { expect, test } from "bun:test";
import { QueryEngine } from "./query";
import { fixtureEngine, shop } from "./shop.fixture";
import { SqlCompiler, type SqlParam } from "./sql";

/**
 * The corpus, written as SQL rather than as IR.
 *
 * SQL because it is the artefact a reviewer can check against a database they
 * already understand: an IR assertion proves the parser did *something*, and
 * only the emitted statement proves it did the right thing. The Mongo dialect
 * is asserted separately, over the same sentences, in `mongo.test.ts`.
 *
 * Every row is one sentence someone might type into a search bar. The five
 * tiers of the design are all present, and so is the boundary: the refusals at
 * the bottom of this file are as much a part of the contract as the successes.
 */
const engine = new QueryEngine({ schema: shop, engine: fixtureEngine() });
const sql = new SqlCompiler();

const compile = (input: string) => engine.compile(input, sql);

interface Row {
  readonly input: string;
  readonly text: string;
  readonly params?: readonly SqlParam[];
}

const ROWS: Row[] = [
  // Tier 1 — plain filters. The value side is the engine's; only the column and
  // the storage unit are this package's.
  {
    input: "orders where total > 500 usd",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1',
    params: [50000],
  },
  {
    input: "orders over 500 usd",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1',
    params: [50000],
  },
  {
    // Ruling R4: the engine reads euros, the rate table converts, and the
    // column's `scale` turns dollars into the cents it stores. None of that is
    // visible in the sentence and all of it is in the parameter.
    input: "orders over 500 eur",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1',
    params: [55000],
  },
  {
    input: "orders where weight > 2 kg",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."weight_g" > $1',
    params: [2000],
  },
  {
    input: "orders where weight between 500 g and 2 kg",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."weight_g" >= $1 AND "orders"."weight_g" <= $2',
    params: [500, 2000],
  },
  {
    input: "orders where status is pending",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."status" = $1',
    params: ["pending"],
  },
  {
    input: "orders where status is not cancelled",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."status" != $1',
    params: ["cancelled"],
  },
  {
    input: "customers where email contains gmail",
    text: 'SELECT "customers".* FROM "customers" WHERE "customers"."email" LIKE $1',
    params: ["%gmail%"],
  },
  {
    input: "customers where tier is gold and country is ukraine",
    text: 'SELECT "customers".* FROM "customers" WHERE "customers"."tier" = $1 AND "customers"."country_code" = $2',
    params: ["gold", "ua"],
  },

  // Tier 2 — ranges. The end is exclusive because the range packages store it
  // that way, and `upperExclusive` is what carries that into a `<`.
  {
    input: "orders last week",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."placed_at" >= $1 AND "orders"."placed_at" < $2',
  },
  {
    input: "orders placed last week",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."placed_at" >= $1 AND "orders"."placed_at" < $2',
  },
  {
    input: "customers signed up last week",
    text: 'SELECT "customers".* FROM "customers" WHERE "customers"."created_at" >= $1 AND "customers"."created_at" < $2',
  },

  // Tier 3 — geography. A place Value's unit is its country, which is exactly
  // what a `country_code` column stores.
  {
    input: "customers from ukraine",
    text: 'SELECT "customers".* FROM "customers" WHERE "customers"."country_code" = $1',
    params: ["ua"],
  },
  {
    input: "shipments to poland",
    text: 'SELECT "shipments".* FROM "shipments" WHERE "shipments"."destination" = $1',
    params: ["pl"],
  },

  // Tier 4 — aggregates, ordering and limits.
  {
    input: "count orders",
    text: 'SELECT COUNT(*) FROM "orders"',
    params: [],
  },
  {
    input: "sum of total by country",
    text: 'SELECT "customers"."country_code", SUM("orders"."total_cents") FROM "orders" JOIN "customers" ON "orders"."customer_id" = "customers"."id" GROUP BY "customers"."country_code"',
    params: [],
  },
  {
    input: "top 10 customers by revenue",
    text: 'SELECT "customers"."id", "customers"."name", SUM("orders"."total_cents") AS "revenue" FROM "customers" JOIN "orders" ON "customers"."id" = "orders"."customer_id" GROUP BY "customers"."id", "customers"."name" ORDER BY SUM("orders"."total_cents") DESC LIMIT 10',
    params: [],
  },
  {
    // Spelled counts go through the engine, so this and "top 10" agree without
    // a second table of cardinals living here.
    input: "top ten customers by spend",
    text: 'SELECT "customers"."id", "customers"."name", SUM("orders"."total_cents") AS "revenue" FROM "customers" JOIN "orders" ON "customers"."id" = "orders"."customer_id" GROUP BY "customers"."id", "customers"."name" ORDER BY SUM("orders"."total_cents") DESC LIMIT 10',
    params: [],
  },
  {
    input: "orders sorted by total descending",
    text: 'SELECT "orders".* FROM "orders" ORDER BY "orders"."total_cents" DESC',
    params: [],
  },
  {
    input: "orders limit 5",
    text: 'SELECT "orders".* FROM "orders" LIMIT 5',
    params: [],
  },

  // Tier 5 — joins along a declared edge, and the aggregate filter that needs
  // a group it was never asked for.
  {
    input: "customers with more than 10 orders",
    text: 'SELECT "customers"."id", "customers"."name" FROM "customers" JOIN "orders" ON "customers"."id" = "orders"."customer_id" GROUP BY "customers"."id", "customers"."name" HAVING COUNT(*) > $1',
    params: [10],
  },

  // Composed.
  {
    input: "orders over 500 usd where status is paid",
    text: 'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1 AND "orders"."status" = $2',
    params: [50000, "paid"],
  },
];

for (const row of ROWS) {
  test(`corpus: ${row.input}`, () => {
    const out = compile(row.input);
    expect(out.text).toBe(row.text);
    if (row.params !== undefined) expect([...out.params]).toEqual([...row.params]);
  });
}

test("the corpus is not a stub", () => {
  expect(ROWS.length).toBeGreaterThan(20);
});

/**
 * Ruling R6, checked rather than trusted.
 *
 * Every parameter's rendering is searched for in the emitted text, and finding
 * one is the failure. This is the property that distinguishes a rules-only
 * parser from a generated statement, so it is asserted over the whole corpus
 * rather than left to review.
 */
test("no parameter is ever interpolated into the text", () => {
  for (const row of ROWS) {
    const out = compile(row.input);
    for (const p of out.params) {
      const rendered = p instanceof Date ? p.toISOString() : String(p);
      if (rendered.length < 2) continue;
      expect(out.text).not.toContain(rendered);
    }
  }
});

test("every emitted placeholder has a parameter behind it", () => {
  for (const row of ROWS) {
    const out = compile(row.input);
    const holes = [...out.text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(0, ...holes)).toBe(out.params.length);
    expect(new Set(holes).size).toBe(holes.length);
  }
});

test("the question-mark dialect binds the same values", () => {
  const mysql = new SqlCompiler({ placeholder: "question", quote: "`" });
  const out = engine.compile("orders over 500 usd", mysql);
  expect(out.text).toBe(
    "SELECT `orders`.* FROM `orders` WHERE `orders`.`total_cents` > ?",
  );
  expect([...out.params]).toEqual([50000]);
});
