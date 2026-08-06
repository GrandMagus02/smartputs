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

test("outputs are frozen", () => {
  const n = normalize("  30 deg  ");
  expect(Object.isFrozen(n)).toBe(true);
  expect(Object.isFrozen(n.edits)).toBe(true);
});
