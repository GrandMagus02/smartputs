import { expect, test } from "bun:test";
import { SchemaEmitter } from "./emit";
import { shopCatalog } from "./shop.catalog.fixture";
import { FIXTURE_SOURCE } from "./shop.header.fixture";

/**
 * The emitter, against a catalogue recorded from a real Postgres.
 *
 * The first test is the whole contract in one line: the committed
 * `shop.schema.fixture.ts` is *this* emitter's output, byte for byte, and it is
 * a file the repo also lints, typechecks and builds a `QueryEngine` on. Every
 * other test here names one claim the file makes, so a diff in the fixture
 * arrives with a failing test that says which claim moved.
 */
const emit = () => new SchemaEmitter(shopCatalog, { source: FIXTURE_SOURCE }).emit();

test("the committed schema fixture is what the emitter emits", async () => {
  const committed = await Bun.file(
    new URL("shop.schema.fixture.ts", import.meta.url),
  ).text();
  expect(emit()).toBe(committed);
});

test("a numeric column gets a binding and never a kind", () => {
  // The single most important line in this package. `weight_g` is a
  // `numeric(12,3)` whose name all but says mass, and what it gets is `as:
  // "number"` and a comment.
  expect(emit()).toContain(`{ name: "weight_g", as: "number" },`);
  expect(emit()).not.toContain(`{ name: "weight_g", as: "number", kind:`);
});

test("a suffix is surfaced as a TODO rather than acted on", () => {
  const text = emit();
  expect(text).toContain(
    '// TODO: `_cents` suggests { kind: "money", unit: "<iso4217>", scale: 100 }',
  );
  expect(text).toContain(`{ name: "lifetime_cents", as: "number" },`);
});

test("a column comment carrying an annotation emits the fields and no TODO", () => {
  const text = emit();
  expect(text).toContain(`kind: "money",`);
  expect(text).toContain(`unit: "usd",`);
  expect(text).toContain("scale: 100,");
  // `total_cents` ends in the same suffix as `lifetime_cents` and gets no TODO,
  // because the answer is already in the file — from the database, not a guess.
  const cents = text.slice(text.indexOf(`name: "total_cents"`));
  expect(cents.slice(0, cents.indexOf("}"))).not.toContain("TODO");
});

test("an enum type and a CHECK both reach `values`", () => {
  const text = emit();
  expect(text).toContain(`values: ["pending", "paid", "shipped", "cancelled"],`);
  expect(text).toContain(`values: ["free", "gold", "platinum"]`);
});

test("a timestamptz is a datetime and a date is a date, with no `as`", () => {
  const text = emit();
  expect(text).toContain(`{ name: "placed_at", kind: "datetime" },`);
  expect(text).toContain(`{ name: "delivered_on", kind: "date" },`);
});

test("a type with no binding gets neither `as` nor a guess", () => {
  const text = emit();
  expect(text).toContain(`{ name: "metadata" },`);
  expect(text).toContain("// TODO: `jsonb` has no ColumnDef binding here.");
});

test("a table with no primary key is left out, loudly", () => {
  const emitter = new SchemaEmitter(shopCatalog);
  const text = emitter.emit();
  expect(text).not.toContain(`name: "events"`);
  expect(emitter.notes.join("\n")).toContain("events has no primary key");
});

test("a composite primary key keeps the table and says what it did", () => {
  const text = emit();
  expect(text).toContain("// TODO: the primary key is (order_id, line_no).");
  expect(text).toContain(`key: "order_id",`);
});

test("two foreign keys to one table are two edges, not a tiebreak", () => {
  const text = emit();
  expect(text).toContain(`{ from: "orders.billing_address_id", to: "addresses.id" },`);
  expect(text).toContain(`{ from: "orders.shipping_address_id", to: "addresses.id" },`);
});

test("lat/lon are a comment, because a position is not a proof", () => {
  const text = emit();
  expect(text).toContain("// TODO: `lat`/`lon` look like a position.");
  // The suggestion appears inside the comment and nowhere as a field.
  expect(text.split("\n").filter((l) => l.startsWith("      geo:"))).toEqual([]);
});

test("--exclude drops a table and the join edges that reached it", () => {
  const emitter = new SchemaEmitter(shopCatalog, { exclude: ["addresses"] });
  const text = emitter.emit();
  expect(text).not.toContain(`name: "addresses"`);
  expect(text).not.toContain("addresses.id");
  expect(emitter.notes.join("\n")).toContain("addresses_customer_id_fkey");
});

test("the exported binding can be named", () => {
  const text = new SchemaEmitter(shopCatalog, { name: "shopSchema" }).emit();
  expect(text).toContain("export const shopSchema: Schema = defineSchema({");
});

test("no line the emitter writes is wider than Biome would allow", () => {
  // The generated file has to survive `bun run lint` unedited, and the object
  // printer's whole job is the width rule. Comments are exempt for the reason
  // Biome exempts them: it does not reflow prose.
  const wide = emit()
    .split("\n")
    .filter((line) => line.length > 90 && !line.trimStart().startsWith("//"));
  expect(wide).toEqual([]);
});
