import { SQL } from "bun";
import type {
  Catalog,
  CatalogColumn,
  CatalogForeignKey,
  CatalogReader,
  CatalogTable,
  ProvenType,
} from "./catalog";
import { IntrospectionError } from "./errors";

/**
 * The connection URL with its credentials taken out, for an error message.
 *
 * `cli.ts` prints this message to stderr, which is a terminal somebody is
 * watching and a log line in CI that outlives them both — and a URL that was
 * refused is a URL somebody mistyped, which is the likeliest way one ever gets
 * printed at all. `label()` already keeps the password out of the *generated
 * file* for the same reason; this keeps it out of the failure path, which is
 * the one nobody rehearses. Bun's own parser agrees: its message for this case
 * says `<redacted>`.
 *
 * Deliberately not `new URL` — that is what just failed — so the authority is
 * cut by hand: everything between `://` and the last `@` before the path is
 * userinfo. A libpq-style `?password=` is stripped too, because that spelling
 * carries the same secret in a place the userinfo rule does not reach.
 */
function withoutCredentials(url: string): string {
  const scheme = url.indexOf("://");
  let out = url;
  if (scheme !== -1) {
    const from = scheme + 3;
    const slash = out.indexOf("/", from);
    const authority = slash === -1 ? out.slice(from) : out.slice(from, slash);
    const at = authority.lastIndexOf("@");
    if (at !== -1) out = `${out.slice(0, from)}***@${out.slice(from + at + 1)}`;
  }
  return out.replace(/([?&](?:password|sslpassword)=)[^&]*/gi, "$1***");
}

/**
 * Reads a Postgres catalogue.
 *
 * `pg_catalog` rather than `information_schema`, which is the portable answer
 * and cannot give two of the four facts this package exists to collect: an enum
 * type's labels live in `pg_enum`, and a `CHECK (col IN (...))` is only
 * readable through `pg_get_constraintdef`. `information_schema` would have
 * meant a second query into `pg_catalog` anyway, and then two vocabularies for
 * one dialect.
 *
 * The driver is `Bun.SQL`, so the package has no runtime dependency at all. Bun
 * 1.3 speaks the Postgres wire protocol natively; adding `pg` or `postgres` to
 * get the same six queries would have been a dependency on something the
 * runtime already does.
 */
export class PostgresIntrospector implements CatalogReader {
  private readonly sql: SQL;
  private readonly schema: string;

  constructor(options: { url: string; schema?: string }) {
    this.schema = options.schema ?? "public";
    try {
      this.sql = new SQL(options.url);
    } catch (e) {
      const safe = withoutCredentials(options.url);
      // Applied to the driver's sentence as well as to this one. Bun quotes the
      // URL back verbatim and redacts it only when there was userinfo to
      // redact, so `?password=` survives its scrub and would have walked
      // straight through a message that only fixed its own half. Guarded on a
      // non-empty URL because `replaceAll("")` splices the replacement between
      // every character.
      const detail =
        options.url === "" ? String(e) : String(e).replaceAll(options.url, safe);
      throw new IntrospectionError(`${safe} is not a usable Postgres URL — ${detail}`);
    }
  }

  /** Everything the catalogue proves, in one connection. */
  async read(): Promise<Catalog> {
    try {
      const [tables, columns, enums, keys, foreignKeys, checks] = await Promise.all([
        this.tables(),
        this.columns(),
        this.enums(),
        this.primaryKeys(),
        this.foreignKeys(),
        this.checks(),
      ]);
      if (tables.length === 0) {
        throw new IntrospectionError(
          `schema "${this.schema}" has no ordinary tables. Is --schema right?`,
        );
      }
      const built = tables.map((table) =>
        this.build(table, columns, enums, keys, checks),
      );
      return { dialect: "postgres", tables: built, foreignKeys };
    } finally {
      await this.sql.close();
    }
  }

  private build(
    table: { name: string; comment: string | null },
    columns: readonly ColumnRow[],
    enums: ReadonlyMap<number, string[]>,
    keys: ReadonlyMap<string, string[]>,
    checks: ReadonlyMap<string, string[]>,
  ): CatalogTable {
    const own = columns.filter((c) => c.table_name === table.name);
    return {
      name: table.name,
      primaryKey: keys.get(table.name) ?? [],
      columns: own.map((c) => this.column(table.name, c, enums, checks)),
      ...(table.comment === null ? {} : { comment: table.comment }),
    };
  }

