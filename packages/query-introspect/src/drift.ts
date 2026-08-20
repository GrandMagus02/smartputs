import { columnAnnotation } from "./annotation";
import type { Catalog, CatalogTable } from "./catalog";
import { type Binding, provenBinding, skipped } from "./emit";
import { SchemaFileError } from "./errors";

/**
 * A committed schema file, read structurally.
 *
 * The shape is the contract, exactly as `@smartput/geo` and `@smartput/query`
 * agree on a place without either importing the other. `--check` loads the
 * author's module and looks for an export that answers `def.tables`, so it
 * never imports `@smartput/query` to name the class — which is what keeps the
 * arrow between the two packages pointing one way even in the mode that has to
 * read a `Schema` back.
 */
export interface ColumnShape {
  readonly name: string;
  readonly kind?: string;
  readonly unit?: string;
  readonly as?: string;
  readonly values?: readonly string[];
}

export interface TableShape {
  readonly name: string;
  readonly key: string;
  readonly columns: readonly ColumnShape[];
}

export interface SchemaShape {
  readonly tables: readonly TableShape[];
  readonly joins?: readonly { readonly from: string; readonly to: string }[];
}

export type DriftKind =
  | "new-table"
  | "dropped-table"
  | "new-column"
  | "dropped-column"
  | "changed-type"
  | "changed-key"
  | "changed-values"
  | "new-join";

export interface Drift {
  readonly kind: DriftKind;
  /** `orders` or `orders.total_cents`. */
  readonly where: string;
  readonly detail: string;
}

function looksLikeSchema(value: unknown): value is SchemaShape {
  if (typeof value !== "object" || value === null) return false;
  const tables = (value as { tables?: unknown }).tables;
  return (
    Array.isArray(tables) &&
    tables.every(
      (t) =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as { name?: unknown }).name === "string" &&
        Array.isArray((t as { columns?: unknown }).columns),
    )
  );
}

/**
 * The schema a committed file exports.
 *
 * Both shapes are accepted: a `Schema` — the usual case, which carries its
 * literal on `def` — and the plain `QuerySchemaDef` object, for a file that
 * exports the literal and calls `defineSchema` somewhere else. Neither is
 * detected by class, so this works against a `@smartput/query` this package has
 * no edge to and never loaded.
 */
export async function loadSchemaFile(path: string): Promise<SchemaShape> {
  let module: Record<string, unknown>;
  try {
    module = (await import(Bun.pathToFileURL(path).href)) as Record<string, unknown>;
  } catch (e) {
    throw new SchemaFileError(path, `${e}`);
  }
  for (const value of Object.values(module)) {
    const def = (value as { def?: unknown } | null | undefined)?.def;
    if (looksLikeSchema(def)) return def;
    if (looksLikeSchema(value)) return value;
  }
  throw new SchemaFileError(
    path,
    "it exports nothing that looks like a schema. Expected a `defineSchema({...})` result, or the `{ tables: [...] }` literal itself.",
  );
}

/** The binding `@smartput/query` reads off a committed column. See `emit.ts`. */
function bindingOf(column: ColumnShape): Binding {
  if (column.as !== undefined) return column.as as Binding;
  if (column.kind === "datetime" || column.kind === "date") return "date";
  if (column.unit !== undefined) return "number";
  return "string";
}

/**
 * Compares a committed schema against a live catalogue.
 *
 * The asymmetry in what counts as drift is the whole design, and it is what
 * makes this safe to put in CI. A fact the database gained and the file lacks
 * is drift, because a migration moved and nobody followed it. A fact the file
 * has and the database does not is drift only when the database *lost* it: a
 * hand-written join edge across a soft foreign key, an alias, a metric, a
 * `values` list narrower than the column allows are all things an author added
 * on purpose, and a check that nagged about them would be a check people turn
 * off.
 */
export class DriftCheck {
  /** Tables the generator would not have written either. Printed, never failing. */
  readonly notes: string[] = [];
  private readonly exclude: ReadonlySet<string>;

  constructor(
    private readonly catalog: Catalog,
    private readonly committed: SchemaShape,
    options: { exclude?: readonly string[] } = {},
  ) {
    this.exclude = new Set(options.exclude ?? []);
  }

