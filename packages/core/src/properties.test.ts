import { expect, test } from "bun:test";
import { Decimal } from "./decimal";
import { fromCanonical, toCanonical } from "./eval/convert";
import { formatValue } from "./format/format";
import { buildRegistry, NUMBER_KIND } from "./kind/registry";
import { BUILTIN_KINDS } from "./kinds/index";
import en from "./locale/en";
import { parseNumber } from "./locale/number";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const SAMPLES = [
  "0",
  "1",
  "0.5",
  "12.25",
  "1000",
  "999999",
  "0.000001",
  // Beyond a JS number's 17 significant digits. Without these the Decimal-only
  // discipline is held by inspection alone: a reintroduced Number() anywhere in
  // the conversion or formatting path would pass every other sample.
  "1234567890123456789012345678",
  "0.1234567890123456789012345678",
  "1234567890123456789.0625",
];

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

test("parse(format(v)) === v for every unit of every kind (spec §10 property 2)", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    for (const unit of kind.units.keys()) {
      for (const sample of SAMPLES) {
        const authored = new Decimal(sample);
        const canonical = toCanonical(authored, kind, unit, "en");
        const formatted = formatValue({ kind: kind.id, canonical, unit }, registry, en);

        // Strip the rendered unit or display word back off; what remains is the
        // number exactly as a user would retype it. Keep digits, the en group
        // and decimal symbols, a sign, and the space-like separators that
        // parseNumber tolerates (U+0020, U+00A0, U+202F).
        const digits = formatted.replace(/[^\d.,\-\u0020\u00A0\u202F]/gu, "").trim();
        const label = `${kind.id}:${unit}:${sample}`;
        expect(`${label} ${parseNumber(digits, en)?.toFixed() ?? "UNPARSEABLE"}`).toBe(
          `${label} ${authored.toFixed()}`,
        );
      }
    }
  }
});

test("formatting never emits exponential notation for any sample", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    for (const unit of kind.units.keys()) {
      for (const sample of ["1e41", "1e-22", ...SAMPLES]) {
        const canonical = toCanonical(new Decimal(sample), kind, unit, "en");
        const formatted = formatValue({ kind: kind.id, canonical, unit }, registry, en);
        expect(`${kind.id}:${unit} ${formatted}`).not.toMatch(/e[+-]\d/);
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
