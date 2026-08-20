import { AnnotationError } from "./errors";

/**
 * The annotation an author writes into the database itself.
 *
 * ```sql
 * COMMENT ON COLUMN orders.total_cents IS
 *   'Order total, minor units.
 *    @smartput kind=money unit=usd scale=100 aliases=total, amount';
 * ```
 *
 * This is the one channel by which a `kind` reaches the generated file without
 * a human reviewing it afterwards, and it is allowed precisely because a human
 * already did: somebody typed that sentence into a migration. The annotation is
 * the author's knowledge stored where it survives regeneration, a schema
 * rewrite and a change of laptop, which is the property a hand-edited output
 * file does not have.
 *
 * A comment may say anything else it likes; only lines whose first word is
 * `@smartput` are read. That keeps the channel from colliding with the column
 * documentation a team already has.
 */
export interface ColumnAnnotation {
  readonly ignore?: true;
  readonly kind?: string;
  readonly unit?: string;
  readonly scale?: number;
  readonly as?: "number" | "string" | "boolean" | "date";
  readonly values?: readonly string[];
  readonly aliases?: readonly string[];
}

export interface TableAnnotation {
  readonly ignore?: true;
  readonly key?: string;
  readonly aliases?: readonly string[];
  readonly labels?: readonly string[];
  /** `geo=lat,lon` or `geo=lat,lon,point`, in that order. */
  readonly geo?: { readonly lat: string; readonly lon: string; readonly point?: string };
}

type Mutable<T> = { -readonly [K in keyof T]?: T[K] };

const COLUMN_KEYS = ["kind", "unit", "scale", "as", "values", "aliases"] as const;
const TABLE_KEYS = ["key", "aliases", "labels", "geo"] as const;
const BINDINGS = ["number", "string", "boolean", "date"] as const;

/**
 * Every `key=value` pair on the annotation lines of a comment.
 *
 * Values are taken up to the next `key=`, not up to the next space, so
 * `aliases=order, purchase, sale` is one value rather than three fragments —
 * which is how anybody would in fact write it, and a parser that split on
 * whitespace would have silently kept `order,` and dropped the rest.
 */
function pairs(target: string, body: string): Map<string, string> {
  const out = new Map<string, string>();
  const key = /(?:^|\s)([a-z][a-z0-9_]*)=/g;
  const starts: Array<{ name: string; from: number; at: number }> = [];
  for (let m = key.exec(body); m !== null; m = key.exec(body)) {
    starts.push({ name: m[1] as string, from: m.index, at: m.index + m[0].length });
  }
  for (const [i, start] of starts.entries()) {
    const end = starts[i + 1]?.from ?? body.length;
    const value = body.slice(start.at, end).trim();
    if (value.length === 0) {
      throw new AnnotationError(target, `"${start.name}=" has no value.`);
    }
    if (out.has(start.name)) {
      throw new AnnotationError(target, `"${start.name}" is set twice.`);
    }
    out.set(start.name, value);
  }
  // Anything before the first pair that is not the bare `ignore` flag is a
  // typo — `kind money` or `kind: money` would otherwise read as an empty
  // annotation and the column would come out untyped with no complaint.
  const head = (starts[0] === undefined ? body : body.slice(0, starts[0].from)).trim();
  if (head.length > 0) {
    throw new AnnotationError(target, `expected "key=value" pairs, got "${head}".`);
  }
  return out;
}

