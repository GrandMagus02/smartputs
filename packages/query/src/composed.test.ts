import { expect, test } from "bun:test";
import { QueryEngine } from "./query";
import { fixtureEngine, shop } from "./shop.fixture";
import { SqlCompiler } from "./sql";

/**
 * The sentences the guide and the roadmap quote, asserted here so the prose
 * cannot drift from the behaviour. A documented example that stopped working is
 * worse than an undocumented one.
 */
const q = new QueryEngine({ schema: shop, engine: fixtureEngine() });
const sql = new SqlCompiler();

test("a ranking and a filter in one sentence", () => {
  const out = q.compile("top 10 customers by revenue last month", sql);
  expect(out.text).toContain("ORDER BY SUM");
  expect(out.text).toContain("LIMIT 10");
  expect(out.text).toContain('"customers"."created_at" >=');
  const [from, to] = out.params as [Date, Date];
  expect(to.getTime() - from.getTime()).toBe(31 * 86_400_000);
});

/**
 * The limit worth a test of its own, because it looks like it works.
 *
 * "last quarter" is not in the shipped range vocabulary, so chrono reads it as
 * a single instant three months back and the containment rule widens that
 * instant to its day. The emitted predicate is a legal one-day filter and it is
 * not what the phrase means. A test pins it so the day the range packages learn
 * the word, this fails and gets updated rather than quietly improving.
 */
test("a phrase outside the range vocabulary narrows to a day, not a quarter", () => {
  const out = q.compile("customers signed up last quarter", sql);
  const [from, to] = out.params as [Date, Date];
  expect(to.getTime() - from.getTime()).toBe(86_400_000);
});

test("a filter, a join and a limit compose", () => {
  const out = q.compile("orders over 500 usd where status is paid limit 5", sql);
  expect(out.text).toBe(
    'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1 AND "orders"."status" = $2 LIMIT 5',
  );
});

test("parentheses nest a disjunction inside a conjunction", () => {
  const out = q.compile(
    "orders where status is paid and (total > 500 usd or weight > 2 kg)",
    sql,
  );
  expect(out.text).toBe(
    'SELECT "orders".* FROM "orders" FROM_MARKER'.replace(
      " FROM_MARKER",
      ' WHERE "orders"."status" = $1 AND ("orders"."total_cents" > $2 OR "orders"."weight_g" > $3)',
    ),
  );
});

test("a negation wraps rather than flipping the operator", () => {
  const out = q.compile("orders where not status is cancelled", sql);
  expect(out.text).toContain("NOT (");
  expect(out.params).toEqual(["cancelled"]);
});

test("a list becomes IN", () => {
  const out = q.compile("orders where status in pending, paid, shipped", sql);
  expect(out.text).toBe(
    'SELECT "orders".* FROM "orders" WHERE "orders"."status" IN ($1, $2, $3)',
  );
  expect([...out.params]).toEqual(["pending", "paid", "shipped"]);
});

test("an emitted IR can be recompiled without reparsing", () => {
  const ir = q.parse("orders over 500 usd");
  expect(q.emit(ir, sql).text).toBe(q.compile("orders over 500 usd", sql).text);
});

test("a city resolves through the gazetteer the consumer registered", () => {
  const out = q.compile("customers in kyiv", sql);
  // A city is not a unit, so a city Value borrows its country's alpha-2 — which
  // is exactly what a country column stores, and why this reads as Ukraine.
  expect(out.params).toEqual(["ua"]);
});
