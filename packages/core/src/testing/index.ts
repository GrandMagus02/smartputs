import { expect } from "bun:test";
import { Decimal } from "../decimal";
import { buildRegistry, wordsFor } from "../kind/registry";
import type { EvalCtx, Kind } from "../types";

/**
 * Assertions every kind must satisfy. Built-in and third-party kinds run the
 * same suite — this is what keeps the extension seam honest. The one
 * exception is the engine's internal `number` pseudo-kind (`NUMBER_KIND`):
 * it is never reached through the alias index (bare numeric literals are
 * constructed directly by `evaluateNode`), so it is deliberately excluded
 * from this suite by its callers rather than exempted here — no real,
 * user-authored kind gets a pass on having typeable units.
 */
export function assertKindContract(kind: Kind): void {
  const registry = buildRegistry([kind]);
  const normalized = registry.kinds.get(kind.id);

  expect(normalized).toBeDefined();
  if (normalized === undefined) return;
  if (normalized.spec.mode !== "ratio") return;

  expect(normalized.units.size).toBeGreaterThan(0);
  expect(normalized.units.has(normalized.spec.canonical)).toBe(true);

  for (const [unitName, unit] of normalized.units) {
    expect(
      wordsFor(registry, "en", kind.id, unitName)?.aliases.length ?? 0,
    ).toBeGreaterThan(0);
    const ctx: EvalCtx = {
      self: { kind: kind.id, canonical: new Decimal(0), unit: unitName },
      locale: "en",
    };
    // A zero ratio would make the unit unconvertible in both directions.
    expect(unit.ratio(ctx).isZero()).toBe(false);
  }
}
