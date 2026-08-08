import { type KindId, nearestWord } from "@smartput/core";
import { AmbiguousJoinError, SchemaError } from "./errors";
import type { AggregateFn, ColumnRef, JoinStep } from "./ir";

/**
 * What a column stores, and how a value typed at it should be read.
 *
 * `kind` is the whole schema-linking signal (ruling R8): it is a smartput
 * `KindId`, so a column declaring `"money"` accepts whatever the injected
 * engine reads as money — `€500`, `500 usd`, `five hundred euros` — without
 * this package owning a single currency name. Omitting it makes the column free
 * text, which is the right answer for `email` and the wrong one for `total`.
 *
 * `unit` is ruling R4's half of the bargain. A column of a ratio kind must say
 * what it stores, because "500" in a column of cents and "500" in a column of
 * dollars are different rows and nothing in the input can tell them apart.
 */
export interface ColumnDef {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly kind?: KindId;
  /** The unit the column stores. Required whenever `kind` names a ratio kind. */
  readonly unit?: string;
  /**
   * How many of `unit` one stored number is worth. `total_cents` is
   * `{ kind: "money", unit: "usd", scale: 100 }`.
   *
   * Separate from `unit` because a minor unit is usually not a unit the engine
   * knows — the money kind's units are ISO 4217 codes and there is no "cent"
   * among them — so the alternative was asking every schema author to register
   * a currency subunit with the engine before they could filter on a price.
   */
  readonly scale?: number;
  /**
   * How the literal reaches a driver. Defaults from `kind`: a datetime column
   * binds a `Date`, anything with a `unit` binds a number, everything else
   * binds a string.
   */
  readonly as?: "number" | "string" | "boolean" | "date";
  /**
   * The column's enumerated values. Declaring them is what lets `status is
   * pending` link without asking the engine anything — an engine has no kind
   * for "the words this column happens to contain", and inventing one per
   * schema would mean building a registry per query.
   */
  readonly values?: readonly string[];
}

/**
 * How a table is positioned on the globe.
 *
 * Two scalar columns is the relational answer and one indexed field is the
 * document answer, so both are declarable and a table may carry either or both.
 * A schema that declares only `lat`/`lon` compiles to SQL and is refused by the
 * Mongo compiler, which says so rather than emitting a scan.
 */
export interface GeoDef {
  readonly lat: string;
  readonly lon: string;
  /** A GeoJSON point or legacy pair field — what `$geoWithin` reads. */
  readonly point?: string;
}

export interface TableDef {
  readonly name: string;
  readonly aliases?: readonly string[];
  /**
   * The primary key. Used for `count`, and as the identity an aggregate groups
   * by when the query asks for one without saying what to group on — `top 10
   * customers by revenue` groups by the customer, and this is the column that
   * says which one that is.
   */
  readonly key: string;
  /** Columns that name a row for a human. Grouped alongside `key`. */
  readonly labels?: readonly string[];
  readonly columns: readonly ColumnDef[];
  readonly geo?: GeoDef;
}

/**
 * A named aggregate — "revenue" is `sum(orders.total_cents)`.
 *
 * Metrics exist because the interesting half of a schema's vocabulary is not
 * its column names. Nobody types `sum of total_cents`; they type `revenue`, and
 * a rules-only parser that cannot be told that word has already lost the query.
 */
export interface MetricDef {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly fn: AggregateFn;
  /** `"orders.total_cents"`. Omitted only for `count`. */
  readonly column?: string;
  /** `"orders"`. Required when `column` is omitted, ignored otherwise. */
  readonly table?: string;
}

/**
 * One undirected equality edge. Undirected because `orders.customer_id =
 * customers.id` is the same fact from either end, and a directed graph would
 * make `customers with orders` reachable while `orders from customers` was not.
 */
export interface JoinEdge {
  readonly from: string;
  readonly to: string;
}

export interface QuerySchemaDef {
  readonly tables: readonly TableDef[];
  readonly joins?: readonly JoinEdge[];
  readonly metrics?: readonly MetricDef[];
}

export type LexEntry =
  | { readonly type: "table"; readonly table: string }
  | { readonly type: "column"; readonly ref: ColumnRef }
  | { readonly type: "metric"; readonly metric: MetricDef };

/** Longest alias phrase the index holds, in words. Bounds the linker's scan. */
const MAX_PHRASE_WORDS = 4;

