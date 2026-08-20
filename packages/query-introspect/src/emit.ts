import { type ColumnAnnotation, columnAnnotation, tableAnnotation } from "./annotation";
import type { Catalog, CatalogColumn, CatalogTable, ProvenType } from "./catalog";
import { AnnotationError } from "./errors";
import { geoHint, hintFor } from "./hints";

export interface EmitOptions {
  /** The exported binding's name. `schema` by default. */
  readonly name?: string;
  /** Where the catalogue came from, for the header. Never a URL with a password. */
  readonly source?: string;
  /** Tables to leave out entirely, by name. */
  readonly exclude?: readonly string[];
}

/** How a literal binds against a column. `@smartput/query`'s `ColumnDef["as"]`. */
export type Binding = "number" | "string" | "boolean" | "date";

/** Biome's line width, which the generated file has to pass unedited. */
const WIDTH = 90;

/**
 * The binding `@smartput/query` would default to for a column with these
 * fields, which is a copy of `bindingOf` in `packages/query/src/link.ts`.
 *
 * A copy rather than an import, and the trade is worth stating: importing it
 * would give this package a runtime dependency on `@smartput/query`, and the
 * hardest constraint on this package is that the arrow between the two runs one
 * way — it writes a file, `query` reads an object. The rule is four lines and
 * has not moved since the package shipped, and `holiday` carries its own copy
 * of core's edit-distance scorer for the same reason. What it costs is that a
 * change to the default over there is a change to make here; `drift.test.ts`
 * pins the four cases so the divergence is a failing test and not a wrong file.
 */
function defaultBinding(def: { kind?: string; unit?: string }): Binding {
  if (def.kind === "datetime" || def.kind === "date") return "date";
  if (def.unit !== undefined) return "number";
  return "string";
}

/** How a literal binds against a column of this type, or `null` for no claim. */
export function provenBinding(type: ProvenType): Binding | null {
  switch (type) {
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "datetime":
    case "date":
      return "date";
    default:
      return null;
  }
}

/** The `kind` a type proves outright, which is only ever one of the two temporal ones. */
export function provenKind(type: ProvenType): "datetime" | "date" | null {
  return type === "datetime" || type === "date" ? type : null;
}

const quote = (s: string): string => JSON.stringify(s);

/** Appends the trailing comma an emitted literal needs in its enclosing list. */
function withComma(lines: readonly string[]): string[] {
  const last = lines.length - 1;
  return lines.map((line, i) => (i === last ? `${line},` : line));
}

/** `name: ["a", "b"]`, broken one per line when the single-line form is too wide. */
function arrayField(name: string, items: readonly string[], indent: number): string[] {
  const pad = " ".repeat(indent);
  const flat = `${name}: [${items.map(quote).join(", ")}]`;
  if (indent + flat.length + 1 <= WIDTH) return [`${pad}${flat}`];
  return [`${pad}${name}: [`, ...items.map((i) => `${pad}  ${quote(i)},`), `${pad}]`];
}

/**
 * An object literal, on one line when it fits and one field per line when it
 * does not — which is the choice Biome makes, so the emitted file survives
 * `bun run lint` without a reformat. `fields` are already-rendered `k: v`
 * fragments; a fragment that is itself multi-line forces the broken form.
 */
function object(fields: readonly (readonly string[])[], indent: number): string[] {
  const pad = " ".repeat(indent);
  const flat = fields.flat();
  if (fields.every((f) => f.length === 1)) {
    const line = `{ ${flat.map((f) => f.trim()).join(", ")} }`;
    if (indent + line.length + 1 <= WIDTH) return [`${pad}${line}`];
  }
  return [`${pad}{`, ...flat.map((f) => `${pad}  ${f.trim()},`), `${pad}}`];
}

/** `geo: { … }` — an already-rendered literal reopened as a named field. */
function namedField(name: string, lines: readonly string[], indent: number): string[] {
  const [first = "", ...rest] = lines;
  return withComma([`${" ".repeat(indent)}${name}: ${first.trim()}`, ...rest]);
}

