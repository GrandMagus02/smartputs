import { Decimal } from "../decimal";
import { UnitParseError } from "../errors";
import { fromCanonical, toCanonical } from "../eval/convert";
import { formatValue } from "../format/format";
import type { NormalizedKind } from "../kind/define";
import type { Registry } from "../kind/registry";
import type { KindId, Locale, Value } from "../types";

export interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): { value: string; unit: string };
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
}): QuantityClass {
  const { kind, registry, locale } = args;
  const canonicalUnit = kind.spec.mode === "ratio" ? kind.spec.canonical : "";

  const requireUnit = (unit: string): string => {
    if (!kind.units.has(unit)) {
      throw new UnitParseError(unit, kind.id);
    }
    return unit;
  };

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
  }

  Object.defineProperty(Q, "name", { value: kind.id });
  return Q as unknown as QuantityClass;
}
