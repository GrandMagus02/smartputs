import { expect, test } from "bun:test";
import { membership, PostgresIntrospector } from "./postgres";
import { shopCatalog } from "./shop.catalog.fixture";

/**
 * The reader, in two halves.
 *
 * The constraint parser is tested against the strings Postgres actually
 * produces, which is why they are pasted verbatim rather than written in the
 * shape `IN (...)` was typed in — `pg_get_constraintdef` never gives that back.
 *
 * The live half runs only when `$SMARTPUT_INTROSPECT_URL` names a database
 * built from `scripts/shop.sql`, and it asserts one thing: that the recorded
 * fixture the rest of the suite trusts is still what a real Postgres produces.
 * A dedicated variable rather than `$DATABASE_URL`, because a test suite that
 * connects to whatever a developer happened to export is a test suite that
 * eventually reads a production replica.
 */
test("a CHECK that is only a membership test becomes a value list", () => {
  expect(
    membership(
      "CHECK ((tier = ANY (ARRAY['free'::text, 'gold'::text, 'platinum'::text])))",
    ),
  ).toEqual(["free", "gold", "platinum"]);
  expect(
    membership(
      "CHECK (((tier)::text = ANY ((ARRAY['free'::character varying, 'gold'::character varying])::text[])))",
    ),
  ).toEqual(["free", "gold"]);
  expect(membership("CHECK ((tier IN ('free', 'gold')))")).toEqual(["free", "gold"]);
});

test("an escaped quote survives the round trip", () => {
  expect(membership("CHECK ((x = ANY (ARRAY['it''s'::text])))")).toEqual(["it's"]);
});

test("a CHECK that is more than a membership test yields nothing", () => {
  // Its literals enumerate one predicate, not the column. Emitting them as
  // `values` would tell the linker that `status is cancelled` is a legal filter
  // on a table where the constraint forbids exactly that combination.
  expect(
    membership("CHECK (((status = ANY (ARRAY['paid'::text])) AND (total > 0)))"),
  ).toBeNull();
  expect(membership("CHECK ((total > (0)::numeric))")).toBeNull();
});

const url = process.env.SMARTPUT_INTROSPECT_URL;

test.skipIf(url === undefined)("a live catalogue is the recorded one", async () => {
  const live = await new PostgresIntrospector({ url: url as string }).read();
  expect(live).toEqual(shopCatalog);
});
