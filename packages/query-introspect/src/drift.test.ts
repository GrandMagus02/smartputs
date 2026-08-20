import { expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import type { Catalog, CatalogTable } from "./catalog";
import { DriftCheck, loadSchemaFile, type SchemaShape } from "./drift";
import { SchemaFileError } from "./errors";
import { shopCatalog } from "./shop.catalog.fixture";
import { schema } from "./shop.schema.fixture";

/**
 * `--check`, which is the mode with the long-term value: a CI guard that fails
 * on a migration the schema file did not follow.
 *
 * The committed side of every test below is the real generated fixture, and the
 * live side is the recorded catalogue with one thing changed — which is what a
 * migration is. The tests at the bottom are the other half of the contract, and
 * the harder half: the things a check must *not* report, because a check that
 * nags about the author's own edits is a check somebody deletes.
 */
const committed = schema.def as SchemaShape;
const check = (catalog: Catalog, file: SchemaShape = committed) =>
  new DriftCheck(catalog, file);

/**
 * The catalogue with every `readonly` peeled off, so an edit below reads as the
 * migration it stands for rather than as three casts around it.
 */
type Draft<T> = T extends readonly (infer U)[]
  ? Draft<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Draft<T[K]> }
    : T;

/** The recorded catalogue with one edit, applied to a deep copy. */
function changed(edit: (catalog: Draft<Catalog>) => void): Catalog {
  const copy = structuredClone(shopCatalog) as Draft<Catalog>;
  edit(copy);
  return copy;
}

const table = (catalog: Draft<Catalog>, name: string): Draft<CatalogTable> =>
  catalog.tables.find((t) => t.name === name) as Draft<CatalogTable>;

test("the generated file does not drift from the catalogue it came from", () => {
  const drift = check(shopCatalog);
  expect(drift.run()).toEqual([]);
  // `events` is a note and not a failure: the generator would not have written
  // it either, so its absence is not the database moving.
  expect(drift.notes.join("\n")).toContain("events has no primary key");
});

test("a column a migration added is drift", () => {
  const catalog = changed((c) => {
    table(c, "orders").columns.push({
      name: "refunded_at",
      sqlType: "timestamp with time zone",
      type: "datetime",
    });
  });
  expect(check(catalog).run()).toEqual([
    {
      kind: "new-column",
      where: "orders.refunded_at",
      detail: "timestamp with time zone column, not in the schema file.",
    },
  ]);
});

test("a column a migration dropped is drift", () => {
  const catalog = changed((c) => {
    const orders = table(c, "orders");
    orders.columns = orders.columns.filter((col) => col.name !== "note");
  });
  expect(check(catalog).run()).toEqual([
    {
      kind: "dropped-column",
      where: "orders.note",
      detail: "in the schema file and not in the database.",
    },
  ]);
});

test("a column whose type changed under the file is drift", () => {
  const catalog = changed((c) => {
    const note = table(c, "orders").columns.find((col) => col.name === "note");
    Object.assign(note as Draft<CatalogTable>["columns"][number], {
      sqlType: "numeric",
      type: "number",
    });
  });
  expect(check(catalog).run()).toEqual([
    {
      kind: "changed-type",
      where: "orders.note",
      detail:
        "the column is numeric, which binds a number; the schema file binds a string.",
    },
  ]);
});

test("a whole new table is drift, and so is one that vanished", () => {
  const added = changed((c) => {
    c.tables.push({
      name: "refunds",
      primaryKey: ["id"],
      columns: [{ name: "id", sqlType: "bigint", type: "number" }],
    });
  });
  expect(check(added).run()).toEqual([
    {
      kind: "new-table",
      where: "refunds",
      detail: "refunds is in the database and not in the schema file.",
    },
  ]);

  const dropped = changed((c) => {
    c.tables = c.tables.filter((t) => t.name !== "addresses");
  });
  const found = check(dropped).run();
  expect(found).toContainEqual({
    kind: "dropped-table",
    where: "addresses",
    detail: "addresses is in the schema file and not in the database.",
  });
});

