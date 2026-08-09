import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";

/**
 * The corpus for `@smartput/kinds`: the whole built-in set, wired the way the
 * README wires it, asked the questions no single kind package can answer.
 *
 * Every other kind package's corpus stands up the smallest engine that can read
 * its own rows. This one is the opposite claim — that the set ships *together*
 * and the seams between its members hold. `datarate`, `energy`, `speed`,
 * `area` and `tempo` each declare signatures naming their operand kinds by id
 * string, and registry pass 4 keys the op table without checking those ids
 * resolve, so an operand quietly dropped from `BUILTIN_KINDS` makes the
 * signature unreachable rather than a build error. The bridge rows below are
 * the only thing that fails when that happens.
 */
const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
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
