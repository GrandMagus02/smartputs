/** A successful parse. `raw` is the number exactly as authored, for Decimal handoff. */
export type Ok<U extends string> = {
  readonly ok: true;
  readonly value: number;
  readonly unit: U;
  readonly raw: string;
};

export type ErrCode =
  /** Input was empty or whitespace only. */
  | "empty"
  /** No number could be read. */
  | "nan"
  /** A number was read, no unit followed, and no `defaultUnit` applied. */
  | "missing-unit"
  /** The unit word is not an alias of this table. */
  | "unknown-unit"
  /** `opts.unit` was set and the input named a different unit. */
  | "wrong-unit"
  /** Input continued past the unit. */
  | "trailing";

export type Err = {
  readonly ok: false;
  readonly code: ErrCode;
  readonly input: string;
};

export type Parsed<U extends string> = Ok<U> | Err;

/** Anything an operation accepts in place of an already-parsed value. */
export type Input<U extends string> = string | Ok<U>;

/**
 * Context a dynamic ratio reads. `dpi` is the only member, for `measure`'s
 * `px`; the engine reads the same number off `Value.meta`.
 */
export type Ctx = { readonly dpi?: number };

/**
 * Ratios are decimal **strings**, not numbers: `angle` guards a 30-digit pi
 * against float drift and a shared table cannot be floats without breaking
 * that. This path does `Number(r)`; the engine path does `new Decimal(r)`.
 *
 * A ratio may instead be a function of `Ctx` — `measure`'s `px` is `1/dpi`.
 * That branch costs every kind about fifteen bytes and is the difference
 * between `measure` working here and being a second exclusion.
 */
export interface UnitTable<U extends string> {
  readonly canonical: U;
  readonly ratio: Readonly<Record<U, string | ((ctx: Ctx) => number)>>;
  /** Affine kinds only. `canonical = (v + offset) * ratio`. */
  readonly offset?: Readonly<Partial<Record<U, string>>>;
  /** Lowercase alias -> unit key. Flat, because that is what the parser reads. */
  readonly alias: Readonly<Record<string, U>>;
}

export interface ParseOptions<U extends string> {
  /** Default `"loose"`. See the strict/loose table in the spec. */
  mode?: "strict" | "loose";
  /** Require exactly this unit; anything else is `wrong-unit`. */
  unit?: U;
  /** Loose mode only: a bare number lands on this unit. */
  defaultUnit?: U;
  ctx?: Ctx;
  /** Consulted only after the table's own alias lookup misses. */
  resolve?: (word: string, table: UnitTable<U>) => U | undefined;
}
