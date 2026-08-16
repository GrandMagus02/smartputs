import { expect, test } from "bun:test";
import { Normalizer, normalize } from "./normalize";

test("the passes that existed before still run", () => {
  expect(normalize("  30   deg  ").text).toBe("30 deg");
  expect(normalize("30 − 5").text).toBe("30 - 5");
  expect(normalize("20 °C").text).toBe("20 C");
  expect(normalize("30​deg").text).toBe("30deg");
  expect(normalize("１０ kg").text).toBe("10 kg");
});

test("empty input is reported, not thrown", () => {
  expect(normalize("").empty).toBe(true);
  expect(normalize("   ").empty).toBe(true);
  expect(normalize("30deg").empty).toBe(false);
});

test("source is preserved verbatim", () => {
  const n = normalize("  30 °C  ");
  expect(n.source).toBe("  30 °C  ");
  expect(n.text).toBe("30 C");
});

test("mapSpan translates a normalized span back to the source", () => {
  // The four cases measured on main. Three of them sliced wrong before this.
  for (const [source, expectedSlice] of [
    ["30 deg + 15 deg", "30 deg + 15 deg"],
    ["30 °C + 5 C", "30 °C + 5 C"],
    ["  30 deg  ", "30 deg"],
    ["30  deg + 15 deg", "30  deg + 15 deg"],
  ] as const) {
    const n = normalize(source);
    const whole = n.mapSpan({ start: 0, end: n.text.length });
    expect(source.slice(whole.start, whole.end), source).toBe(expectedSlice);
  }
});

test("mapSpan is exact for an interior span", () => {
  const n = normalize("  30  deg + 15 deg  ");
  expect(n.text).toBe("30 deg + 15 deg");
  // "15 deg" starts at index 9 of the normalized text.
  const span = n.mapSpan({ start: 9, end: 15 });
  expect(n.source.slice(span.start, span.end)).toBe("15 deg");
});

test("mapSpan on unchanged input is the identity", () => {
  const n = normalize("30 deg + 15 deg");
  expect(n.edits).toHaveLength(0);
  expect(n.mapSpan({ start: 5, end: 8 })).toEqual({ start: 5, end: 8 });
});

test("every pass can be turned off", () => {
  expect(normalize("20 °C", { degree: false }).text).toBe("20 °C");
  expect(normalize("  30deg  ", { trim: false }).text).toBe(" 30deg ");
  expect(normalize("30 − 5", { dashes: false }).text).toBe("30 − 5");
  expect(normalize("a  b", { whitespace: false }).text).toBe("a  b");
});

test("edits record what changed and why", () => {
  const n = normalize("  20 °C  ");
  const reasons = n.edits.map((e) => e.reason);
  expect(reasons).toContain("degree");
  expect(reasons).toContain("trim");
  for (const edit of n.edits) {
    expect(edit.at.end).toBeGreaterThanOrEqual(edit.at.start);
    expect(edit.length).toBeGreaterThanOrEqual(0);
  }
});

test("a leading trim edit does not re-cover a degree/zero-width position under a second reason", () => {
  // Regression: the leading-trim edit used to be recorded as
  // { start: 0, end: i }, which re-reported the degree sign's own position
  // (already covered by its own "degree" edit) under "trim" too.
  const n = normalize("°  30");
  expect(n.text).toBe("30");
  expect(n.edits).toEqual([
    { at: { start: 0, end: 1 }, length: 0, reason: "degree" },
    { at: { start: 2, end: 3 }, length: 0, reason: "whitespace" },
    { at: { start: 1, end: 3 }, length: 0, reason: "trim" },
  ]);
});

test("the repair hook runs after the built-in passes and its edits are recorded", () => {
  const seen: string[] = [];
  const n = normalize("30 d", {
    repair: (text) => {
      seen.push(text);
      return [{ at: { start: 3, end: 4 }, length: 3, reason: "nfkc" }];
    },
  });
  // The hook sees the already-normalized text, not the source.
  expect(seen).toEqual(["30 d"]);
  expect(n.edits.some((e) => e.at.start === 3)).toBe(true);
});

test("the class holds config and returns equal output across calls", () => {
  const n = new Normalizer({ degree: false });
  expect(Object.isFrozen(n)).toBe(true);
  expect(n.run("20 °C").text).toBe("20 °C");
  expect(n.run("20 °C")).toEqual(n.run("20 °C"));
});

test("mutating the config object after construction does not change run()", () => {
  const cfg = { degree: false };
  const n = new Normalizer(cfg);
  cfg.degree = true;
  expect(n.run("20 °C").text).toBe("20 °C");
});

test("mapSpan is exact through a same-length NFKC fold", () => {
  // U+00A0 (NBSP) folds to a plain space under NFKC — same length, one code
  // point in, one code point out. This is exactly the input class pasting
  // from a web page produces, and the whole point of the fix: before it,
  // ANY NFKC change at all — even one that alters nothing but which
  // character is present — sent mapSpan to the whole-source fallback.
  const n = normalize("5 km");
  expect(n.text).toBe("5 km");
  expect(n.mapSpan({ start: 0, end: 4 })).toEqual({ start: 0, end: 4 });
  expect(n.source.slice(0, 4)).toBe("5 km");
});

test("mapSpan is exact through a length-changing NFKC fold", () => {
  // "½" is one source code point that folds to the three characters "1⁄2" —
  // still one-code-point-in, N-characters-out, so still derivable per code
  // point. All three output characters map back to the same source index.
  const n = normalize("½ cup");
  expect(n.text).toBe("1⁄2 cup");
  expect(n.mapSpan({ start: 0, end: 3 })).toEqual({ start: 0, end: 1 });
  expect(n.mapSpan({ start: 4, end: 7 })).toEqual({ start: 2, end: 5 });
});

test("mapSpan still takes the whole-source fallback when NFKC composes code points together", () => {
  // "café" written as "cafe" + combining acute (U+0301): NFKC composes the
  // "e" and the accent into one "é", which is not one-code-point-in/N-out —
  // it consumes two source code points to produce one output character, so
  // there is no per-character correspondence back to the source. This case
  // keeps today's behavior exactly.
  const n = normalize("café");
  expect(n.text).toBe("café");
  expect(n.mapSpan({ start: 0, end: 4 })).toEqual({ start: 0, end: n.source.length });
});

test("outputs are frozen", () => {
  const n = normalize("  30 deg  ");
  expect(Object.isFrozen(n)).toBe(true);
  expect(Object.isFrozen(n.edits)).toBe(true);
  // The container being frozen does not imply each `Edit` entry is — this
  // input's leading/trailing whitespace runs guarantee `edits` is non-empty.
  expect(n.edits.length).toBeGreaterThan(0);
  for (const edit of n.edits) {
    expect(Object.isFrozen(edit)).toBe(true);
  }
});