/** Why the emitter leaves a table out. `note` is `null` when nobody asked to be told. */
export interface Skip {
  readonly table: string;
  readonly note: string | null;
}

/**
 * Whether the emitter would leave this table out of the file, and why.
 *
 * Shared with `--check` rather than reimplemented there, because the two have
 * to agree exactly: drift is "the database moved and the file did not", so a
 * table the generator would never have written is not drift when it is missing.
 * A single source for that judgement is what keeps `--check` from going red
 * forever over a table it is itself the reason for.
 */
export function skipped(table: CatalogTable, exclude: ReadonlySet<string>): Skip | null {
  if (exclude.has(table.name)) return { table: table.name, note: null };
  const annotation = tableAnnotation(table.name, table.comment);
  if (annotation?.ignore === true) return { table: table.name, note: null };
  if (table.primaryKey.length === 0 && annotation?.key === undefined) {
    // Refused rather than guessed, and this is the only whole-table refusal.
    // `TableDef.key` is not optional: it is what `count` counts and what an
    // aggregate groups by when the sentence did not say. Any column picked here
    // would silently decide both. A person picks one — by adding a primary key,
    // by annotating the table, or by writing the table into the file by hand —
    // and this note keeps saying so until one of those happens, which is the
    // shape ruling R7 asks for.
    return {
      table: table.name,
      note: `${table.name} has no primary key, so it has no TableDef.key and is not in the file. Add one in the database, or annotate the table \`@smartput key=<column>\`.`,
    };
  }
  return null;
}

/**
 * Turns a catalogue into a `defineSchema({...})` module.
 *
 * A class rather than a function because emitting is a walk that accumulates
 * something the caller needs back — every table it refused to describe and
 * every foreign key it refused to turn into an edge — and threading that
 * through a chain of pure functions means a mutable argument or a tuple return
 * at each level. The functions are still there underneath; `emit()` is the door.
 */
export class SchemaEmitter {
  /** What the emitter would not write, and why. The CLI prints these to stderr. */
  readonly notes: string[] = [];
  private readonly exclude: ReadonlySet<string>;

  constructor(
    private readonly catalog: Catalog,
    private readonly options: EmitOptions = {},
  ) {
    this.exclude = new Set(options.exclude ?? []);
  }

  /** The module source, formatted the way Biome would format it. */
  emit(): string {
    this.notes.length = 0;
    const kept = this.catalog.tables.filter((t) => this.keeps(t));
    const lines: string[] = [
      ...this.header(),
      "",
      `import { defineSchema, type Schema } from "@smartput/query";`,
      "",
      `export const ${this.options.name ?? "schema"}: Schema = defineSchema({`,
      "  tables: [",
    ];
    for (const table of kept) lines.push(...this.table(table));
    lines.push("  ],");
    lines.push(...this.joins(kept));
    lines.push(...METRICS);
    lines.push("});");
    return `${lines.join("\n")}\n`;
  }

  /** Every table the emitter can describe. The rest are recorded in `notes`. */
  private keeps(table: CatalogTable): boolean {
    const skip = skipped(table, this.exclude);
    if (skip === null) return true;
    if (skip.note !== null) this.notes.push(skip.note);
    return false;
  }

  private header(): string[] {
    const from = this.options.source === undefined ? "" : ` (${this.options.source})`;
    return [
      `// Generated by @smartput/query-introspect from a ${this.catalog.dialect} catalogue${from}.`,
      "//",
      "// This file is yours. Edit it, commit it, and keep editing it: regeneration",
      "// refuses to overwrite it without --force, and `--check` reads it back and",
      "// compares it against the live database, so a migration cannot walk away from it",
      "// unnoticed.",
      "//",
      "// What a catalogue proves is here: table and column names, primary keys, foreign",
      "// keys as join edges, enumerated values, and the two kinds a type settles —",
      "// `datetime` for a timestamp and `date` for a date.",
      "//",
      "// What it cannot prove is not here, and no version of it was guessed. Every ratio",
      "// kind — money, mass, percent — needs a unit, and nothing in a catalogue says",
      "// whether `total_cents` counts money or counts cents. Nor are the words people",
      "// type: `aliases`, `labels` and `metrics` decide whether a sentence links at all,",
      "// and they are a human's to write.",
      "//",
      "// The TODO lines below are name-shaped hints, never applied. To answer one",
      "// permanently, put the answer in the database, where regeneration cannot lose it:",
      "//",
      "//   COMMENT ON COLUMN orders.total_cents IS",
      "//     '@smartput kind=money unit=usd scale=100 aliases=total, amount';",
    ];
  }

