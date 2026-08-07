import { expect } from "bun:test";
import { Decimal } from "../decimal";
import { buildRegistry, wordsFor } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import type { EvalCtx, Kind, Language, Vocabulary } from "../types";

/**
 * Assertions every kind must satisfy. Built-in and third-party kinds run the
 * same suite — this is what keeps the extension seam honest. The one
 * exception is the engine's internal `number` pseudo-kind (`NUMBER_KIND`):
 * it is never reached through the alias index (bare numeric literals are
 * constructed directly by `evaluateNode`), so it is deliberately excluded
 * from this suite by its callers rather than exempted here — no real,
 * user-authored kind gets a pass on having typeable units.
 *
 * `vocabularies` are the words the kind is meant to be read and written with.
 * They are a separate argument because a kind no longer carries any: words
 * live in a `Vocabulary` keyed by kind id, so "every unit is typeable" is a
 * claim about a (kind, language) pair rather than about the kind alone. Pass
 * the kind's own `locale/<id>` module:
 *
 * ```ts
 * assertKindContract(mass, [massEn]);
 * ```
 *
 * Omitting them checks a kind that has no words at all: R2 indexes every unit
 * under its own registry key, so the alias assertion passes for a kind whose
 * unit ids are typeable and fails for one whose are not. That failure is
 * correct — with no vocabulary installed, nothing else can type its units.
 */
export function assertKindContract(
  kind: Kind,
  vocabularies: readonly Vocabulary[] = [],
): void {
  // The language the words are asserted in. Taken from the vocabularies rather
  // than hardcoded so a translation can be contract-tested on the same terms as
  // the original; "en" is only the default because it is what the built-ins
  // ship.
  //
  // Mechanics-free on purpose: this helper asserts that units are *typeable*,
  // which is the alias index's business, and an analyzer chain or a plural
  // table would only let a kind pass on the strength of its language's
  // cleverness rather than its own aliases.
  const localeId = vocabularies[0]?.locale ?? "en";
  const language: Language = {
    id: localeId,
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  };
  const registry = buildRegistry([kind], [composeLocale(language, vocabularies)]);
  const normalized = registry.kinds.get(kind.id);

  expect(normalized).toBeDefined();
  if (normalized === undefined) return;
  if (normalized.spec.mode !== "ratio") return;

  expect(normalized.units.size).toBeGreaterThan(0);
  expect(normalized.units.has(normalized.spec.canonical)).toBe(true);

  for (const [unitName, unit] of normalized.units) {
    expect(
      wordsFor(registry, localeId, kind.id, unitName)?.aliases.length ?? 0,
    ).toBeGreaterThan(0);
    const ctx: EvalCtx = {
      self: { kind: kind.id, canonical: new Decimal(0), unit: unitName },
      locale: localeId,
    };
    // A zero ratio would make the unit unconvertible in both directions.
    expect(unit.ratio(ctx).isZero()).toBe(false);
  }
}
