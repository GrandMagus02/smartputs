import { rebase, toCanonical } from "./convert";
import { ValidationError } from "./errors";
import {
  compare as cmp,
  equals as eq,
  format,
  add as opAdd,
  scale as opScale,
  sub as opSub,
} from "./ops";
import { parse } from "./parse";
import type { Ctx, Err, Input, Ok, Parsed, ParseOptions, UnitTable } from "./types";

export interface ValueInstance<U extends string> {
  readonly value: number;
  readonly unit: U;
  /**
   * The context every conversion off this instance resolves against — the one
   * member today is `dpi`, for `measure`'s `px`. Absent on an instance that was
   * never given one, so `toJSON`/structural comparisons are unaffected.
   */
  readonly ctx?: Ctx;

  to(unit: U): number;
  as(unit: U): ValueInstance<U>;

  /**
   * Dynamic-ratio kinds only (`measure`); absent when every ratio in the table
   * is a constant, because there would be nothing for it to change.
   */
  withDpi?(dpi: number): ValueInstance<U>;

  /** Ratio kinds only; absent on an affine kind. */
  add?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;
  sub?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;
  scale?(factor: number): ValueInstance<U>;
  negate?(): ValueInstance<U>;

  /** Affine kinds only. Returns an instance of the paired delta class. */
  diff?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;

  equals(other: Input<U> | ValueInstance<U>, epsilon?: number): boolean;
  compare(other: Input<U> | ValueInstance<U>): -1 | 0 | 1;

  toString(): string;
  toJSON(): { value: number; unit: U };
  /** The canonical magnitude, so `<` and `>` compare correctly. */
  valueOf(): number;
}

/**
 * `V` is the instance type, so a kind whose instances carry more than the base
 * surface — `measure`, with `withDpi` — can say so without redeclaring the
 * statics. It defaults to the base, which is what every other kind wants.
 */
export interface ValueClass<
  U extends string,
  V extends ValueInstance<U> = ValueInstance<U>,
> {
  new (value: number | string, unit: U, ctx?: Ctx): V;
  /** Throws `ValidationError`. */
  parse(input: string, opts?: ParseOptions<U>): V;
  tryParse(input: string, opts?: ParseOptions<U>): V | Err;
  from(input: Input<U> | ValueInstance<U>): V;
  readonly kind: string;
  readonly canonical: U;
  readonly units: readonly U[];
}

/**
 * One implementation for every kind. Which methods exist is decided by the
 * table, exactly as core's createFacade does it: an affine kind gets `diff`
 * and no `add`, because 20C * 2 has no meaning; a table with a dynamic ratio
 * gets `withDpi`, because a `Measure` that cannot be told its document's dpi is
 * a `Measure` permanently stuck at 96.
 *
 * `opts.delta` is a thunk rather than a class so temperature and tempdelta can
 * refer to each other from the same module without a circular initialisation.
 *
 * `opts.defaults` is the parse options the *kind* bakes in, applied after the
 * caller's own so nothing a caller passes can erase them — the same rule, and
 * the same spread order, the free wrappers use. `number` is why it exists: its
 * wrappers force `defaultUnit: "one"` so a bare `"30"` parses (spec §7.1), and
 * without this the class rejected the one input the kind exists for while the
 * free function accepted it.
 */