  private table(table: CatalogTable): string[] {
    const annotation = tableAnnotation(table.name, table.comment);
    const key = annotation?.key ?? (table.primaryKey[0] as string);
    const columns = table.columns.filter(
      (c) => columnAnnotation(`${table.name}.${c.name}`, c.comment)?.ignore !== true,
    );
    if (!columns.some((c) => c.name === key)) {
      throw new AnnotationError(
        `${table.name}.${key}`,
        "it is this table's key and is not a column the emitted schema has.",
      );
    }

    const out: string[] = ["    {"];
    if (table.primaryKey.length > 1 && annotation?.key === undefined) {
      // The composite case is emitted rather than refused: which columns
      // identify a row is proved, and only which *one* of them stands in for
      // the row is open. Dropping the table instead would take its foreign keys
      // out of the join graph with it, which is a far larger silence.
      out.push(
        `      // TODO: the primary key is (${table.primaryKey.join(", ")}). TableDef.key names`,
        "      // one column — it is what `count` counts and what an aggregate groups by.",
      );
    }
    out.push(`      name: ${quote(table.name)},`);
    if (annotation?.aliases !== undefined) {
      out.push(...withComma(arrayField("aliases", annotation.aliases, 6)));
    }
    out.push(`      key: ${quote(key)},`);
    if (annotation?.labels !== undefined) {
      out.push(...withComma(arrayField("labels", annotation.labels, 6)));
    }
    out.push("      columns: [");
    for (const column of columns) out.push(...this.column(table, column));
    out.push("      ],");
    out.push(...this.geo(annotation?.geo, columns));
    out.push("    },");
    return out;
  }

  private geo(
    declared: { lat: string; lon: string; point?: string } | undefined,
    columns: readonly CatalogColumn[],
  ): string[] {
    if (declared !== undefined) {
      const fields = [
        [`lat: ${quote(declared.lat)}`],
        [`lon: ${quote(declared.lon)}`],
        ...(declared.point === undefined ? [] : [[`point: ${quote(declared.point)}`]]),
      ];
      return namedField("geo", object(fields, 6), 6);
    }
    const hint = geoHint(columns);
    if (hint === null) return [];
    return [
      `      // TODO: \`${hint.lat}\`/\`${hint.lon}\` look like a position. Declaring`,
      `      // geo: { lat: ${quote(hint.lat)}, lon: ${quote(hint.lon)} } is what turns on \`near\`.`,
    ];
  }

  private column(table: CatalogTable, column: CatalogColumn): string[] {
    const target = `${table.name}.${column.name}`;
    const annotation = columnAnnotation(target, column.comment) ?? {};
    return [
      ...this.todo(column, annotation),
      ...withComma(object(this.fields(column, annotation), 8)),
    ];
  }

  /** The TODO a column's name earns, and only when the answer is not already known. */
  private todo(column: CatalogColumn, annotation: ColumnAnnotation): string[] {
    if (annotation.kind !== undefined) return [];
    const hint = hintFor(column);
    if (hint !== null) {
      const out = [`        // TODO: \`${hint.token}\` suggests ${hint.suggests}`];
      if (hint.caveat !== undefined) out.push(`        // — ${hint.caveat}.`);
      return out;
    }
    if (column.type === "unknown") {
      // Not a hint, a hole: the type is real and this package has no binding
      // for it, so the column is emitted with no `as` at all and says so.
      return [
        `        // TODO: \`${column.sqlType}\` has no ColumnDef binding here. Give it an \`as\``,
        "        // if a driver hands it back as a number, string, boolean or Date.",
      ];
    }
    return [];
  }

