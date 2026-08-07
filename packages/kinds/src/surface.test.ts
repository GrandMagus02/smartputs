import { expect, test } from "bun:test";
import type { Kind } from "@smartput/core";
import { composeLocale, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
// The package root is the only surface a consumer of @smartput/kinds has, and
// these named imports are the assertion: until they existed, the aggregator
// re-exported four of the twelve kinds and `measure` was reachable by no route
// at all. It is deliberately kept out of BUILTIN_KINDS (its mm/cm aliases
// collide with `length`), so opting in by name is the only way to use it — and
// there was no name to opt in with. A missing export fails typecheck here.
import {
  angle,
  area,
  BUILTIN_KINDS,
  boolean,
  datarate,
  datasize,
  duration,
  energy,
  length,
  mass,
  measure,
  number,
  percent,
  power,
  speed,
  tempdelta,
  temperature,
  tempo,
  volume,
} from "./index";

const NAMED: Kind[] = [
  angle,
  area,
  boolean,
  datarate,
  datasize,
  duration,
  energy,
  length,
  mass,
  measure,
  number,
  percent,
  power,
  speed,
  tempdelta,
  temperature,
  tempo,
  volume,
];

test("every built-in kind is exported from the package root by name", () => {
  expect(NAMED.map((k) => k.id).sort()).toEqual([
    "angle",
    "area",
    "boolean",
    "datarate",
    "datasize",
    "duration",
    "energy",
    "length",
    "mass",
    "measure",
    "number",
    "percent",
    "power",
    "speed",
    "tempdelta",
    "temperature",
    "tempo",
    "volume",
  ]);
});

test("BUILTIN_KINDS is the named roster minus measure", () => {
  const ids = BUILTIN_KINDS.map((k) => k.id).sort();
  expect(ids).not.toContain("measure");
  expect(ids).toEqual(
    NAMED.map((k) => k.id)
      .filter((id) => id !== "measure")
      .sort(),
  );
});

test("measure is usable via createEngine using only package-root imports", () => {
  // This is the case that was silently broken: Task 7's entire deliverable is
  // unreachable without a named export, because measure cannot be opted into
  // through BUILTIN_KINDS.
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [...BUILTIN_KINDS, measure],
  });
  expect(engine.evaluate("96 px in inch").formatted).toBe("1 inch");
});
