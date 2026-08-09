import { expect, test } from "bun:test";
import {
  AmbiguousJoinError,
  AmbiguousQueryError,
  SchemaError,
  UnknownColumnError,
  UnsupportedQueryError,
} from "./errors";
import { QueryEngine } from "./query";
import { defineSchema } from "./schema";
import { fixtureEngine, shop } from "./shop.fixture";
import { SqlCompiler } from "./sql";

/**
 * Ruling R7's half of the contract.
 *
 * A parser that answers everything answers some things wrongly, and the wrong
 * answers are the ones nobody catches — a query that returns rows looks like it
 * worked. So the boundary is tested as deliberately as the successes, and each
 * refusal names the construct so a host can decide what to do next.
 */
const engine = new QueryEngine({ schema: shop, engine: fixtureEngine() });
const sql = new SqlCompiler();

test("a word that names nothing reports what it almost matched", () => {
  let caught: unknown;
  try {
    engine.compile("orders where custmer is bob", sql);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(UnknownColumnError);
  expect((caught as UnknownColumnError).nearest).toContain("customer");
});

test("mixing and/or without parentheses is refused rather than guessed", () => {
  expect(() =>
    engine.compile(
      "orders where status is paid and total > 500 usd or weight > 2 kg",
      sql,
    ),
  ).toThrow(UnsupportedQueryError);
});

test("parenthesising the group makes the same sentence legal", () => {
  const out = engine.compile(
    "orders where status is paid and (total > 500 usd or weight > 2 kg)",
    sql,
  );
  expect(out.text).toContain("OR");
  expect(out.params).toEqual(["paid", 50000, 2000]);
});

test("two join paths of the same length are an error, not a tiebreak", () => {
  const twoPaths = defineSchema({
    tables: [
      {
        name: "orders",
        key: "id",
        columns: [{ name: "id" }, { name: "billing_id" }, { name: "shipping_id" }],
      },
      {
        name: "addresses",
        key: "id",
        columns: [{ name: "id" }, { name: "city", kind: "place" }],
      },
    ],
    joins: [
      { from: "orders.billing_id", to: "addresses.id" },
      { from: "orders.shipping_id", to: "addresses.id" },
    ],
  });
  const ambiguous = new QueryEngine({ schema: twoPaths, engine: fixtureEngine() });
  let caught: unknown;
  try {
    ambiguous.compile("orders from ukraine", sql);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(AmbiguousJoinError);
  expect((caught as AmbiguousJoinError).paths).toHaveLength(2);
});

test("two columns of one kind on the source is an ambiguity, not a preference", () => {
  const twoDates = defineSchema({
    tables: [
      {
        name: "orders",
        key: "id",
        columns: [
          { name: "id" },
          { name: "placed_at", kind: "datetime" },
          { name: "shipped_at", kind: "datetime" },
        ],
      },
    ],
  });
  const ambiguous = new QueryEngine({ schema: twoDates, engine: fixtureEngine() });
  let caught: unknown;
  try {
    ambiguous.compile("orders last week", sql);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(AmbiguousQueryError);
  expect((caught as AmbiguousQueryError).readings).toEqual([
    "orders.placed_at",
    "orders.shipped_at",
  ]);
});

test("naming the column resolves what the bare operand could not", () => {
  const twoDates = defineSchema({
    tables: [
      {
        name: "orders",
        key: "id",
        columns: [
          { name: "id" },
          { name: "placed_at", aliases: ["placed"], kind: "datetime" },
          { name: "shipped_at", aliases: ["shipped"], kind: "datetime" },
        ],
      },
    ],
  });
  const q = new QueryEngine({ schema: twoDates, engine: fixtureEngine() });
  const out = q.compile("orders shipped last week", sql);
  expect(out.text).toContain('"orders"."shipped_at" >=');
});

test("a distance filter needs a positioned table", () => {
  expect(() => engine.compile("orders within 50 km of kyiv", sql)).toThrow(
    UnsupportedQueryError,
  );
});

test("a schema naming a column that is not there fails at construction", () => {
  expect(() =>
    defineSchema({
      tables: [{ name: "t", key: "id", columns: [{ name: "id" }] }],
      metrics: [{ name: "m", fn: "sum", column: "t.nope" }],
    }),
  ).toThrow(SchemaError);
});

test("a column storing a unit the engine cannot read says so", () => {
  const bad = defineSchema({
    tables: [
      {
        name: "t",
        key: "id",
        columns: [{ name: "id" }, { name: "w", kind: "mass", unit: "smoots" }],
      },
    ],
  });
  const q = new QueryEngine({ schema: bad, engine: fixtureEngine() });
  expect(() => q.compile("t where w > 2 kg", sql)).toThrow(SchemaError);
});

test("suggest returns nothing where compile would throw, and re-throws wiring errors", () => {
  expect(engine.suggest("this is not a query at all")).toEqual([]);
  expect(engine.suggest("orders over 500 usd")).toHaveLength(1);
  expect(() =>
    engine.suggest("orders where status is paid and total > 500 usd or weight > 2 kg"),
  ).not.toThrow();
});
