import { expect, test } from "bun:test";
import { add, as, format, scale, sub } from "./ops";
import { parse } from "./parse";
import type { Ok, Parsed, UnitTable } from "./types";

/**
 * The corpus for `@smartput/shared`: the micro path, read the way a form field
 * reads it — a `UnitTable`, a parser, the free operations and the formatter,
 * with no engine, no `Decimal` and no kind package anywhere underneath.
 *
 * The table is declared here rather than imported. This package's whole claim
 * is zero runtime dependencies, and `@smartput/length` would be the first edge
 * even as a devDependency; a length table is thirty lines, and writing it out
 * is also the closest thing to the documentation a consumer needs — this is
 * what a `UnitTable` looks like.
 *
 * Seven columns, because a micro parse has more than one way to be wrong and
 * the difference between the ways is the feature: `missing-unit`, `nan` and
 * `unknown-unit` are three different things to say to somebody filling in a
 * form, and a corpus that only checked `ok === false` would let them collapse.
 */
const LENGTH: UnitTable<"mm" | "cm" | "m" | "km" | "in" | "ft"> = {
  canonical: "m",
  ratio: { mm: "0.001", cm: "0.01", m: "1", km: "1000", in: "0.0254", ft: "0.3048" },
  alias: {
    mm: "mm",
    millimetre: "mm",
    millimetres: "mm",
    cm: "cm",
    centimetre: "cm",
    centimetres: "cm",
    m: "m",
    metre: "m",
    metres: "m",
    km: "km",
    kilometre: "km",
    kilometres: "km",
    in: "in",
    inch: "in",
    inches: "in",
    ft: "ft",
    foot: "ft",
    feet: "ft",
  },
};

type Unit = "mm" | "cm" | "m" | "km" | "in" | "ft";

const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

/**
 * Deliberately not trimmed, unlike every other corpus reader in the repo.
 * Three rows are *about* the whitespace around a value — loose trims it, strict
 * reports `trailing` — and trimming the line would erase the input those rows
 * are asserting on. Blank lines are dropped by length, comments by their `#`.
 */
const rows = raw
  .split("\n")
  .filter((line) => line.trim().length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

/** The row's `op` column, applied to the expression its `input` column holds. */
function run(op: string, input: string, mode: "strict" | "loose"): Parsed<Unit> {
  const opts = { mode };
  if (op === "parse") return parse(LENGTH, input, opts);
  if (op === "add") {
    const [l, r] = input.split(" + ");
    return add(LENGTH, l as string, r as string, opts);
  }
  if (op === "sub") {
    const [l, r] = input.split(" - ");
    return sub(LENGTH, l as string, r as string, opts);
  }
  if (op === "scale") {
    const [l, r] = input.split(" * ");
    return scale(LENGTH, l as string, Number(r), opts);
  }
  if (op === "as") {
    const [l, r] = input.split(" in ");
    return as(LENGTH, l as string, r as Unit, opts);
  }
  throw new Error(`the corpus names an operation this file does not run: ${op}`);
}

for (const [input, op, mode, outcome, unit, value, formatted] of rows) {
  test(`corpus: ${op} ${JSON.stringify(input)} (${mode})`, () => {
    const result = run(op as string, input as string, mode as "strict" | "loose");

    if (outcome !== "ok") {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(outcome as never);
      return;
    }

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unit).toBe(unit as Unit);
    expect(result.value).toBe(Number(value));
    expect(format(LENGTH, result as Ok<Unit>)).toBe(formatted as string);
  });
}

/**
 * Strict mode accepts what `format` emits and nothing else, so every successful
 * row's own rendering has to survive a strict re-read. Asserted over the whole
 * corpus rather than as one hand-picked example, because the property is what
 * makes the pair usable as a serialization format at all.
 */
test("every formatted answer parses back in strict mode", () => {
  for (const [input, op, mode, outcome, , , formatted] of rows) {
    if (outcome !== "ok") continue;
    const again = parse(LENGTH, formatted as string, { mode: "strict" });
    expect({ input, op, mode, ok: again.ok }).toEqual({ input, op, mode, ok: true });
  }
});

test("the corpus records refusals as well as answers", () => {
  expect(rows.filter((r) => r[3] !== "ok").length).toBeGreaterThan(4);
});