export function createValueClass<U extends string>(
  table: UnitTable<U>,
  kind: string,
  opts?: { delta?: () => ValueClass<U>; defaults?: ParseOptions<U> },
): ValueClass<U> {
  const units = Object.freeze(Object.keys(table.ratio) as U[]);
  const affine = table.offset !== undefined;
  // A ratio that is a function reads `ctx`; a table of constants cannot tell
  // one ctx from another, so `withDpi` would be a method that does nothing.
  const dynamic = Object.values(table.ratio).some((r) => typeof r === "function");
  const defaults = opts?.defaults;

  /** The caller's parse options with the kind's own layered on top. */
  const merged = (o?: ParseOptions<U>): ParseOptions<U> | undefined =>
    defaults === undefined ? o : o === undefined ? defaults : { ...o, ...defaults };

  class V implements ValueInstance<U> {
    readonly value: number;
    readonly unit: U;
    // `declare`, not a field: a declared field is *defined* under
    // useDefineForClassFields, so `ctx` would be an own key holding undefined
    // on every instance of every kind. `Object.keys(angle)` is `["value",
    // "unit"]` and stays that way.
    declare readonly ctx?: Ctx;

    constructor(value: number | string, unit: U, ctx?: Ctx) {
      // Membership in the key list, not `table.ratio[unit] !== undefined`:
      // every object inherits `toString`, and `new Angle(1, "toString")` must
      // not quietly become a unit.
      if (!units.includes(unit)) {
        throw new ValidationError("unknown-unit", String(unit));
      }
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new ValidationError("nan", String(value));
      this.value = n;
      this.unit = unit;
      // Assigned only when there is one, so an instance of a kind that has no
      // dynamic ratio serialises and compares exactly as it did before.
      if (ctx !== undefined) this.ctx = ctx;
      // A readonly that exists only at compile time is a comment.
      Object.freeze(this);
    }

    static readonly kind = kind;
    static readonly canonical = table.canonical;
    static readonly units = units;

    static parse(input: string, o?: ParseOptions<U>): V {
      const m = merged(o);
      const r = parse(table, input, m);
      if (!r.ok) throw new ValidationError(r.code, r.input);
      return new V(r.value, r.unit, m?.ctx);
    }

    static tryParse(input: string, o?: ParseOptions<U>): V | Err {
      const m = merged(o);
      const r = parse(table, input, m);
      return r.ok ? new V(r.value, r.unit, m?.ctx) : r;
    }

    static from(input: Input<U> | ValueInstance<U>): V {
      if (input instanceof V) return input;
      if (typeof input === "string") return V.parse(input);
      // An `Ok` record and a foreign instance are the same two fields here,
      // so one branch reads both -- a Temperature may legitimately be handed
      // an instance of its own delta class. A foreign instance's own ctx comes
      // with it; an `Ok` record has none.
      return new V(input.value, input.unit, (input as ValueInstance<U>).ctx);
    }

    to(unit: U): number {
      return rebase(table, rec(this), unit, this.ctx);
    }

    as(unit: U): V {
      return new V(this.to(unit), unit, this.ctx);
    }

    equals(other: Input<U> | ValueInstance<U>, epsilon = 0): boolean {
      return eq(table, rec(this), operand(other), epsilon, ctxOpts(this));
    }

    compare(other: Input<U> | ValueInstance<U>): -1 | 0 | 1 {
      const r = cmp(table, rec(this), operand(other), ctxOpts(this));
      // `operand()` already threw on bad input, so undefined is unreachable.
      if (r === undefined) throw new ValidationError("nan", String(other));
      return r;
    }

    toString(): string {
      return format(table, rec(this));
    }

    toJSON(): { value: number; unit: U } {
      return { value: this.value, unit: this.unit };
    }

    valueOf(): number {
      return toCanonical(table, this.value, this.unit, this.ctx);
    }
  }

  /**
   * An instance as the record the free ops read. Declared after the class so
   * it can name it; hoisting is not involved, since nothing calls it until an
   * instance exists.
   */
  const rec = (v: ValueInstance<U>): Ok<U> => ({
    ok: true,
    value: v.value,
    unit: v.unit,
    raw: String(v.value),
  });

  /** The other operand, normalised. Throws `ValidationError` on bad input. */
  const operand = (input: Input<U> | ValueInstance<U>): Ok<U> => rec(V.from(input));

  /**
   * This instance's context as the options every free op takes. `undefined`
   * rather than `{}` when there is none, so a kind with no dynamic ratio
   * allocates nothing per operation.
   */
  const ctxOpts = (v: V): ParseOptions<U> | undefined =>
    v.ctx === undefined ? undefined : { ctx: v.ctx };

  /**
   * The free ops are the single implementation of the algebra; the class is a
   * façade over them, so the same-unit exactness they buy (`30deg - 15deg` is
   * 15, not 14.999999999999998) is not re-lost here.
   */
  const wrap = (r: Parsed<U>, ctx?: Ctx): V => {
    // Unreachable for operands that came through `rec`/`operand`, both of
    // which are already `Ok` -- kept because an unchecked `r.value` is a lie.
    if (!r.ok) throw new ValidationError(r.code, r.input);
    return new V(r.value, r.unit, ctx);
  };

  if (affine) {
    // Subtracting two readings yields a difference, in the paired delta class.
    // Adding two readings is meaningless, so `add` is absent rather than
    // throwing — an absent method is a type error, a throwing one is a bug
    // report.
    Object.assign(V.prototype, {
      diff(this: V, other: Input<U> | ValueInstance<U>): ValueInstance<U> {
        const Delta = opts?.delta?.();
        if (Delta === undefined) {
          throw new ValidationError("wrong-unit", `${kind} declares no delta class`);
        }
        const right = V.from(other);
        const difference =
          toCanonical(table, this.value, this.unit, this.ctx) -
          toCanonical(table, right.value, right.unit, this.ctx);
        // The difference is a magnitude on the ratio line, so it is handed to
        // the delta class in *this* table's canonical unit -- never read back
        // through this table's offsets, which would re-apply the 32 in
        // Fahrenheit.
        return new Delta(difference, table.canonical);
      },
    });
  } else {
    Object.assign(V.prototype, {
      add(this: V, other: Input<U> | ValueInstance<U>): V {
        return wrap(opAdd(table, rec(this), operand(other), ctxOpts(this)), this.ctx);
      },
      sub(this: V, other: Input<U> | ValueInstance<U>): V {
        return wrap(opSub(table, rec(this), operand(other), ctxOpts(this)), this.ctx);
      },
      scale(this: V, factor: number): V {
        return wrap(opScale(table, rec(this), factor, ctxOpts(this)), this.ctx);
      },
      negate(this: V): V {
        return wrap(opScale(table, rec(this), -1, ctxOpts(this)), this.ctx);
      },
    });
  }

  if (dynamic) {
    // Only a table with a dynamic ratio has anything a dpi could change, so
    // `Angle` gains no method that would silently do nothing. Returns a new
    // instance, like every other method here.
    Object.assign(V.prototype, {
      withDpi(this: V, dpi: number): V {
        return new V(this.value, this.unit, { ...this.ctx, dpi });
      },
    });
  }

  return V as unknown as ValueClass<U>;
}
