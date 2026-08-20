import { expect, test } from "bun:test";
import { composeLocale, createEngine, type Engine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { QueryEngine } from "@smartput/query";
import { SqlCompiler } from "@smartput/query/sql";
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";
import { schema } from "./shop.schema.fixture";

/**
 * The claim the rest of the package exists to make: the generated file is a
 * schema, not a document about one.
 *
 * This is the only test here that imports `@smartput/query`, and it imports it
 * the way a consumer would — from the package, against the committed file. The
 * dependency runs in one direction and only in a test: `query` does not know
 * this package exists.
 */
function fixtureEngine(): Engine {
  return createEngine({
    locales: [composeLocale(en, [...BUILTIN_EN, moneyEn])],
    kinds: [...BUILTIN_KINDS, datetime, money],
    rates: snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 }),
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
}

const engine = new QueryEngine({ schema, engine: fixtureEngine() });
const sql = new SqlCompiler();
const compile = (input: string) => engine.compile(input, sql);

test("an annotated money column filters in the unit the column stores", () => {
  // `@smartput kind=money unit=usd scale=100` came out of a `COMMENT ON COLUMN`
  // and travelled into the file untouched, so `500 usd` becomes 50000 cents.
  const out = compile("orders over 500 usd");
  expect(out.text).toBe(
    'SELECT "orders".* FROM "orders" WHERE "orders"."total_cents" > $1',
  );
  expect(out.params).toEqual([50000]);
});

test("an enum type read out of pg_enum is what makes a word link", () => {
  const out = compile("orders where status is paid");
  expect(out.text).toBe('SELECT "orders".* FROM "orders" WHERE "orders"."status" = $1');
  expect(out.params).toEqual(["paid"]);
});

test("a foreign key read out of pg_constraint is what makes a join", () => {
  const out = compile("orders where tier is gold");
  expect(out.text).toContain('JOIN "customers"');
  expect(out.text).toContain('"orders"."customer_id" = "customers"."id"');
  expect(out.params).toEqual(["gold"]);
});

test("a timestamptz column is a datetime because the type said so", () => {
  // Typed as `placed at`, not as `placed`: the generated file has the column
  // name and the underscore-folded form of it, and nothing else. `placed`,
  // `ordered` and `date` are aliases a person adds, and their absence here is
  // the single clearest measure of what a catalogue cannot hand you.
  const out = compile("orders where placed at after 2026-01-01");
  expect(out.text).toContain('"orders"."placed_at" >');
});
