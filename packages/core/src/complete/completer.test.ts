import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english } from "@smartput/locale-en";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import type { CompleteCtx, Completer as CompleterFn, Locale, Weights } from "../types";
import { Autocompleter } from "./completer";

const en = composeLocale(english);

// Neither the parser nor the solver: an Autocompleter runs on raw, possibly
// unparseable input, and its own fixtures never need a Program.

const registry = buildRegistry(BUILTIN_KINDS);

test("a prefix that offers rows", () => {
  const completer = new Autocompleter({
    registry,
    locale: en,
    layers: [english.weights],
  });
  const rows = completer.run("30 ho");
  expect(rows[0]?.text).toBe("30 hours");
  expect(rows[0]?.kind).toBe("duration");
  expect(rows[0]?.unit).toBe("h");
});

test("an input with no trailing fragment offers nothing", () => {
  const completer = new Autocompleter({
    registry,
    locale: en,
    layers: [english.weights],
  });
  expect(completer.run("30")).toEqual([]);
  expect(completer.run("10 kg + ")).toEqual([]);
});

test("registry in the constructor reaches complete(), not a hardcoded default", () => {
  // A registry that knows only "number" has no unit aliases to offer at all —
  // an Autocompleter that ignored its own `registry` and reached for some other
  // fixture would still return the duration rows.
  const bare = buildRegistry([
    defineKind({
      id: "number",
      value: { mode: "ratio", canonical: "one", units: { one: 1 } },
    }),
  ]);
  const full = new Autocompleter({ registry, locale: en, layers: [english.weights] });
  const empty = new Autocompleter({
    registry: bare,
    locale: en,
    layers: [english.weights],
  });
  expect(full.run("30 ho").length).toBeGreaterThan(0);
  expect(empty.run("30 ho")).toEqual([]);
});

test("layers in the constructor reach complete(), reordering the same input", () => {
  // Mirrors complete.test.ts's "weight layers reorder the results": boosting
  // duration's layer flips which kind ranks first for an ambiguous prefix.
  const plain = new Autocompleter({ registry, locale: en, layers: [english.weights] });
  const boosted = new Autocompleter({
    registry,
    locale: en,
    layers: [english.weights, { duration: 20 }],
  });
  expect(plain.run("1 mi")[0]?.kind).not.toBe("duration");
  expect(boosted.run("1 mi")[0]?.kind).toBe("duration");
});

test("locale in the constructor reaches complete(), not a hardcoded default", () => {
  const seen: CompleteCtx[] = [];
  const probe: CompleterFn = (ctx) => {
    seen.push(ctx);
    return [];
  };
  const place = defineKind({
    id: "place",
    value: { mode: "opaque", units: { xx: ["xx"] } },
    completions: probe,
    format: (v) => v.unit,
  });
  const withPlace = buildRegistry([...BUILTIN_KINDS, place]);
  const other: Locale = composeLocale(
    defineLanguage({
      id: "xx-locale",
      numberFormat: "intl",
      keywords: english.keywords,
      selectForm: () => "other",
    }),
  );

  new Autocompleter({ registry: withPlace, locale: en, layers: [english.weights] }).run(
    "kyi",
  );
  new Autocompleter({
    registry: withPlace,
    locale: other,
    layers: [english.weights],
  }).run("kyi");

  expect(seen.map((c) => c.locale)).toEqual(["en", "xx-locale"]);
});

test("two run() calls with the same input return equal, deterministic output", () => {
  const completer = new Autocompleter({
    registry,
    locale: en,
    layers: [english.weights],
  });
  const a = completer.run("1 mi");
  const b = completer.run("1 mi");
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test("output is frozen", () => {
  const completer = new Autocompleter({
    registry,
    locale: en,
    layers: [english.weights],
  });
  const rows = completer.run("30 ho");
  expect(Object.isFrozen(rows)).toBe(true);
  // The container being frozen does not imply each `Completion` is — a test
  // that only checks `rows` itself would pass even if `deepFreeze` here
  // regressed to a shallow `Object.freeze`.
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(Object.isFrozen(row)).toBe(true);
  }
});

test("opts flow through to complete()", () => {
  const completer = new Autocompleter({
    registry,
    locale: en,
    layers: [english.weights],
  });
  const rows = completer.run("1 mi", { kinds: ["duration"] });
  expect(rows.every((r) => r.kind === "duration")).toBe(true);
});

test("the constructor destructures cfg rather than retaining it", () => {
  const cfg = {
    registry,
    locale: en,
    layers: [english.weights] as (Weights | undefined)[],
  };
  const completer = new Autocompleter(cfg);
  const before = completer.run("30 ho");
  // Mutated after construction: an `Autocompleter` that stored `cfg` itself (or
  // read `cfg.registry` lazily inside `run()`) would pick up an empty
  // registry here; one that destructured `registry` onto its own field at
  // construction time would not.
  cfg.registry = buildRegistry([
    defineKind({
      id: "number",
      value: { mode: "ratio", canonical: "one", units: { one: 1 } },
    }),
  ]);
  const after = completer.run("30 ho");
  expect(after).toEqual(before);
});

test("the constructor copies the layers array rather than aliasing it", () => {
  const layers: (Weights | undefined)[] = [english.weights];
  const completer = new Autocompleter({ registry, locale: en, layers });
  const before = completer.run("1 mi");
  // Pushed in place *after* construction: an `Autocompleter` that stored `layers`
  // by reference (`this.layers = cfg.layers`) would pick this up on the next
  // `run()` and flip the top result to `duration` — the "layers in the
  // constructor reach complete()" test above shows this exact boost does
  // that. The `[...cfg.layers]` copy in the constructor is what keeps a
  // later push on the caller's own array from mattering, the same class of
  // aliasing bug a Task 2 review caught in `Normalizer`.
  layers.push({ duration: 20 });
  const after = completer.run("1 mi");
  expect(after[0]?.kind).toBe(before[0]?.kind);
  expect(JSON.stringify(after)).toBe(JSON.stringify(before));
});
