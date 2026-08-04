import { Decimal } from "../decimal";
import { KindConflictError, UnitParseError } from "../errors";
import { fromCanonical, toCanonical } from "../eval/convert";
import { formatValue } from "../format/format";
import type { NormalizedKind } from "../kind/define";
import type { Registry } from "../kind/registry";
import type { EvalCtx, KindId, Locale, Value } from "../types";

export interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly dpi?: number | undefined;
  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): { value: string; unit: string };
  /** Ratio kinds only; absent on an affine kind. */
  add?(other: QuantityInput): Quantity;
  sub?(other: QuantityInput): Quantity;
  scale?(factor: Decimal | number | string): Quantity;
  negate?(): Quantity;
  /** Affine kinds only. */
  diff?(other: QuantityInput): Quantity;
  withDpi?(dpi: number): Quantity;
}

export type QuantityInput = Quantity | number | string;

export interface QuantityClass {
  new (
    value: Decimal | number | string,
    unit: string,
    meta?: Record<string, unknown>,
  ): Quantity;
  from(input: QuantityInput): Quantity;
  parse(text: string): Quantity;
  readonly kindId: KindId;
}

const PARSE = /^\s*(-?[\d.]+)\s*°?\s*([\p{L}%][\p{L}\d²³%]*)\s*$/u;