/** The `@smartput` lines of a comment, joined, with the `ignore` flag lifted out. */
function body(comment: string | undefined): { text: string; ignore: boolean } | null {
  if (comment === undefined) return null;
  const lines = comment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line === "@smartput" || line.startsWith("@smartput "));
  if (lines.length === 0) return null;
  const text = lines.map((line) => line.slice("@smartput".length).trim()).join(" ");
  // `ignore` is the one bare word, so it is removed before the pair parser
  // runs rather than taught to it. `\b` on both sides so a column annotated
  // `unit=ignoreme` is untouched.
  const ignore = /(?:^|\s)ignore(?=\s|$)/.test(text);
  return { text: ignore ? text.replace(/(?:^|\s)ignore(?=\s|$)/g, " ") : text, ignore };
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function reject(target: string, found: Map<string, string>, allowed: readonly string[]) {
  for (const name of found.keys()) {
    if (!allowed.includes(name)) {
      throw new AnnotationError(
        target,
        `unknown key "${name}". This annotation accepts ${allowed.join(", ")}.`,
      );
    }
  }
}

/** Reads a column comment. `null` when it carries no annotation at all. */
export function columnAnnotation(
  target: string,
  comment: string | undefined,
): ColumnAnnotation | null {
  const found = body(comment);
  if (found === null) return null;
  const map = pairs(target, found.text);
  reject(target, map, COLUMN_KEYS);
  if (found.ignore) return { ignore: true };

  const kind = map.get("kind");
  const unit = map.get("unit");
  const scale = map.get("scale");
  const as = map.get("as");
  const values = map.get("values");
  const aliases = map.get("aliases");

  // `unit` is what ruling R4 makes mandatory beside a ratio kind, and it is
  // meaningless without one: a bare `unit=usd` would emit a column the linker
  // never converts, because conversion is keyed off the kind. Same for `scale`,
  // which is "how many `unit` one stored number is worth".
  if (unit !== undefined && kind === undefined) {
    throw new AnnotationError(target, `"unit" without "kind" says nothing.`);
  }
  if (scale !== undefined && unit === undefined) {
    throw new AnnotationError(target, `"scale" without "unit" says nothing.`);
  }
  if (as !== undefined && !(BINDINGS as readonly string[]).includes(as)) {
    throw new AnnotationError(target, `"as=${as}" — expected ${BINDINGS.join(", ")}.`);
  }
  let scaled: number | undefined;
  if (scale !== undefined) {
    scaled = Number(scale);
    if (!Number.isFinite(scaled) || scaled === 0) {
      throw new AnnotationError(target, `"scale=${scale}" is not a non-zero number.`);
    }
  }

  // Assigned rather than spread: under `exactOptionalPropertyTypes` a
  // conditional spread types every field as `T | undefined`, which is exactly
  // what an optional field here must not be.
  const out: Mutable<ColumnAnnotation> = {};
  if (kind !== undefined) out.kind = kind;
  if (unit !== undefined) out.unit = unit;
  if (scaled !== undefined) out.scale = scaled;
  if (as !== undefined) out.as = as as (typeof BINDINGS)[number];
  if (values !== undefined) out.values = list(values);
  if (aliases !== undefined) out.aliases = list(aliases);
  return out;
}

/** Reads a table comment. `null` when it carries no annotation at all. */
export function tableAnnotation(
  target: string,
  comment: string | undefined,
): TableAnnotation | null {
  const found = body(comment);
  if (found === null) return null;
  const map = pairs(target, found.text);
  reject(target, map, TABLE_KEYS);
  if (found.ignore) return { ignore: true };

  const key = map.get("key");
  const aliases = map.get("aliases");
  const labels = map.get("labels");
  const geo = map.get("geo");

  let point: TableAnnotation["geo"];
  if (geo !== undefined) {
    const parts = list(geo);
    const [lat, lon, only] = parts;
    if (lat === undefined || lon === undefined || parts.length > 3) {
      throw new AnnotationError(
        target,
        `"geo=${geo}" — expected lat,lon or lat,lon,point.`,
      );
    }
    point = { lat, lon, ...(only === undefined ? {} : { point: only }) };
  }

  const out: Mutable<TableAnnotation> = {};
  if (key !== undefined) out.key = key;
  if (aliases !== undefined) out.aliases = list(aliases);
  if (labels !== undefined) out.labels = list(labels);
  if (point !== undefined) out.geo = point;
  return out;
}
