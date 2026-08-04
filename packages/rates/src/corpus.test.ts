import { expect, test } from "bun:test";
import { createEngine, number } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { money } from "./money";
import { snapshot } from "./snapshot";

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });
const engine = createEngine({ locales: [en], kinds: [number, money], rates });
const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [input, kind, canonical, formatted] of rows) {
  test(`corpus: ${input}`, () => {
    const r = engine.evaluate(input as string);
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}
