import { Decimal } from "../decimal";
import { KindConflictError, UnitParseError } from "../errors";
import { fromCanonical, toCanonical } from "../eval/convert";
import { formatValue } from "../format/format";
import type { NormalizedKind } from "../kind/define";
import type { Registry } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import { numberSymbols, parseNumber } from "../locale/number";
import type { EvalCtx, KindId, Locale, Value } from "../types";

/**
 * What `toJSON()` produces and what `from()` accepts back. Plain JSON, so it
 * survives `JSON.stringify`/`parse` — `value` is the decimal string rather
 * than a Decimal, and `new Decimal` reads either.
 */
export interface QuantitySnapshot {
  readonly value: string;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly dpi?: number | undefined;
  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): QuantitySnapshot;
  /** Ratio kinds only; absent on an affine kind. */
  add?(other: QuantityInput): Quantity;
  sub?(other: QuantityInput): Quantity;
  scale?(factor: Decimal | number | string): Quantity;
  negate?(): Quantity;
  /** Affine kinds only. */
  diff?(other: QuantityInput): Quantity;
  withDpi?(dpi: number): Quantity;
}

export type QuantityInput = Quantity | QuantitySnapshot | number | string;

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

export function createFacade(args: {
  kind: NormalizedKind;
  registry: Registry;
  locale: Locale;
  deltaFacades?: Map<KindId, QuantityClass>;
}): QuantityClass {
  const { kind, registry, locale } = args;
  const deltaFacades = args.deltaFacades ?? new Map<KindId, QuantityClass>();
  const canonicalUnit = kind.spec.mode === "ratio" ? kind.spec.canonical : "";
  const fold = (s: string) => s.toLocaleLowerCase(locale.id);

  const requireUnit = (unit: string): string => {
    if (!kind.units.has(unit)) {
      throw new UnitParseError(unit, kind.id);
    }
    return unit;
  };

  /**
   * One vocabulary, not two. `parse` used to match a regex against raw unit
   * *keys*, ignoring the lexicon sitting right here in the closure — so
   * `X.parse(x.toString())` threw for mass, length, area, speed and volume:
   * the facade's own output was not valid input to its own parser.
   *
   * The registry's alias index, filtered to this kind, is the engine's
   * vocabulary. On top of it go the two things `toString` can emit that are
   * not aliases — the unit's symbol ("m²", "m/s", "°C") and its plural
   * display forms ("kilograms") — plus the bare unit keys the old regex
   * accepted, so nothing that parsed before stops parsing. First claim wins,
   * and the alias index iterates in sorted order, so this is deterministic.
   */
  const unitFor = new Map<string, string>();
  const claim = (token: string | undefined, unit: string): void => {
    if (token === undefined || token === "") return;
    const key = fold(token);
    if (!unitFor.has(key)) unitFor.set(key, unit);
  };
  for (const [alias, entries] of registry.aliasIndex) {
    for (const entry of entries) if (entry.kind === kind.id) claim(alias, entry.unit);
  }
  for (const [name, unit] of kind.units) {
    claim(name, name);
    claim(unit.lexeme.symbol, name);
    for (const form of Object.values(unit.lexeme.display ?? {})) claim(form, name);
  }

  // The locale's own analyzers, the same chain the engine's resolver runs, so
  // "5 kilometres" resolves here exactly as it does in `evaluate`. Locale
  // packs are not in scope for a facade, hence the empty list.
  const analyze = createAnalyzerChain(locale, []);

  const resolveUnit = (token: string): string | undefined => {
    const direct = unitFor.get(fold(token));
    if (direct !== undefined) return direct;
    for (const analyzed of analyze(token)) {
      const hit = unitFor.get(fold(analyzed.form));
      if (hit !== undefined) return hit;
    }
    return undefined;
  };

  // Splitting the magnitude off the unit has to know the locale's group and
  // decimal symbols, or "1,234.5 kilograms" — which `toString` produces —
  // cannot be read back.
  const { group, decimal } = numberSymbols(locale);
  // NBSP and narrow NBSP as escapes, not literals: French ICU groups with
  // U+202F and both are invisible in source -- the same reasoning parseNumber
  // records. A plain space is included too, so "1.5 kilograms" splits.
  const isNumeric = (ch: string): boolean =>
    (ch >= "0" && ch <= "9") ||
    ch === group ||
    ch === decimal ||
    ch === " " ||
    ch === "\u00A0" ||
    ch === "\u202F";

  /**
   * `new Decimal` throws a raw `DecimalError`, which is not a `SmartputError`,
   * so a consumer catching `SmartputError` would fall through to a generic
   * handler on `new Mass("abc", "kg")`.
   */
  const toDecimal = (raw: Decimal | number | string, reportAs: string): Decimal => {
    try {
      return new Decimal(raw);
    } catch {
      throw new UnitParseError(reportAs, kind.id);
    }
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
      this.value = toDecimal(value, String(value));
      this.unit = requireUnit(unit);
      if (meta !== undefined) this.meta = Object.freeze({ ...meta });
      Object.freeze(this);
    }

    static readonly kindId = kind.id;

    static from(input: QuantityInput): Quantity {
      if (input instanceof Q) return input;
      if (typeof input === "number") return new Q(input, canonicalUnit);
      if (typeof input === "string") return Q.parse(input);
      // A Quantity from another facade of the same kind, or a `toJSON()`
      // snapshot: both carry value/unit/meta, and the constructor reads a
      // Decimal or its decimal string alike, so one branch serves both.
      return new Q(input.value, input.unit, input.meta as Record<string, unknown>);
    }

    static parse(text: string): Quantity {
      const trimmed = text.trim();
      let i = 0;
      if (trimmed[0] === "-" || trimmed[0] === "+") i += 1;
      while (i < trimmed.length && isNumeric(trimmed[i] as string)) i += 1;

      const digits = trimmed.slice(0, i).trim();
      const token = trimmed.slice(i).trim();
      // A bare number is not a quantity — the caller has to say which unit.
      if (token === "") throw new UnitParseError(text, kind.id);

      const value = parseNumber(digits, locale);
      if (value === null) throw new UnitParseError(text, kind.id);

      const unit = resolveUnit(token);
      if (unit === undefined) throw new UnitParseError(text, kind.id);

      return new Q(value, unit);
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

    toJSON(): QuantitySnapshot {
      // `meta` is part of the quantity's identity — a measure carrying
      // `{ dpi: 300 }` converts differently from one that does not — so it has
      // to survive the round trip, and `from` accepts this shape back.
      return {
        value: this.value.toFixed(),
        unit: this.unit,
        ...(this.meta ? { meta: this.meta } : {}),
      };
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
