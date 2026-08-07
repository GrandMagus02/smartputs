import { expect, test } from "bun:test";
import { ADMIN1, CITIES } from "@smartput/city";
import { composeLocale, createEngine } from "@smartput/core";
import { length } from "@smartput/length";
import { english as en } from "@smartput/locale-en";
import { number } from "@smartput/number";
import { definePlace } from "./place";

// `length` is registered because the distance op resolves to it, and `number`
// because length's generated scaling ops name it.
//
// The fully loaded kind rather than the T0 `place`: the corpus is what this
// package answers when a consumer has taken everything it publishes, and half
// the rows below are cities. That the T0 build is a working package on its own —
// same country readings, no city — is place.test.ts's claim, asserted there
// against both builds side by side rather than implied by which import this
// file happens to use.
const engine = createEngine({
  locales: [composeLocale(en)],
  kinds: [number, length, definePlace({ cities: CITIES, admin1: ADMIN1 })],
});
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
