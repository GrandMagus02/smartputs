import { expect, test } from "bun:test";
import { composeLocale, createEngine, KindConflictError } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { area } from "./index";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("length times length is an area", () => {
  const r = engine.evaluate("3 m * 4 m");
  expect(r.kind).toBe("area");
  expect(r.value.canonical.toString()).toBe("12");
});

test("scaling a length by a number is still a length", () => {
  // Not "3 m * 4": duration's "min" unit also aliases "m" (see
  // duration.ts), so a bare "m" with no other-kind context to disambiguate
  // is a genuine 50/50 tie between length:m and duration:min and throws
  // AmbiguityError — independent of this file, reproducible on plain
  // BUILTIN_KINDS. "km" has no such alias collision.
  expect(engine.evaluate("3 km * 4").kind).toBe("length");
});

test("registering two kinds that claim the same signature throws", () => {
  const impostor = {
    ...area,
    id: "impostor",
  };
  // `area` is already in BUILTIN_KINDS, so it must not be spread again here —
  // that would throw KindConflictError("registered twice") from pass 1
  // (duplicate id) before pass 4 ever compares signatures, which would pass
  // this test for the wrong reason. Only `impostor` is added, so the failure
  // this test asserts comes from pass 4: two distinct kind ids both claiming
  // area's `*` signature.
  expect(() =>
    createEngine({
      locales: [composeLocale(en, BUILTIN_EN)],
      kinds: [...BUILTIN_KINDS, impostor],
    }),
  ).toThrow(KindConflictError);
});