test("a foreign key with no join edge is drift", () => {
  const catalog = changed((c) => {
    c.foreignKeys.push({
      name: "order_lines_sku_fkey",
      from: { table: "order_lines", columns: ["sku"] },
      to: { table: "customers", columns: ["name"] },
    });
  });
  expect(check(catalog).run()).toEqual([
    {
      kind: "new-join",
      where: "order_lines_sku_fkey",
      detail:
        "order_lines.sku → customers.name is a foreign key with no join edge in the schema file.",
    },
  ]);
});

test("a value the enum gained is drift, because a filter on it would find nothing", () => {
  const catalog = changed((c) => {
    const status = table(c, "orders").columns.find((col) => col.name === "status");
    status?.values?.push("refunded");
  });
  expect(check(catalog).run()).toEqual([
    {
      kind: "changed-values",
      where: "orders.status",
      detail: 'the database enumerates "refunded", which the schema file does not list.',
    },
  ]);
});

test("a primary key that moved off the file's key is drift", () => {
  const catalog = changed((c) => {
    table(c, "order_lines").primaryKey = ["line_no"];
  });
  expect(check(catalog).run()).toEqual([
    {
      kind: "changed-key",
      where: "order_lines",
      detail: 'the primary key is (line_no); the schema file keys on "order_id".',
    },
  ]);
});

test("a hand-written join across a soft foreign key is not drift", () => {
  // The database never proved this edge and never will. Reporting it would mean
  // the check fails forever on a file that is more correct than the catalogue.
  const file: SchemaShape = {
    ...committed,
    joins: [...(committed.joins ?? []), { from: "events.what", to: "orders.status" }],
  };
  expect(check(shopCatalog, file).run()).toEqual([]);
});

test("a narrower `values` list and an extra alias are the author's, not drift", () => {
  const file: SchemaShape = {
    tables: committed.tables.map((t) =>
      t.name !== "orders"
        ? t
        : {
            ...t,
            columns: t.columns.map((c) =>
              c.name !== "status" ? c : { ...c, values: [...(c.values ?? []), "held"] },
            ),
          },
    ),
    ...(committed.joins === undefined ? {} : { joins: committed.joins }),
  };
  expect(check(shopCatalog, file).run()).toEqual([]);
});

test("a kind and unit the author added still binds what the column stores", () => {
  // The four-line copy of `bindingOf` in emit.ts, pinned behaviourally: a
  // `bigint` column the author declared as money in dollars-times-a-hundred
  // binds a number, and agrees with the catalogue. If the rule over in
  // `@smartput/query` ever changes, this is the test that goes red.
  const file: SchemaShape = {
    tables: [
      {
        name: "orders",
        key: "id",
        columns: [
          { name: "id", as: "number" },
          { name: "total_cents", kind: "money", unit: "usd" },
          { name: "placed_at", kind: "datetime" },
          { name: "note" },
        ],
      },
    ],
  };
  const catalog: Catalog = {
    dialect: "postgres",
    tables: [
      {
        name: "orders",
        primaryKey: ["id"],
        columns: [
          { name: "id", sqlType: "bigint", type: "number" },
          { name: "total_cents", sqlType: "bigint", type: "number" },
          { name: "placed_at", sqlType: "timestamptz", type: "datetime" },
          { name: "note", sqlType: "text", type: "string" },
        ],
      },
    ],
    foreignKeys: [],
  };
  expect(new DriftCheck(catalog, file).run()).toEqual([]);
});

test("the committed file is found by shape, not by class", async () => {
  const loaded = await loadSchemaFile(
    Bun.fileURLToPath(new URL("shop.schema.fixture.ts", import.meta.url)),
  );
  expect(loaded.tables.map((t) => t.name)).toEqual([
    "addresses",
    "customers",
    "order_lines",
    "orders",
  ]);
});

test("a file with no schema in it says so", async () => {
  const path = `${import.meta.dir}/no-schema.tmp.ts`;
  await Bun.write(path, "export const nothing = 1;\n");
  try {
    await expect(loadSchemaFile(path)).rejects.toThrow(SchemaFileError);
  } finally {
    await unlink(path);
  }
});