const fold = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The two surface forms of one alias, so a schema author writes `orders` once.
 *
 * Deliberately not a stemmer. Core already ships `suffixStripper` for analyzer
 * chains, and reaching for it here would mean the query layer folded words a
 * second, differently-configured time — the failure core's own comment about
 * two implementations of "how near is this" warns about. A schema author whose
 * plural is irregular writes both aliases, which is one line and always right.
 */
function inflections(alias: string): string[] {
  const a = fold(alias);
  if (a.length === 0) return [];
  if (a.endsWith("ies")) return [a, `${a.slice(0, -3)}y`];
  if (/(?:s|x|z|ch|sh)es$/.test(a)) return [a, a.slice(0, -2)];
  if (a.endsWith("s")) return [a, a.slice(0, -1)];
  if (/(?:s|x|z|ch|sh)$/.test(a)) return [a, `${a}es`];
  if (a.endsWith("y")) return [a, `${a.slice(0, -1)}ies`];
  return [a, `${a}s`];
}

function splitRef(ref: string, what: string): ColumnRef {
  const dot = ref.indexOf(".");
  if (dot <= 0 || dot === ref.length - 1) {
    throw new SchemaError(`${what} must be written "table.column"; got "${ref}".`);
  }
  return { table: ref.slice(0, dot), column: ref.slice(dot + 1) };
}

/**
 * The schema as the linker needs it: an alias index over tables, columns and
 * metrics, and a join graph that answers with a path or refuses.
 *
 * A class rather than a bag of functions because every method needs the two
 * indexes and building them per call would walk the whole schema per keystroke
 * — the same reason core's `Registry` is built once and handed to every stage.
 */
export class Schema {
  readonly tables: ReadonlyMap<string, TableDef>;
  readonly metrics: readonly MetricDef[];
  private readonly index: Map<string, LexEntry[]>;
  private readonly edges: Map<string, Array<{ from: ColumnRef; to: ColumnRef }>>;

  constructor(readonly def: QuerySchemaDef) {
    const tables = new Map<string, TableDef>();
    for (const t of def.tables) {
      if (tables.has(t.name)) throw new SchemaError(`Two tables named "${t.name}".`);
      if (!t.columns.some((c) => c.name === t.key)) {
        throw new SchemaError(
          `Table "${t.name}" has no column "${t.key}" to be its key.`,
        );
      }
      tables.set(t.name, t);
    }
    this.tables = tables;
    this.metrics = def.metrics ?? [];

    this.index = new Map();
    for (const t of def.tables) {
      this.add(t.name, { type: "table", table: t.name });
      for (const a of t.aliases ?? []) this.add(a, { type: "table", table: t.name });
      for (const c of t.columns) {
        const entry: LexEntry = {
          type: "column",
          ref: { table: t.name, column: c.name },
        };
        this.add(c.name, entry);
        // Column names are written for a database and read by a person:
        // `total_cents` and `placed_at` are two words each, and a user typing
        // "placed at" would otherwise miss a column whose name they typed
        // correctly. Underscores fold to spaces beside the raw name, never
        // instead of it.
        if (c.name.includes("_")) this.add(c.name.replaceAll("_", " "), entry);
        for (const a of c.aliases ?? []) this.add(a, entry);
      }
    }
    for (const m of this.metrics) {
      if (m.column === undefined && m.table === undefined) {
        throw new SchemaError(
          `Metric "${m.name}" declares neither a column nor a table.`,
        );
      }
      if (m.column !== undefined) this.column(splitRef(m.column, `Metric "${m.name}"`));
      if (m.table !== undefined && !tables.has(m.table)) {
        throw new SchemaError(`Metric "${m.name}" names unknown table "${m.table}".`);
      }
      const entry: LexEntry = { type: "metric", metric: m };
      this.add(m.name, entry);
      for (const a of m.aliases ?? []) this.add(a, entry);
    }

    this.edges = new Map();
    for (const e of def.joins ?? []) {
      const from = splitRef(e.from, "Join edge");
      const to = splitRef(e.to, "Join edge");
      // Checked for existence, discarded: the edge travels as a reference, and
      // this call is what turns a typo in the schema into an error at
      // construction rather than a join onto a column that is not there.
      this.column(from);
      this.column(to);
      this.edge(from, to);
      this.edge(to, from);
    }
  }