  private column(
    table: string,
    row: ColumnRow,
    enums: ReadonlyMap<number, string[]>,
    checks: ReadonlyMap<string, string[]>,
  ): CatalogColumn {
    // An enum's labels beat a CHECK's literals only because a column cannot
    // sensibly have both; when it does, the type is the stronger statement —
    // the CHECK can be dropped without the values changing, the type cannot.
    const values = enums.get(row.base_oid) ?? checks.get(`${table}.${row.name}`);
    return {
      name: row.name,
      sqlType: row.sql_type,
      type: provenType(row),
      ...(values === undefined ? {} : { values }),
      ...(row.comment === null ? {} : { comment: row.comment }),
    };
  }

  /**
   * Ordinary and partitioned tables, and nothing else.
   *
   * Views and materialised views are queryable and are deliberately left out:
   * neither has a primary key or a foreign key, so every one of them would come
   * back as a table this package refuses to describe, and a generated file
   * whose loudest feature is a list of things it could not do teaches its
   * reader to stop reading. A view worth querying is a table definition
   * somebody writes by hand.
   */
  private async tables(): Promise<Array<{ name: string; comment: string | null }>> {
    return await this.sql`
      select c.relname as name, obj_description(c.oid, 'pg_class') as comment
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = ${this.schema} and c.relkind in ('r', 'p')
      order by c.relname
    `;
  }

  /**
   * Every column, with its type resolved through any domain over it.
   *
   * `format_type` gives the name a person wrote (`numeric(12,3)`, `text[]`) and
   * is what the TODO for an unmapped type quotes back; the base `typname` is
   * what the mapping reads, so a domain over `text` is a string rather than an
   * unknown.
   */
  private async columns(): Promise<ColumnRow[]> {
    return await this.sql`
      select
        c.relname as table_name,
        a.attname as name,
        format_type(a.atttypid, a.atttypmod) as sql_type,
        coalesce(bt.typname, t.typname) as udt,
        coalesce(bt.typtype, t.typtype) as type_class,
        coalesce(nullif(t.typbasetype, 0), a.atttypid) as base_oid,
        col_description(c.oid, a.attnum) as comment
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_type t on t.oid = a.atttypid
      left join pg_type bt on bt.oid = nullif(t.typbasetype, 0)
      where n.nspname = ${this.schema}
        and c.relkind in ('r', 'p')
        and a.attnum > 0
        and not a.attisdropped
      order by c.relname, a.attnum
    `;
  }

  /** Enum labels in declaration order, by type oid. */
  private async enums(): Promise<Map<number, string[]>> {
    const rows: Array<{ type_oid: number; label: string }> = await this.sql`
      select e.enumtypid as type_oid, e.enumlabel as label
      from pg_enum e
      order by e.enumtypid, e.enumsortorder
    `;
    const out = new Map<number, string[]>();
    for (const row of rows) {
      const bucket = out.get(row.type_oid);
      if (bucket === undefined) out.set(row.type_oid, [row.label]);
      else bucket.push(row.label);
    }
    return out;
  }

  private async primaryKeys(): Promise<Map<string, string[]>> {
    const rows: Array<{ table_name: string; column_name: string }> = await this.sql`
      select c.relname as table_name, a.attname as column_name
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral unnest(con.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      where con.contype = 'p' and n.nspname = ${this.schema}
      order by c.relname, k.ord
    `;
    const out = new Map<string, string[]>();
    for (const row of rows) {
      const bucket = out.get(row.table_name);
      if (bucket === undefined) out.set(row.table_name, [row.column_name]);
      else bucket.push(row.column_name);
    }
    return out;
  }

