import { Decimal, type Engine, type Result, type Value } from "@smartput/core";
import { AmbiguousQueryError, SchemaError, UnknownColumnError } from "./errors";
import type { ColumnRef, Literal, Phrase } from "./ir";
import type { ColumnDef, Schema } from "./schema";

/**
 * Nanoseconds per millisecond. Every instant-valued kind in the repo stores
 * epoch nanoseconds as its canonical — `@smartput/datetime` says so, and
 * `date` and the range kinds inherit it — and a JS `Date` takes milliseconds.
 */
const NS_PER_MS = 1_000_000;

/**
 * The half of a range that a `between` predicate reads, detected structurally.
 *
 * Structural rather than by import, on exactly the precedent core's `PlaceMeta`
 * sets: the shape is the contract, `@smartput/range-core` produces it, and this
 * package reads it without either of them depending on the other. Importing
 * would drag Temporal and the whole calendar into a bundle whose job is to
 * emit a WHERE clause.
 */
export interface RangeEnds {
  readonly start: string;
  readonly end: string;
}

export function rangeOf(value: Value): RangeEnds | null {
  const meta = value.meta;
  if (meta === undefined) return null;
  const { start, end } = meta as { start?: unknown; end?: unknown };
  if (typeof start !== "string" || typeof end !== "string") return null;
  return { start, end };
}

/**
 * True when an instant-valued reading sits exactly at midnight — which is how a
 * phrase that named a *day* is told apart from one that named a time.
 *
 * `yesterday` and `3pm` are both `datetime` readings and mean very different
 * things against a timestamp column: the first is a day to be contained in, the
 * second is an instant to be equal to. The kind cannot distinguish them and the
 * `meta.iso` string can, so this reads it — the same structural-shape rule the
 * two functions around it follow.
 */
export function isMidnight(value: Value): boolean {
  const iso = (value.meta as { iso?: unknown } | undefined)?.iso;
  return typeof iso === "string" && /T00:00:00(?:\.0+)?(?:Z|[+-])/.test(iso);
}

/** A point on the globe, read off `PlaceMeta` the same way and for the same reason. */
export function geoOf(value: Value): { lat: number; lon: number } | null {
  const meta = value.meta;
  if (meta === undefined) return null;
  const { lat, lon } = meta as { lat?: unknown; lon?: unknown };
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return { lat, lon };
}

/**
 * How a fragment of the input was read, with the column it is destined for
 * still open. One per engine reading, in the engine's own ranking.
 */
export interface Reading {
  readonly value: Value;
  readonly confidence: number;
  readonly phrase: Phrase;
}

/**
 * Reads value fragments through the injected engine, converts them into what a
 * column stores, and finds the column when the input did not name one.
 *
 * Every hard question about *values* — is `€500` money, is `last quarter` a
 * range, is `kyiv` a place — is answered by `engine.suggest()`, which is ruling
 * R2: the clause layer finds the boundaries of an operand and knows nothing
 * else about it. What this class adds on top is the two things the engine
 * cannot know, because they are properties of the schema and not of the
 * language: what unit the column stores, and which column was meant.
 */
export class OperandReader {
  private readonly engine: Engine;
  private readonly schema: Schema;
  /** Calibration per `kind|unit`. See `calibrate`. */
  private readonly scales = new Map<string, { zero: Decimal; span: Decimal }>();

  constructor(opts: { engine: Engine; schema: Schema }) {
    this.engine = opts.engine;
    this.schema = opts.schema;
  }

  /** Every reading of a fragment, ranked as the engine ranked them. */
  read(phrase: Phrase): Reading[] {
    const text = phrase.text.trim();
    if (text.length === 0) return [];
    return this.engine
      .suggest(text)
      .map((r: Result) => ({ value: r.value, confidence: r.confidence, phrase }));
  }

  /**
   * The columns in scope whose declared kind a reading could fill — ruling R8's
   * mechanism, and the reason a schema declares kinds at all.
   *
   * `source` is searched first and alone. Widening to joined tables only when
   * the source has no answer is what keeps `orders over €500` reading as the
   * order's own total in a schema where `customers` also has a money column:
   * the nearest table wins, and the widening exists for `customers from
   * ukraine` where the country genuinely lives one hop away.
   */
  columnsForKind(source: string, kind: string): ColumnRef[] {
    const here = this.matching(source, kind);
    if (here.length > 0) return here;
    const out: ColumnRef[] = [];
    for (const table of this.schema.tables.keys()) {
      if (table === source) continue;
      out.push(...this.matching(table, kind));
    }
    return out;
  }

  private matching(table: string, kind: string): ColumnRef[] {
    return this.schema
      .table(table)
      .columns.filter((c) => c.kind === kind)
      .map((c) => ({ table, column: c.name }));
  }

  /**
   * Resolve a phrase against a known column, picking among the engine's
   * readings the one whose kind the column declared.
   *
   * A column with no `kind` never reaches the engine at all: its value is
   * whatever the user typed, and asking an engine to read `gmail` would at best
   * waste a parse and at worst find a unit alias hiding inside it.
   */
  literal(input: string, phrase: Phrase, ref: ColumnRef): Literal {
    const col = this.schema.column(ref);
    const text = phrase.text.trim();
    if (col.kind === undefined) return this.plain(col, text);

    const readings = this.read(phrase).filter((r) => r.value.kind === col.kind);
    const best = readings[0];
    if (best === undefined) {
      // An enumerated column is allowed to answer for itself. `status is
      // pending` has no kind the engine could own — the words are this
      // schema's, not the language's — so a declared value list is checked
      // before the failure is reported.
      if (col.values?.some((v) => v.toLowerCase() === text.toLowerCase())) {
        return this.plain(col, text);
      }
      throw new UnknownColumnError(input, text, this.schema.nearest(text));
    }
    return this.fromValue(col, best.value, text);
  }

