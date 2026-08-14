import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract, OPERATOR_CHARS } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_DE from "./locale/de";

const locale = composeLocale(german, BUILTIN_DE);

/** Exactly what `german.selectForm` can return. Four keys, closed. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/**
 * `boolean`'s single unit is a sentinel with no word in ANY language — `en` and
 * `uk` skip it identically. Not a German gap.
 */
const SKIP = { skip: ["boolean:bool"] };

describe("de: independent verification", () => {
  test("1. contract, including fractional counts", () => {
    assertLocaleContract(locale, BUILTIN_KINDS, SKIP);
    // The default counts are all integers, so the fractional row — which in
    // German is `other`, the same key an integer plural takes — goes unsampled
    // unless asked for by name.
    assertLocaleContract(locale, BUILTIN_KINDS, {
      ...SKIP,
      counts: [0.5, 1.5, 2.5, new Decimal("0.1"), new Decimal("1.0001")],
    });
  });

  test("2. every forms key set is exactly what selectForm produces", () => {
    const bad: string[] = [];
    for (const v of BUILTIN_DE) {
      for (const [unit, words] of Object.entries(v.units)) {
        if (words.forms === undefined) continue;
        const got = Object.keys(words.forms).sort();
        if (JSON.stringify(got) !== JSON.stringify(KEYS)) {
          bad.push(`${v.kind}:${unit} keys ${JSON.stringify(got)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("3. every printed form is literally an alias, not a stripper rescue", () => {
    const bad: string[] = [];
    for (const v of BUILTIN_DE) {
      for (const [unit, words] of Object.entries(v.units)) {
        const aliases = new Set(words.aliases.map((a) => a.toLowerCase()));
        for (const [key, form] of Object.entries(words.forms ?? {})) {
          if (!aliases.has(form.toLowerCase())) {
            bad.push(`${v.kind}:${unit} form ${key}=${JSON.stringify(form)}`);
          }
        }
        const sym = words.symbol;
        // A symbol carrying an operator ("m/s") is read as arithmetic, never by
        // alias lookup — `assertLocaleContract` documents and skips exactly
        // this, and `en` writes "m/s" the same way. Test 5 evaluates them.
        if (
          sym !== undefined &&
          sym.trim() !== "" &&
          ![...sym].some((c) => OPERATOR_CHARS.has(c)) &&
          !aliases.has(sym.toLowerCase())
        ) {
          bad.push(`${v.kind}:${unit} symbol ${JSON.stringify(sym)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("4. round-trip: each vocabulary reads its own formatted output back", () => {
    const bad: string[] = [];
    for (const v of BUILTIN_DE) {
      const kind = BUILTIN_KINDS.find((k) => k.id === v.kind);
      if (kind === undefined) continue;
      // One engine per kind: a round trip that only passed because a sibling
      // kind's aliases were installed proves nothing about this vocabulary.
      const engine = createEngine({
        locales: [composeLocale(german, [v])],
        kinds: [kind],
      });
      for (const [unit, words] of Object.entries(v.units)) {
        const read = words.aliases[0];
        if (read === undefined) continue;
        for (const c of ["1", "2", "1500", "0,5", "2500,25"]) {
          let first: ReturnType<typeof engine.evaluate>;
          try {
            first = engine.evaluate(`${c} ${read}`);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} cannot read "${c} ${read}" — ${(e as Error).message}`,
            );
            continue;
          }
          const text = first.formatted;
          // A symbol carrying an operator ("m/s") is arithmetic, not a lookup:
          // it needs `length` and `duration` installed, which a one-kind engine
          // by construction does not have. English fails here identically
          // ("1m/s" -> Unknown unit "m"), so this is the kinds' shape and not
          // the translation's. Test 5 round-trips these on the full engine.
          if ([...text].some((ch) => OPERATOR_CHARS.has(ch))) continue;
          let back: ReturnType<typeof engine.evaluate>;
          try {
            back = engine.evaluate(text);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} "${c} ${read}" printed ${JSON.stringify(text)} — will not parse: ${(e as Error).message}`,
            );
            continue;
          }
          if (back.value.unit !== first.value.unit) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — unit ${first.value.unit} came back as ${back.value.unit}`,
            );
          } else if (!back.value.canonical.eq(first.value.canonical)) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — canonical ${first.value.canonical} came back as ${back.value.canonical}`,
            );
          }
        }
      }
    }
    expect(bad).toEqual([]);
    // One engine per kind, seventeen of them: registry construction dominates,
    // so this needs more than the 5s default when the file runs beside others.
  }, 30_000);

  test("5. full-engine round-trip, the config a consumer actually wires", () => {
    const engine = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
    const bad: string[] = [];
    for (const v of BUILTIN_DE) {
      for (const [unit, words] of Object.entries(v.units)) {
        const read = words.aliases[0];
        if (read === undefined) continue;
        for (const c of ["1", "2", "1500", "0,5", "2500,25"]) {
          let first: ReturnType<typeof engine.evaluate>;
          try {
            first = engine.evaluate(`${c} ${read}`);
          } catch {
            // Cross-kind ambiguity on a short alias ("m" is both a metre and a
            // minute, in `units.ts`, in every language) is a property of the
            // kinds, not of this translation. Test 4 covers the unit in
            // isolation; here only what the full engine does resolve is judged.
            continue;
          }
          if (first.value.unit !== unit || first.kind !== v.kind) continue;
          const text = first.formatted;
          let back: ReturnType<typeof engine.evaluate>;
          try {
            back = engine.evaluate(text);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — will not parse: ${(e as Error).message}`,
            );
            continue;
          }
          // A symbol that is an *expression* ("km/h" = length ÷ duration) is
          // computed, not looked up, so it comes back in the kind's canonical
          // unit rather than the authored one. Ukrainian ships exactly this —
          // "1 км/год" reads back as speed:mps, "1 кВт·год" as energy:j — so
          // the magnitude is what is guaranteed here, and the label is not.
          const computed = [...text].some((ch) => OPERATOR_CHARS.has(ch));
          if (!computed && (back.value.unit !== unit || back.kind !== v.kind)) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — came back as ${back.kind}:${back.value.unit}`,
            );
          } else if (!back.value.canonical.eq(first.value.canonical)) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — canonical ${first.value.canonical} came back as ${back.value.canonical}`,
            );
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 30_000);

  test("6. the group separator needs no Ukrainian-style accommodation", () => {
    // Ukrainian groups with U+00A0, and `parse/normalize.ts` folds every \s to
    // a plain space before `lex()` sees it — which is why uk needed a specific
    // accommodation. German does not: CLDR gives it "." for the group and ","
    // for the decimal, both ordinary ASCII, so nothing invisible survives a
    // print. Pinned rather than assumed, because the whole question is whether
    // a formatted number can be retyped.
    const parts = new Intl.NumberFormat("de").formatToParts(1234567.5);
    const sep = (t: string) => parts.find((p) => p.type === t)?.value;
    expect(sep("group")).toBe(".");
    expect(sep("decimal")).toBe(",");
    const engine = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
    const out = engine.evaluate("1234567,5 kg");
    expect(out.formatted).toBe("1.234.567,5 Kilogramm");
    expect(/[   ]/.test(out.formatted)).toBe(false);
    expect(engine.evaluate(out.formatted).value.canonical.toString()).toBe("1234567500");
  });

  test("7. no German script leaked into any kind", () => {
    expect(JSON.stringify(BUILTIN_KINDS)).not.toMatch(/[äöüÄÖÜß]/);
  });
});