  /**
   * Foreign keys with both sides as ordered column lists.
   *
   * `confkey[k.ord]` pairs the referencing column with the referenced one at
   * the same position, which is the only correct pairing: Postgres stores the
   * two arrays in matching order, and joining on `attnum` alone would pair them
   * by table order instead and quietly produce the wrong edge for a composite
   * key whose columns were declared in a different sequence.
   */
  private async foreignKeys(): Promise<CatalogForeignKey[]> {
    const rows: Array<{
      name: string;
      from_table: string;
      from_column: string;
      to_table: string;
      to_column: string;
    }> = await this.sql`
      select
        con.conname as name,
        c.relname as from_table,
        a.attname as from_column,
        fc.relname as to_table,
        fa.attname as to_column
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_class fc on fc.oid = con.confrelid
      cross join lateral unnest(con.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      join pg_attribute fa on fa.attrelid = con.confrelid
        and fa.attnum = con.confkey[k.ord]
      where con.contype = 'f' and n.nspname = ${this.schema}
      order by con.conname, k.ord
    `;
    const out = new Map<string, CatalogForeignKey>();
    for (const row of rows) {
      const found = out.get(row.name);
      if (found === undefined) {
        out.set(row.name, {
          name: row.name,
          from: { table: row.from_table, columns: [row.from_column] },
          to: { table: row.to_table, columns: [row.to_column] },
        });
      } else {
        (found.from.columns as string[]).push(row.from_column);
        (found.to.columns as string[]).push(row.to_column);
      }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Single-column `CHECK` constraints that are a membership test, as value lists. */
  private async checks(): Promise<Map<string, string[]>> {
    const rows: Array<{ table_name: string; column_name: string; def: string }> =
      await this.sql`
      select
        c.relname as table_name,
        a.attname as column_name,
        pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.contype = 'c'
        and n.nspname = ${this.schema}
        and array_length(con.conkey, 1) = 1
      order by c.relname, a.attname
    `;
    const out = new Map<string, string[]>();
    for (const row of rows) {
      const values = membership(row.def);
      if (values !== null) out.set(`${row.table_name}.${row.column_name}`, values);
    }
    return out;
  }
}

interface ColumnRow {
  table_name: string;
  name: string;
  sql_type: string;
  udt: string;
  /** `pg_type.typtype`. `"e"` is an enum, which is the only class that matters here. */
  type_class: string;
  base_oid: number;
  comment: string | null;
}

/**
 * The Postgres type names this package can answer for, and the answer.
 *
 * Everything absent is `"unknown"` on purpose. `json`, `interval`, `bytea`,
 * `time`, an array and a PostGIS geometry are all real types with no single
 * `ColumnDef["as"]` — what a driver hands back for them depends on the driver —
 * and a guess here would be a binding error at the first predicate rather than
 * a comment in a file. `inet` and `uuid` are in because every Postgres driver
 * returns them as strings, which is exactly what `as: "string"` claims.
 */
const TYPES: Readonly<Record<string, ProvenType>> = {
  int2: "number",
  int4: "number",
  int8: "number",
  numeric: "number",
  float4: "number",
  float8: "number",
  oid: "number",
  money: "number",
  text: "string",
  varchar: "string",
  bpchar: "string",
  char: "string",
  name: "string",
  uuid: "string",
  citext: "string",
  inet: "string",
  cidr: "string",
  macaddr: "string",
  bool: "boolean",
  timestamp: "datetime",
  timestamptz: "datetime",
  date: "date",
};

function provenType(row: ColumnRow): ProvenType {
  // An enum type binds a string whatever it is called, so it is answered by
  // class rather than by name — the table below could never list a type a
  // migration invented this morning.
  if (row.type_class === "e") return "string";
  return TYPES[row.udt] ?? "unknown";
}

const ANY_ARRAY = /=\s*ANY\s*\(+\s*ARRAY\s*\[([^\]]*)\]/i;
const IN_LIST = /\bIN\s*\(([^)]*)\)/i;
const LITERAL = /'((?:[^']|'')*)'/g;

/**
 * The values of a `CHECK` that is nothing but a membership test, or `null`.
 *
 * Postgres rewrites `IN (...)` into `= ANY (ARRAY[...])` and casts each literal
 * to the column's type, so the constraint text is the two shapes below with
 * `::text` and `::character varying` scattered through it. Both are read, and
 * anything with a conjunction in it is refused — `CHECK (tier = ANY (...) AND
 * active)` enumerates the values of one predicate and not of the column, and
 * emitting its literals as `values` would tell the linker a lie it cannot see.
 */
export function membership(def: string): string[] | null {
  const match = ANY_ARRAY.exec(def) ?? IN_LIST.exec(def);
  if (match === null) return null;
  const rest = def.replace(match[0], "");
  if (/\b(?:AND|OR|NOT)\b/i.test(rest)) return null;
  const values: string[] = [];
  const body = match[1] as string;
  LITERAL.lastIndex = 0;
  for (let m = LITERAL.exec(body); m !== null; m = LITERAL.exec(body)) {
    values.push((m[1] as string).replaceAll("''", "'"));
  }
  return values.length === 0 ? null : values;
}
