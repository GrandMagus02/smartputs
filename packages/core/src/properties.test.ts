import { expect, test } from "bun:test";
import { Decimal } from "./decimal";
import { fromCanonical, toCanonical } from "./eval/convert";
import { buildRegistry, NUMBER_KIND } from "./kind/registry";
import { BUILTIN_KINDS } from "./kinds/index";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const SAMPLES = ["0", "1", "0.5", "12.25", "1000", "999999", "0.000001"];

test("conversion round-trips for every unit of every kind", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    for (const unit of kind.units.keys()) {
      for (const sample of SAMPLES) {
        const v = new Decimal(sample);
        const back = fromCanonical(toCanonical(v, kind, unit, "en"), kind, unit, "en");
        expect(back.minus(v).abs().lessThan("1e-20")).toBe(true);
      }
    }
  }
});

test("conversion is transitive across every unit pair", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    const units = [...kind.units.keys()];
    for (const a of units) {
      for (const b of units) {
        const direct = toCanonical(new Decimal("7"), kind, a, "en");
        const viaB = toCanonical(fromCanonical(direct, kind, b, "en"), kind, b, "en");
        expect(viaB.minus(direct).abs().lessThan("1e-18")).toBe(true);
      }
    }
  }
});

test("every alias in the index resolves back to a registered unit", () => {
  for (const [, entries] of registry.aliasIndex) {
    for (const entry of entries) {
      expect(registry.kinds.get(entry.kind)?.units.has(entry.unit)).toBe(true);
    }
  }
});

test("every kind satisfies the kind contract", async () => {
  const { assertKindContract } = await import("./testing/index");
  // NUMBER_KIND is the engine's internal identity kind for bare numeric
  // literals: evaluateNode's "number" case constructs it directly and it is
  // never reached through the alias index (see kinds/number.ts, which
  // deliberately overrides the default lexeme to `{ aliases: [], symbol: "" }`
  // instead of the auto-derived `{ aliases: ["one"], symbol: "one" }`).
  // assertKindContract's "every unit must have an alias" rule exists to prove
  // real, user-authored kinds are typeable — it does not apply to this
  // privileged pseudo-kind, which no third-party kind can replicate (it is
  // special-cased in ratio-ops.ts for the extra `*`/`/` signatures).
  for (const kind of BUILTIN_KINDS) {
    if (kind.id === NUMBER_KIND) continue;
    assertKindContract(kind);
  }
});