  run(): Drift[] {
    this.notes.length = 0;
    const out: Drift[] = [];
    const live = new Map<string, CatalogTable>();
    for (const table of this.catalog.tables) {
      const skip = skipped(table, this.exclude);
      if (skip === null) live.set(table.name, table);
      else if (skip.note !== null) this.notes.push(skip.note);
    }
    const filed = new Map(this.committed.tables.map((t) => [t.name, t]));

    for (const [name, table] of live) {
      const found = filed.get(name);
      if (found === undefined) {
        out.push({
          kind: "new-table",
          where: name,
          detail: `${name} is in the database and not in the schema file.`,
        });
        continue;
      }
      out.push(...this.columns(table, found));
      out.push(...this.key(table, found));
    }
    for (const name of filed.keys()) {
      if (!live.has(name) && !this.exclude.has(name)) {
        out.push({
          kind: "dropped-table",
          where: name,
          detail: `${name} is in the schema file and not in the database.`,
        });
      }
    }
    out.push(...this.joins(live, filed));
    return out;
  }

  private columns(table: CatalogTable, filed: TableShape): Drift[] {
    const out: Drift[] = [];
    const committed = new Map(filed.columns.map((c) => [c.name, c]));
    for (const column of table.columns) {
      const where = `${table.name}.${column.name}`;
      // A column the author annotated away is not a column the generator would
      // have written, so its absence is not drift — the same rule as a skipped
      // table, one level down.
      if (columnAnnotation(where, column.comment)?.ignore === true) continue;
      const found = committed.get(column.name);
      if (found === undefined) {
        out.push({
          kind: "new-column",
          where,
          detail: `${column.sqlType} column, not in the schema file.`,
        });
        continue;
      }
      const proven = provenBinding(column.type);
      const bound = bindingOf(found);
      if (proven !== null && proven !== bound) {
        out.push({
          kind: "changed-type",
          where,
          detail: `the column is ${column.sqlType}, which binds a ${proven}; the schema file binds a ${bound}.`,
        });
      }
      if (column.values !== undefined) {
        const missing = column.values.filter((v) => !(found.values ?? []).includes(v));
        if (missing.length > 0) {
          out.push({
            kind: "changed-values",
            where,
            detail: `the database enumerates ${missing.map((v) => `"${v}"`).join(", ")}, which the schema file does not list.`,
          });
        }
      }
    }
    for (const column of filed.columns) {
      if (!table.columns.some((c) => c.name === column.name)) {
        out.push({
          kind: "dropped-column",
          where: `${table.name}.${column.name}`,
          detail: "in the schema file and not in the database.",
        });
      }
    }
    return out;
  }

  /**
   * The key, checked only against a primary key the database still has.
   *
   * A table whose key the author chose — one column of a composite, or a
   * `@smartput key=` annotation on a keyless table — is left alone unless the
   * database grew a primary key that disagrees with it.
   */
  private key(table: CatalogTable, filed: TableShape): Drift[] {
    if (table.primaryKey.length === 0) return [];
    if (table.primaryKey.includes(filed.key)) return [];
    if (!table.columns.some((c) => c.name === filed.key)) return [];
    return [
      {
        kind: "changed-key",
        where: table.name,
        detail: `the primary key is (${table.primaryKey.join(", ")}); the schema file keys on "${filed.key}".`,
      },
    ];
  }

  private joins(
    live: ReadonlyMap<string, CatalogTable>,
    filed: ReadonlyMap<string, TableShape>,
  ): Drift[] {
    const held = new Set<string>();
    for (const join of this.committed.joins ?? []) {
      held.add(`${join.from}|${join.to}`);
      held.add(`${join.to}|${join.from}`);
    }
    const out: Drift[] = [];
    for (const fk of this.catalog.foreignKeys) {
      if (fk.from.columns.length > 1 || fk.to.columns.length > 1) continue;
      if (!live.has(fk.from.table) || !live.has(fk.to.table)) continue;
      if (!filed.has(fk.from.table) || !filed.has(fk.to.table)) continue;
      const from = `${fk.from.table}.${fk.from.columns[0] as string}`;
      const to = `${fk.to.table}.${fk.to.columns[0] as string}`;
      if (held.has(`${from}|${to}`)) continue;
      out.push({
        kind: "new-join",
        where: fk.name,
        detail: `${from} → ${to} is a foreign key with no join edge in the schema file.`,
      });
    }
    return out;
  }
}
