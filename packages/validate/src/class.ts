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
import type { Err, Input, Ok, Parsed, ParseOptions, UnitTable } from "./types";

export interface ValueInstance<U extends string> {
  readonly value: number;
  readonly unit: U;

  to(unit: U): number;
  as(unit: U): ValueInstance<U>;

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

export interface ValueClass<U extends string> {
  new (value: number | string, unit: U): ValueInstance<U>;
  /** Throws `ValidationError`. */
  parse(input: string, opts?: ParseOptions<U>): ValueInstance<U>;
  tryParse(input: string, opts?: ParseOptions<U>): ValueInstance<U> | Err;
  from(input: Input<U> | ValueInstance<U>): ValueInstance<U>;
  readonly kind: string;
  readonly canonical: U;
  readonly units: readonly U[];
}

/**
 * One implementation for every kind. Which methods exist is decided by the
 * table, exactly as core's createFacade does it: an affine kind gets `diff`
 * and no `add`, because 20C * 2 has no meaning.
 *
 * `opts.delta` is a thunk rather than a class so temperature and tempdelta can
 * refer to each other from the same module without a circular initialisation.
 */
export function createValueClass<U extends string>(
  table: UnitTable<U>,
  kind: string,
  opts?: { delta?: () => ValueClass<U> },
): ValueClass<U> {
  const units = Object.freeze(Object.keys(table.ratio) as U[]);
  const affine = table.offset !== undefined;

  class V implements ValueInstance<U> {
    readonly value: number;
    readonly unit: U;

    constructor(value: number | string, unit: U) {
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
      // A readonly that exists only at compile time is a comment.
      Object.freeze(this);
    }

    static readonly kind = kind;
    static readonly canonical = table.canonical;
    static readonly units = units;

    static parse(input: string, o?: ParseOptions<U>): V {
      const r = parse(table, input, o);
      if (!r.ok) throw new ValidationError(r.code, r.input);
      return new V(r.value, r.unit);
    }

    static tryParse(input: string, o?: ParseOptions<U>): V | Err {
      const r = parse(table, input, o);
      return r.ok ? new V(r.value, r.unit) : r;
    }

    static from(input: Input<U> | ValueInstance<U>): V {
      if (input instanceof V) return input;
      if (typeof input === "string") return V.parse(input);
      // An `Ok` record and a foreign instance are the same two fields here,
      // so one branch reads both -- a Temperature may legitimately be handed
      // an instance of its own delta class.
      return new V(input.value, input.unit);
    }

    to(unit: U): number {
      return rebase(table, rec(this), unit);
    }

    as(unit: U): V {
      return new V(this.to(unit), unit);
    }

    equals(other: Input<U> | ValueInstance<U>, epsilon = 0): boolean {
      return eq(table, rec(this), operand(other), epsilon);
    }

    compare(other: Input<U> | ValueInstance<U>): -1 | 0 | 1 {
      const r = cmp(table, rec(this), operand(other));
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
      return toCanonical(table, this.value, this.unit);
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
   * The free ops are the single implementation of the algebra; the class is a
   * façade over them, so the same-unit exactness they buy (`30deg - 15deg` is
   * 15, not 14.999999999999998) is not re-lost here.
   */
  const wrap = (r: Parsed<U>): V => {
    // Unreachable for operands that came through `rec`/`operand`, both of
    // which are already `Ok` -- kept because an unchecked `r.value` is a lie.
    if (!r.ok) throw new ValidationError(r.code, r.input);
    return new V(r.value, r.unit);
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
          toCanonical(table, this.value, this.unit) -
          toCanonical(table, right.value, right.unit);
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
        return wrap(opAdd(table, rec(this), operand(other)));
      },
      sub(this: V, other: Input<U> | ValueInstance<U>): V {
        return wrap(opSub(table, rec(this), operand(other)));
      },
      scale(this: V, factor: number): V {
        return wrap(opScale(table, rec(this), factor));
      },
      negate(this: V): V {
        return wrap(opScale(table, rec(this), -1));
      },
    });
  }

  return V as unknown as ValueClass<U>;
}