  private fields(column: CatalogColumn, annotation: ColumnAnnotation): string[][] {
    const kind = annotation.kind ?? provenKind(column.type) ?? undefined;
    const unit = annotation.unit;
    const proven = provenBinding(column.type);
    const implied = defaultBinding({
      ...(kind === undefined ? {} : { kind }),
      ...(unit === undefined ? {} : { unit }),
    });
    // `as` is written out whenever the column has no `kind`, because then it is
    // the only record in the file of what the database said, and it is what
    // `--check` compares a later catalogue against. With a `kind` present the
    // kind already decides the binding, so `as` is written only where the
    // catalogue disagrees with it — `@smartput kind=percent` on a numeric
    // column, where the default would be `string` and the rows would be text.
    let as: Binding | undefined;
    if (annotation.as !== undefined) as = annotation.as;
    else if (kind === undefined) as = proven ?? undefined;
    else if (proven !== null && proven !== implied) as = proven;

    const fields: string[][] = [[`name: ${quote(column.name)}`]];
    if (annotation.aliases !== undefined) {
      fields.push(arrayField("aliases", annotation.aliases, 0));
    }
    if (kind !== undefined) fields.push([`kind: ${quote(kind)}`]);
    if (unit !== undefined) fields.push([`unit: ${quote(unit)}`]);
    if (annotation.scale !== undefined) fields.push([`scale: ${annotation.scale}`]);
    if (as !== undefined) fields.push([`as: ${quote(as)}`]);
    const values = annotation.values ?? column.values;
    if (values !== undefined) fields.push(arrayField("values", values, 0));
    return fields;
  }

  private joins(kept: readonly CatalogTable[]): string[] {
    const names = new Set(kept.map((t) => t.name));
    const edges: string[] = [];
    for (const fk of this.catalog.foreignKeys) {
      if (fk.from.columns.length > 1 || fk.to.columns.length > 1) {
        // A `JoinEdge` is one equality. A composite key needs every pair to
        // hold at once, and emitting the pairs as separate edges would be worse
        // than emitting none: two edges between one pair of tables is what the
        // linker reads as two join paths, so it would refuse the query rather
        // than report this.
        this.notes.push(
          `${fk.name} is a composite foreign key (${fk.from.table} → ${fk.to.table}) and has no single JoinEdge. Write the join by hand if the query layer needs it.`,
        );
        continue;
      }
      if (!names.has(fk.from.table) || !names.has(fk.to.table)) {
        this.notes.push(
          `${fk.name} points at a table that is not in the file (${fk.from.table} → ${fk.to.table}), so its join edge is not either.`,
        );
        continue;
      }
      const from = `${fk.from.table}.${fk.from.columns[0] as string}`;
      const to = `${fk.to.table}.${fk.to.columns[0] as string}`;
      edges.push(`${from}|${to}`);
    }
    if (edges.length === 0) return [];
    const out = ["  joins: ["];
    for (const edge of [...new Set(edges)].sort()) {
      const [from = "", to = ""] = edge.split("|");
      out.push(...withComma(object([[`from: ${quote(from)}`], [`to: ${quote(to)}`]], 4)));
    }
    out.push("  ],");
    return out;
  }
}

/**
 * The metrics block, commented out rather than omitted.
 *
 * A catalogue has no idea what a business calls a number. Leaving the field out
 * would be honest and would also leave the single highest-value edit in the
 * file undiscoverable; a worked example in a comment costs nothing and is where
 * a reader looks first.
 */
const METRICS: readonly string[] = [
  "  // Nobody types `sum of total_cents`; they type `revenue`. A metric is the name",
  "  // your team already uses, and no catalogue holds one.",
  "  //",
  "  // metrics: [",
  '  //   { name: "revenue", aliases: ["spend"], fn: "sum", column: "orders.total_cents" },',
  '  //   { name: "order_count", fn: "count", table: "orders" },',
  "  // ],",
];
