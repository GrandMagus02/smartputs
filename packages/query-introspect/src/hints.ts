import type { CatalogColumn, ProvenType } from "./catalog";

/**
 * What a column *name* hints at, expressed as a comment and never as a field.
 *
 * This is the whole of the package's inference, and all of it lands in a
 * `// TODO:` line above the column it is about. `total_cents` is almost always
 * money in cents and occasionally a count of a thing called a cent, and a
 * catalogue cannot tell the two apart; a generated `kind: "money"` that guessed
 * wrong compiles, runs, and returns rows that are silently off by a factor of a
 * hundred. So the suffix is *surfaced*, because a reader who sees the TODO
 * fills it in from the twenty seconds of knowledge they already have, and it is
 * never *acted on*, because the file would otherwise be a set of assertions
 * nobody was ever asked to confirm.
 *
 * An author who is tired of retyping the answer writes it into the database
 * instead — see `annotation.ts`, which is the same knowledge in the one place
 * regeneration cannot lose it.
 */
export interface Hint {
  /** The part of the name that fired, quoted back so the TODO explains itself. */
  readonly token: string;
  /** The `ColumnDef` fields the token suggests, as source text. */
  readonly suggests: string;
  /** An extra clause when the suggestion has a catch. */
  readonly caveat?: string;
}

interface Rule {
  readonly tokens: readonly string[];
  /** Types this rule may fire on. A rule that could contradict a proven type has none. */
  readonly on: readonly ProvenType[];
  readonly suggests: (token: string) => string;
  readonly caveat?: string;
}

const NUMERIC: readonly ProvenType[] = ["number"];
const UNTYPED: readonly ProvenType[] = ["number", "string", "unknown"];

/**
 * `unit` is left as a placeholder wherever the token does not name the unit
 * outright. A suffix says the column counts *something*; it never says in what
 * currency, and writing `"usd"` there would be the confident-guess this package
 * exists to avoid — the placeholder is a thing a reader has to replace, which
 * is the point.
 */
const money = (extra: string) => `{ kind: "money", unit: "<iso4217>"${extra} }`;

const RULES: readonly Rule[] = [
  {
    tokens: ["_cents", "_cent", "_pence", "_pennies", "_minor"],
    on: NUMERIC,
    suggests: () => money(", scale: 100"),
  },
  {
    // No `scale`, because a whole-currency amount stores one of its unit. A
    // column that turns out to hold minor units gets `scale` from the reader,
    // who is the only one who can know.
    tokens: ["price", "total", "amount", "cost", "revenue", "balance", "salary", "fee"],
    on: NUMERIC,
    suggests: () => money(""),
  },
  {
    tokens: ["_kg", "_g", "_mg", "_lb", "_lbs", "_oz", "_t"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "mass", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_m", "_km", "_cm", "_mm", "_mi", "_ft", "_in"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "length", unit: "${t.slice(1)}" }`,
    caveat: "`_m` is also a plausible abbreviation for minutes",
  },
  {
    tokens: [
      "_ms",
      "_s",
      "_sec",
      "_secs",
      "_seconds",
      "_min",
      "_mins",
      "_hours",
      "_days",
    ],
    on: NUMERIC,
    suggests: (t) => `{ kind: "duration", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_bytes", "_kb", "_mb", "_gb", "_tb"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "datasize", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_pct", "_percent", "_percentage", "_rate", "_ratio"],
    on: NUMERIC,
    suggests: () => `{ kind: "percent", unit: "%" }`,
    caveat: "a column storing 0.15 rather than 15 also wants `scale: 0.01`",
  },
  {
    tokens: ["_kmh", "_kph", "_mph"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "speed", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_celsius", "_fahrenheit"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "temperature", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_deg", "_degrees", "_rad"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "angle", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_watts", "_kw", "_w"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "power", unit: "${t.slice(1)}" }`,
  },
  {
    tokens: ["_kwh", "_joules", "_j"],
    on: NUMERIC,
    suggests: (t) => `{ kind: "energy", unit: "${t.slice(1)}" }`,
  },
  {
    // The one rule that fires on text, because a country column stores exactly
    // what a place Value's unit is — an alpha-2 code — and `as: "string"` is
    // already right for it. Only the `kind` is missing.
    tokens: ["country", "country_code", "_country", "nationality"],
    on: ["string"],
    suggests: () => `{ kind: "place" }`,
  },
  {
    // Fires only when the type did *not* already prove an instant: a
    // `timestamptz` named `placed_at` gets `kind: "datetime"` emitted outright
    // and no TODO. A `bigint` named `placed_at` is an epoch nobody converted.
    tokens: ["_at", "_time", "_timestamp"],
    on: UNTYPED,
    suggests: () => `{ kind: "datetime" }`,
    caveat: "the column's type is not a timestamp, so a driver has to hand back a Date",
  },
  {
    tokens: ["_on", "_date"],
    on: UNTYPED,
    suggests: () => `{ kind: "date" }`,
    caveat: "the column's type is not a date, so a driver has to hand back a Date",
  },
];

/**
 * The single best hint for a column, or `null`.
 *
 * Longest token wins, so `total_cents` reads as cents rather than as the
 * `total` rule's whole-currency amount. One hint rather than a ranked list
 * because this is a comment in a file somebody has to read, and three competing
 * TODOs above one column is how a reader learns to skip TODOs.
 */
export function hintFor(column: CatalogColumn): Hint | null {
  const name = column.name.toLowerCase();
  let best: { rule: Rule; token: string } | null = null;
  for (const rule of RULES) {
    if (!rule.on.includes(column.type)) continue;
    for (const token of rule.tokens) {
      const hit = token.startsWith("_") ? name.endsWith(token) : name === token;
      if (!hit) continue;
      if (best === null || token.length > best.token.length) best = { rule, token };
    }
  }
  if (best === null) return null;
  return {
    token: best.token,
    suggests: best.rule.suggests(best.token),
    ...(best.rule.caveat === undefined ? {} : { caveat: best.rule.caveat }),
  };
}

const LAT = ["lat", "latitude"];
const LON = ["lon", "lng", "long", "longitude"];

/**
 * The pair of columns that would make a table's `geo` block, when both are
 * there. Also only ever a comment: two `double precision` columns named `lat`
 * and `lon` are overwhelmingly a position and are occasionally a pair of
 * regression coefficients, and the `near` predicate they would enable is not
 * something to switch on unasked.
 */
export function geoHint(
  columns: readonly CatalogColumn[],
): { lat: string; lon: string } | null {
  const find = (names: readonly string[]) =>
    columns.find((c) => names.includes(c.name.toLowerCase()) && c.type === "number");
  const lat = find(LAT);
  const lon = find(LON);
  if (lat === undefined || lon === undefined) return null;
  return { lat: lat.name, lon: lon.name };
}