  /** Bind a `Value` the caller already resolved — the unattached path (R8). */
  fromValue(col: ColumnDef, value: Value, source: string): Literal {
    const as = bindingOf(col);
    const base = { kind: value.kind, source } as const;
    switch (as) {
      case "date":
        return {
          ...base,
          value: new Date(value.canonical.div(NS_PER_MS).toNumber()),
          decimal: value.canonical,
        };
      case "number": {
        const n = this.stored(col, value);
        return {
          ...base,
          value: n.toNumber(),
          decimal: n,
          ...(col.unit === undefined ? {} : { unit: col.unit }),
        };
      }
      case "boolean":
        return { ...base, value: /^(?:true|yes|y|1)$/i.test(source) };
      default:
        // A place binds its country code, because `PlaceMeta.country` is the
        // Value's own unit and a country column stores exactly that. Everything
        // else binds what was typed.
        return { ...base, value: value.kind === "place" ? value.unit : source };
    }
  }

  private plain(col: ColumnDef, text: string): Literal {
    const as = bindingOf(col);
    if (as === "boolean")
      return { value: /^(?:true|yes|y|1)$/i.test(text), source: text };
    if (as === "number") {
      const d = new Decimal(text);
      return { value: d.toNumber(), decimal: d, source: text };
    }
    return { value: text, source: text };
  }

  /** The value as the column stores it: converted into `unit`, then scaled. */
  private stored(col: ColumnDef, value: Value): Decimal {
    if (col.unit === undefined) return value.canonical;
    const authored = this.toUnit(value, col.unit);
    return col.scale === undefined ? authored : authored.times(col.scale);
  }

  /**
   * A value in a named unit. Public because the geo predicate needs a radius in
   * metres and has no column to read it off — the two columns it compiles
   * against hold degrees, and the distance is neither of them.
   */
  toUnit(value: Value, unit: string): Decimal {
    const { zero, span } = this.calibrate(value.kind, unit);
    return value.canonical.minus(zero).div(span);
  }

  /**
   * Two evaluations of the injected engine — `0 <unit>` and `1 <unit>` — which
   * together invert any unit this repo has: every conversion is `canonical =
   * (authored + offset) * ratio`, affine included, so two points on the line
   * determine it exactly.
   *
   * The alternative was reaching into a `Registry` for the unit's `ratio`
   * function, and it fails on the case that matters most: money's ratios are
   * live rates read out of an injected table, so the only correct answer comes
   * from the same engine that would answer an ordinary conversion. Asking the
   * engine also means a unit this package has never heard of works on the day
   * someone registers it, which is the property that makes the schema's `unit`
   * field a plain string rather than an enum.
   *
   * Cached per `kind|unit`, so a query with ten money predicates calibrates
   * once. A live-rate engine that is rebuilt when rates move gets a new
   * `OperandReader` with it, because `QueryEngine` holds the engine it was
   * constructed with.
   */
  private calibrate(kind: string, unit: string): { zero: Decimal; span: Decimal } {
    const key = `${kind}|${unit}`;
    const hit = this.scales.get(key);
    if (hit !== undefined) return hit;
    let zero: Decimal;
    let one: Decimal;
    try {
      zero = this.engine.coerce(kind, `0 ${unit}`).canonical;
      one = this.engine.coerce(kind, `1 ${unit}`).canonical;
    } catch {
      throw new SchemaError(
        `The engine cannot read "1 ${unit}" as ${kind}, so a column storing ${unit} cannot be converted into. Declare a unit this engine registers, or register the kind that owns it.`,
      );
    }
    const span = one.minus(zero);
    if (span.isZero()) {
      throw new SchemaError(
        `Unit "${unit}" of kind ${kind} has a zero span; it cannot scale.`,
      );
    }
    const out = { zero, span };
    this.scales.set(key, out);
    return out;
  }

  /**
   * Ruling R8. Given the readings of an operand nobody attached to a column,
   * find the column — or say why there isn't one.
   */
  attach(
    input: string,
    source: string,
    readings: readonly Reading[],
  ): {
    ref: ColumnRef;
    reading: Reading;
  } {
    const hits: Array<{ ref: ColumnRef; reading: Reading }> = [];
    for (const reading of readings) {
      for (const ref of this.columnsForKind(source, reading.value.kind)) {
        if (!hits.some((h) => h.ref.table === ref.table && h.ref.column === ref.column)) {
          hits.push({ ref, reading });
        }
      }
    }
    const first = hits[0];
    if (first === undefined) {
      const text = readings[0]?.phrase.text ?? "";
      throw new UnknownColumnError(input, text, this.schema.nearest(text));
    }
    // Several columns of the same kind on the same reading is the tie R8
    // refuses. Several *readings* is not: the engine already ranked those, and
    // its ranking is the answer this package agreed to defer to.
    const tied = hits.filter((h) => h.reading === first.reading);
    if (tied.length > 1) {
      throw new AmbiguousQueryError(
        input,
        `"${first.reading.phrase.text}" could filter more than one column`,
        tied.map((h) => `${h.ref.table}.${h.ref.column}`),
      );
    }
    return first;
  }
}

/** What a column binds, defaulted from its kind when it did not say. */
export function bindingOf(col: ColumnDef): "number" | "string" | "boolean" | "date" {
  if (col.as !== undefined) return col.as;
  if (col.kind === "datetime" || col.kind === "date") return "date";
  if (col.unit !== undefined) return "number";
  return "string";
}
