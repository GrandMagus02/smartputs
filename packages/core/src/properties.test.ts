import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Decimal } from "./decimal";
import { createEngine } from "./engine";
import { SmartputError, TooAmbiguousError } from "./errors";
import { fromCanonical, toCanonical } from "./eval/convert";
import { formatValue } from "./format/format";
import { buildRegistry, NUMBER_KIND } from "./kind/registry";
import { composeLocale } from "./locale/compose";
import { parseNumber } from "./locale/number";
import { parseCorpus } from "./testing/corpus";

const en = composeLocale(english, BUILTIN_EN);

const registry = buildRegistry(BUILTIN_KINDS, [en]);
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
        const back = fromCanonical(
          toCanonical(v, kind, unit, { locale: "en" }),
          kind,
          unit,
          { locale: "en" },
        );
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
        const direct = toCanonical(new Decimal("7"), kind, a, { locale: "en" });
        const viaB = toCanonical(
          fromCanonical(direct, kind, b, { locale: "en" }),
          kind,
          b,
          { locale: "en" },
        );
        const diff = viaB.minus(direct).abs();
        // RULING 12: an absolute epsilon assumes every kind's canonical
        // magnitude is small, which held for every M1 kind but not for
        // `datasize` (b..tib spans 12 orders of magnitude). `tib`'s ratio is
        // 1024^4 = 2^40; converting a decimal-SI magnitude (e.g. 7 tb =
        // 7e12 bytes) through it produces an exact terminating decimal that
        // needs more significant digits than the fixed 28-digit Decimal
        // precision provides, so the round trip loses a few digits at the
        // tail. That loss is on the order of one ulp at 28 significant
        // digits (~1e-28 relative), and two chained conversions
        // (a -> canonical -> b -> canonical) can compound it a little
        // further, so 1e-25 relative has real headroom above the expected
        // error while still catching a genuine logic error (an
        // off-by-a-decade ratio, say, would miss this by many orders of
        // magnitude). `direct` can be exactly zero, where a relative
        // comparison is meaningless, so fall back to the original absolute
        // epsilon in that case. The real fix — a display-precision policy at
        // format time — is deliberately out of scope for M2 (the corpus
        // asserts full 28-digit values, e.g. "90 deg in rad" ->
        // ...1.570796326794896619231321691rad) and is tracked as a deferred
        // whole-branch finding.
        const tolerance = direct.isZero()
          ? new Decimal("1e-18")
          : direct.abs().times("1e-25");
        expect(diff.lessThan(tolerance)).toBe(true);
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
        const canonical = toCanonical(authored, kind, unit, { locale: "en" });
        const formatted = formatValue({ kind: kind.id, canonical, unit }, registry, en);

        // Strip the rendered unit or display word back off; what remains is the
        // number exactly as a user would retype it. Keep digits, the en group
        // and decimal symbols, a sign, and the space-like separators that
        // parseNumber tolerates (U+0020, U+00A0, U+202F).
        const digits = formatted.replace(/[^\d.,\-\u0020\u00A0\u202F]/gu, "").trim();
        const label = `${kind.id}:${unit}:${sample}`;
        const parsed = parseNumber(digits, english);

        if (parsed === null) {
          expect(`${label} UNPARSEABLE`).toBe(`${label} ${authored.toFixed()}`);
          continue;
        }

        // RULING 12: exact string equality is provably unattainable for a
        // kind whose ratio doesn't terminate in decimal — temperature (F is
        // 5/9, further offset by -32 into a different magnitude), angle
        // (deg/rad is pi/180, grad is pi/200) and speed (kph is 1000/3600)
        // all have one. `authored -> canonical -> formatted -> parsed`
        // passes through that ratio twice, so the last digit or two of a
        // 28-significant-digit value drifts — by design, not by bug. M3
        // added guard-digit rounding at format time (26 significant digits,
        // two below the 28 Decimal computes at — see angle.test.ts and
        // measure.test.ts for the same phenomenon documented at the
        // single-assertion level, and the corpus, e.g. "90 deg in rad" ->
        // ...1.570796326794896619231321691rad canonical formatted as
        // ...1.5707963267948966192313217 radians), but that rounding only
        // trims trailing noise from a display string; the conversion itself
        // is still exact, so the relative-tolerance reasoning below still
        // applies. The property that's actually true, and worth asserting,
        // is round-trip stability at the configured precision: parsed and
        // authored agree to within a couple of ulps — the same 1e-25
        // relative reasoning as the transitivity test above.
        //
        // The reference magnitude for "relative to what" is
        // max(authored, canonical), not authored alone: the value that
        // actually passes through the lossy 28-significant-digit pipeline is
        // `canonical` (formatValue renders it, parseNumber recovers a value
        // near it), and for an affine kind with a large offset relative to a
        // small authored value — e.g. authored 0.000001°F, offset -32 —
        // canonical (~-17.78°C) is seven orders of magnitude bigger than
        // authored. The absolute drift scales with whichever of the two is
        // larger, so bounding against authored alone would demand
        // impossibly tight precision from exactly the case the offset makes
        // hardest, and silently fail it forever. `authored.isZero()` cannot
        // happen alongside a nonzero `canonical.abs()` co-dominating it, so
        // the max-based fallback is a strict generalisation of a plain
        // authored-only zero fallback, not a separate branch.
        const diff = parsed.minus(authored).abs();
        const scale = Decimal.max(authored.abs(), canonical.abs());
        const tolerance = scale.isZero() ? new Decimal("1e-20") : scale.times("1e-25");
        const detail = `${label} diff=${diff.toString()} tolerance=${tolerance.toString()}`;
        expect(diff.lessThan(tolerance) ? detail : `${detail} EXCEEDED`).toBe(detail);
      }
    }
  }
});