  private add(alias: string, entry: LexEntry): void {
    for (const form of inflections(alias)) {
      if (form.split(" ").length > MAX_PHRASE_WORDS) continue;
      const bucket = this.index.get(form);
      if (bucket === undefined) this.index.set(form, [entry]);
      // One alias meaning two things is not an error here — `total` may be a
      // column on two tables, and which one is meant is a question the linker
      // answers from the tables in scope. It becomes an error only if scope
      // fails to narrow it, and then it is the user's input that is ambiguous.
      else if (!bucket.some((b) => same(b, entry))) bucket.push(entry);
    }
  }

  private edge(from: ColumnRef, to: ColumnRef): void {
    const bucket = this.edges.get(from.table);
    if (bucket === undefined) this.edges.set(from.table, [{ from, to }]);
    else bucket.push({ from, to });
  }

  /** Every entry the index holds for a folded phrase. Empty when unknown. */
  lookup(phrase: string): readonly LexEntry[] {
    return this.index.get(fold(phrase)) ?? [];
  }

  /** Alias phrases nearest to a word, for an `UnknownColumnError`'s hint. */
  nearest(word: string): string[] {
    const hit = nearestWord(fold(word), [...this.index.keys()]);
    return hit === null ? [] : [hit];
  }

  table(name: string): TableDef {
    const t = this.tables.get(name);
    if (t === undefined) throw new SchemaError(`Unknown table "${name}".`);
    return t;
  }

  column(ref: ColumnRef): ColumnDef {
    const t = this.table(ref.table);
    const c = t.columns.find((x) => x.name === ref.column);
    if (c === undefined) {
      throw new SchemaError(`Table "${ref.table}" has no column "${ref.column}".`);
    }
    return c;
  }

  /** The columns a row of `table` is identified by when an aggregate forces a group. */
  identity(table: string): ColumnRef[] {
    const t = this.table(table);
    return [t.key, ...(t.labels ?? [])].map((column) => ({ table, column }));
  }

  /**
   * The unique shortest join path between two tables, as ordered hops.
   *
   * Breadth-first, and it collects *every* path at the winning depth rather
   * than the first one found — ruling R5 turns on being able to see that there
   * were two. Returning the first would make the ambiguity invisible, which is
   * the whole failure the ruling is about.
   */
  path(input: string, from: string, to: string): JoinStep[] {
    if (from === to) return [];
    let frontier: Array<{ table: string; steps: JoinStep[] }> = [
      { table: from, steps: [] },
    ];
    const seen = new Set<string>([from]);
    for (let depth = 0; depth < this.tables.size && frontier.length > 0; depth++) {
      const next: Array<{ table: string; steps: JoinStep[] }> = [];
      const arrived: JoinStep[][] = [];
      for (const node of frontier) {
        for (const { from: left, to: right } of this.edges.get(node.table) ?? []) {
          const steps = [...node.steps, { from: left, to: right, table: right.table }];
          if (right.table === to) arrived.push(steps);
          else if (!seen.has(right.table)) next.push({ table: right.table, steps });
        }
      }
      if (arrived.length === 1) return arrived[0] as JoinStep[];
      if (arrived.length > 1) {
        throw new AmbiguousJoinError(input, from, to, arrived.map(render));
      }
      for (const node of next) seen.add(node.table);
      frontier = next;
    }
    throw new AmbiguousJoinError(input, from, to, []);
  }
}

const same = (a: LexEntry, b: LexEntry): boolean => {
  if (a.type !== b.type) return false;
  if (a.type === "table" && b.type === "table") return a.table === b.table;
  if (a.type === "column" && b.type === "column") {
    return a.ref.table === b.ref.table && a.ref.column === b.ref.column;
  }
  if (a.type === "metric" && b.type === "metric") return a.metric.name === b.metric.name;
  return false;
};

const render = (steps: readonly JoinStep[]): string =>
  steps
    .map((s) => `${s.from.table}.${s.from.column} → ${s.to.table}.${s.to.column}`)
    .join(", ");

/**
 * The schema as a value, so a consumer writes one literal and hands it around.
 *
 * A factory beside the constructor for the reason `definePlace` is one: the
 * class is the thing with behaviour, and a caller who only wants to *declare* a
 * schema should not have to know that.
 */
export const defineSchema = (def: QuerySchemaDef): Schema => new Schema(def);