export function createFacade(args: {
  kind: NormalizedKind;
  registry: Registry;
  locale: Locale;
  deltaFacades?: Map<KindId, QuantityClass>;
}): QuantityClass {
  const { kind, registry, locale } = args;
  const deltaFacades = args.deltaFacades ?? new Map<KindId, QuantityClass>();
  const canonicalUnit = kind.spec.mode === "ratio" ? kind.spec.canonical : "";

  const requireUnit = (unit: string): string => {
    if (!kind.units.has(unit)) {
      throw new UnitParseError(unit, kind.id);
    }
    return unit;
  };

  // The unit (if any) whose ratio is context-dependent — currently only
  // `measure`'s `px`, which reads dpi from `meta`. Keeping a handle on the
  // NormalizedUnit itself (rather than a bare boolean) lets the `dpi` getter
  // below ask the kind for its own default instead of restating one.
  const dpiUnitName =
    kind.spec.mode === "ratio"
      ? Object.entries(kind.spec.units).find(
          ([, u]) =>
            typeof u === "object" && "ratio" in u && typeof u.ratio === "function",
        )?.[0]
      : undefined;
  const dpiUnit = dpiUnitName !== undefined ? kind.units.get(dpiUnitName) : undefined;
  const usesDpi = dpiUnit !== undefined;

  class Q implements Quantity {
    readonly value: Decimal;
    readonly unit: string;
    readonly meta?: Readonly<Record<string, unknown>>;

    constructor(
      value: Decimal | number | string,
      unit: string,
      meta?: Record<string, unknown>,
    ) {
      this.value = new Decimal(value);
      this.unit = requireUnit(unit);
      if (meta !== undefined) this.meta = Object.freeze({ ...meta });
      Object.freeze(this);
    }

    static readonly kindId = kind.id;

    static from(input: QuantityInput): Quantity {
      if (input instanceof Q) return input;
      if (typeof input === "number") return new Q(input, canonicalUnit);
      if (typeof input === "string") return Q.parse(input);
      // A Quantity from another facade of the same kind.
      const other = input as Quantity;
      return new Q(other.value, other.unit, other.meta as Record<string, unknown>);
    }

    static parse(text: string): Quantity {
      const m = PARSE.exec(text);
      const digits = m?.[1];
      const unit = m?.[2];
      if (digits === undefined || unit === undefined)
        throw new UnitParseError(text, kind.id);
      return new Q(digits, unit.toLowerCase());
    }

    /** Canonical magnitude, the basis for every conversion and comparison. */
    private canonical(): Decimal {
      return toCanonical(
        this.value,
        kind,
        this.unit,
        locale.id,
        this.meta as Record<string, unknown>,
      );
    }

    to(unit: string): Decimal {
      return fromCanonical(
        this.canonical(),
        kind,
        requireUnit(unit),
        locale.id,
        this.meta as Record<string, unknown>,
      );
    }

    as(unit: string): Quantity {
      return new Q(this.to(unit), unit, this.meta as Record<string, unknown>);
    }

    equals(other: QuantityInput, epsilon: Decimal | number | string = 0): boolean {
      const rhs = Q.from(other);
      const diff = this.canonical()
        .minus((rhs as Q).canonical())
        .abs();
      return diff.lessThanOrEqualTo(new Decimal(epsilon));
    }

    toString(): string {
      const value: Value = Object.freeze({
        kind: kind.id,
        canonical: this.canonical(),
        unit: this.unit,
        ...(this.meta ? { meta: this.meta } : {}),
      });
      return formatValue(value, registry, locale);
    }

    toJSON(): { value: string; unit: string } {
      return { value: this.value.toFixed(), unit: this.unit };
    }

    /**
     * Result keeps the left operand's unit — spec §8. Not `private`: `Q` is
     * in lexical scope where the prototype functions below are defined, so
     * typing them `this: Q` lets them call `this.combine(...)` directly —
     * but only if `combine` is accessible from outside the class body, which
     * `private` (checked syntactically by TypeScript, not by `this`'s type)
     * would forbid. It stays out of the `Quantity` interface, so it is not
     * part of the public contract.
     */
    combine(other: QuantityInput, sign: 1 | -1): Quantity {
      const rhs = Q.from(other);
      const delta = (rhs as Q).canonical().times(sign);
      const total = this.canonical().plus(delta);
      return new Q(
        fromCanonical(
          total,
          kind,
          this.unit,
          locale.id,
          this.meta as Record<string, unknown>,
        ),
        this.unit,
        this.meta as Record<string, unknown>,
      );
    }

    get dpi(): number | undefined {
      const d = this.meta?.dpi;
      if (typeof d === "number") return d;
      if (dpiUnit === undefined) return undefined;
      // Ask the kind's own ratio function for its default, with no dpi in
      // meta, rather than restating that default (currently 96) here.
      const ctx: EvalCtx = {
        self: { kind: kind.id, canonical: new Decimal(0), unit: dpiUnit.unit },
        locale: locale.id,
      };
      return new Decimal(1).div(dpiUnit.ratio(ctx)).toNumber();
    }
  }

  const affine = kind.spec.mode === "ratio" ? kind.spec.affine : undefined;
  const proto = Q.prototype as unknown as Record<string, unknown>;

  if (affine === undefined) {
    // Ratio kinds: every unit is a pure multiple, so sums and products are
    // meaningful. An affine kind gets none of these — 20C * 2 has no meaning.
    proto.add = function (this: Q, other: QuantityInput) {
      return this.combine(other, 1);
    };
    proto.sub = function (this: Q, other: QuantityInput) {
      return this.combine(other, -1);
    };
    proto.scale = function (this: Quantity, factor: Decimal | number | string) {
      return new Q(
        this.value.times(new Decimal(factor)),
        this.unit,
        this.meta as Record<string, unknown>,
      );
    };
    proto.negate = function (this: Quantity) {
      return new Q(this.value.negated(), this.unit, this.meta as Record<string, unknown>);
    };
  } else {
    // Absolute points: a reading plus a difference is a reading, and two
    // readings differ into a difference. Nothing else is defined.
    const deltaKind = affine.deltaKind;

    const requireDeltaClass = (): QuantityClass => {
      const DeltaClass = deltaFacades.get(deltaKind);
      if (DeltaClass === undefined) {
        // A wiring error — this kind declares `affine.deltaKind` but no
        // facade for that kind was built — not a parse failure, so
        // `UnitParseError` (which always wraps its input as "Cannot parse
        // ... as a quantity") doesn't fit.
        throw new KindConflictError(kind.id, `delta kind ${deltaKind} is not registered`);
      }
      return DeltaClass;
    };

    proto.add = function (this: Quantity, other: QuantityInput) {
      // `other` is a difference, not a reading of this kind — interpret it
      // through the delta facade's own `from`, not `Q.from`. Reconstructing
      // it as a Temperature would re-apply temperature's offset (e.g. 5F
      // read as a *reading* is -15C; read as a *difference* it is 2.78C).
      const DeltaClass = requireDeltaClass();
      const rhs = DeltaClass.from(other);
      const total = (this as unknown as { canonical(): Decimal })
        .canonical()
        .plus((rhs as unknown as { canonical(): Decimal }).canonical());
      return new Q(
        fromCanonical(
          total,
          kind,
          this.unit,
          locale.id,
          this.meta as Record<string, unknown>,
        ),
        this.unit,
        this.meta as Record<string, unknown>,
      );
    };
    proto.diff = function (this: Quantity, other: QuantityInput) {
      // `other` here is a second reading of this same kind, so `Q.from` is
      // correct: it either passes an existing Temperature through, parses a
      // string with Temperature's own offsets, or treats a bare number as
      // canonical.
      const rhs = Q.from(other);
      const delta = (this as unknown as { canonical(): Decimal })
        .canonical()
        .minus((rhs as unknown as { canonical(): Decimal }).canonical());
      const DeltaClass = requireDeltaClass();
      return new DeltaClass(delta, canonicalUnit);
    };
  }

  if (usesDpi) {
    proto.withDpi = function (this: Quantity, dpi: number) {
      return new Q(this.value, this.unit, { ...this.meta, dpi });
    };
  }

  Object.defineProperty(Q, "name", { value: kind.id });
  return Q as unknown as QuantityClass;
}
