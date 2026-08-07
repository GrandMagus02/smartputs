import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english as coreEn } from "@smartput/locale-en";
import { datetime } from "./datetime";
import en from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const engine = createEngine({
  locales: [composeLocale(coreEn)],
  kinds: [...BUILTIN_KINDS, datetime],
  packs: [en],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(20);
});

for (const [input, kind, canonical, formatted] of rows) {
  test(`corpus: ${input}`, () => {
    const r = engine.evaluate(input as string);
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}