test("formatting never emits exponential notation for any sample", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    for (const unit of kind.units.keys()) {
      for (const sample of ["1e41", "1e-22", ...SAMPLES]) {
        const canonical = toCanonical(new Decimal(sample), kind, unit, { locale: "en" });
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
  // never reached through the alias index (see @smartput/number, which
  // deliberately overrides the default lexeme to `{ aliases: [], symbol: "" }`
  // instead of the auto-derived `{ aliases: ["one"], symbol: "one" }`).
  // assertKindContract's "every unit must have an alias" rule exists to prove
  // real, user-authored kinds are typeable — it does not apply to this
  // privileged pseudo-kind, which no third-party kind can replicate (it is
  // special-cased in ratio-ops.ts for the extra `*`/`/` signatures).
  for (const kind of BUILTIN_KINDS) {
    if (kind.id === NUMBER_KIND) continue;
    // A migrated kind's words are in `BUILTIN_EN`, not on the descriptor; one
    // that still declares `lexicon` matches nothing here and is bridged.
    assertKindContract(
      kind,
      BUILTIN_EN.filter((v) => v.kind === kind.id),
    );
  }
});

test("affine round-trips are exact at the anchor points", () => {
  const temp = registry.kinds.get("temperature");
  if (temp === undefined) throw new Error("temperature missing");
  for (const [unit, expected] of [
    ["c", "0"],
    ["f", "32"],
    ["k", "273.15"],
  ] as const) {
    const canonical = toCanonical(new Decimal(expected), temp, unit, { locale: "en" });
    const back = fromCanonical(canonical, temp, unit, { locale: "en" });
    expect(back.toString()).toBe(expected);
  }
});

/**
 * Every error a person can reach by typing points at the text that caused it.
 *
 * The corpus is the green half — the rows here all evaluate, so it proves the
 * property is not vacuously true by silence — and the list under it is the red
 * half: one input per throw site this codebase has, so a throw site that
 * forgets its span is caught by the file that names the property rather than by
 * a reviewer.
 *
 * `TooAmbiguousError` is the one exemption, and it is a ruling rather than an
 * oversight (§E.2): it is about the whole input — too many readings of it —
 * and there is no single span to underline. It keeps `spans: []`.
 */
const CORPUS_INPUTS: string[] = [
  ...parseCorpus(await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text())
    .map((row) => row[0])
    .filter((row): row is string => row !== undefined),
  // No signature for the pair, at a binary and at a convert.
  "10 kg / 2 m",
  "30 hours in sqm",
  // A word no alias reaches, beside a number and after `in`.
  "5 zorkmids",
  "10 km in zorkmids",
  // The parser's own refusals: nothing at all, a dangling `in`, an unclosed
  // paren, a leftover token, and a run of digits and letters it cannot split.
  "",
  "1 kg in",
  "(1 + 2",
  "1 kg 2 kg",
  "1h30m",
];

test("every SmartputError raised over the corpus carries a span", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  for (const input of CORPUS_INPUTS) {
    try {
      engine.evaluate(input);
    } catch (e) {
      if (!(e instanceof SmartputError)) throw e;
      if (e instanceof TooAmbiguousError) continue;
      expect([input, e.spans.length > 0]).toEqual([input, true]);
    }
  }
});
