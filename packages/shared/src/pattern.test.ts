import { expect, test } from "bun:test";
import { is } from "./parse";
import { patternFor } from "./pattern";
import type { UnitTable } from "./types";

const T: UnitTable<"rad" | "deg"> = {
  canonical: "rad",
  ratio: { rad: "1", deg: "0.017453292519943295" },
  alias: { rad: "rad", deg: "deg", degree: "deg", degrees: "deg" },
};

test("the pattern accepts what parse accepts", () => {
  const re = new RegExp(`^(?:${patternFor(T)})$`);
  // "deg" among them: loose parse reads a bare unit as one of it, and a field
  // the browser rejected but the parser accepted would be the disagreement
  // this test exists to catch.
  for (const good of ["30deg", "30 deg", "-30.5deg", "1e3deg", "30degrees", "deg"]) {
    expect(re.test(good), good).toBe(true);
  }
  for (const bad of ["30smth", "smth", "30,5deg", "30 deg extra"]) {
    expect(re.test(bad), bad).toBe(false);
  }
});

test("loose accepts outer whitespace and mixed case, strict does not", () => {
  const loose = new RegExp(`^(?:${patternFor(T)})$`);
  const strict = new RegExp(`^(?:${patternFor(T, { mode: "strict" })})$`);
  expect(loose.test("  30DEG  ")).toBe(true);
  expect(strict.test("  30DEG  ")).toBe(false);
  expect(strict.test("30deg")).toBe(true);
});

/**
 * An HTML `pattern` attribute takes no flags — there is nowhere to put `i` —
 * so a loose pattern that folded case by listing `deg|DEG` would reject
 * `30Deg`, which loose `parse` accepts. Per-character classes are what makes
 * the pattern an honest description of the parser rather than an
 * approximation of it.
 */
test("loose accepts every casing of an alias, as loose parse does", () => {
  const loose = new RegExp(`^(?:${patternFor(T)})$`);
  for (const casing of ["30deg", "30DEG", "30Deg", "30dEg", "30DeGrEeS"]) {
    expect(is(T, casing), `parse ${casing}`).toBe(true);
    expect(loose.test(casing), `pattern ${casing}`).toBe(true);
  }
});

test("strict is exactly what format emits: one casing, no padding", () => {
  const strict = new RegExp(`^(?:${patternFor(T, { mode: "strict" })})$`);
  expect(strict.test("30DEG")).toBe(false);
  expect(strict.test("30Deg")).toBe(false);
  expect(strict.test("30 deg")).toBe(true);
  expect(strict.test("30")).toBe(false);
});

test("aliases are escaped, so a regex metacharacter cannot break out", () => {
  const percent: UnitTable<"%"> = {
    canonical: "%",
    ratio: { "%": "0.01" },
    alias: { "%": "%", percent: "%", pct: "%" },
  };
  const re = new RegExp(`^(?:${patternFor(percent)})$`);
  expect(re.test("20%")).toBe(true);
  expect(re.test("20percent")).toBe(true);
  expect(re.test("20x")).toBe(false);
});

/**
 * The `pattern` attribute is compiled with the `v` flag by the HTML spec, and
 * `v` rejects escapes `u`-mode regexes tolerate. Compiling here is the only
 * way to find out that a table's aliases produced something a browser would
 * throw away — a browser ignores a malformed pattern and validates nothing.
 */
test("the emitted pattern compiles under the flags HTML uses", () => {
  const awkward: UnitTable<"m2"> = {
    canonical: "m2",
    ratio: { m2: "1" },
    alias: { m2: "m2", "m²": "m2", "sq.m": "m2", "m^2": "m2", "m-sq": "m2" },
  };
  for (const mode of ["loose", "strict"] as const) {
    const source = patternFor(awkward, { mode });
    for (const flags of ["v", "u", ""]) {
      expect(
        () => new RegExp(`^(?:${source})$`, flags),
        `${mode} /${flags}`,
      ).not.toThrow();
    }
    expect(new RegExp(`^(?:${source})$`, "v").test("7m²")).toBe(true);
  }
});

/**
 * The claim `patternFor` makes is agreement with `parse`, so the test is
 * agreement across a corpus rather than a handful of accepted forms.
 */
test("pattern and parse agree over a corpus, in both modes", () => {
  const corpus = [
    "30deg",
    "30 deg",
    "30  deg",
    "30\tdeg",
    "  30deg  ",
    "30DEG",
    "30Deg",
    "30degrees",
    "30DeGrEeS",
    "-30.5deg",
    "+30deg",
    ".5deg",
    "1e3deg",
    "+30e-2rad",
    "30.",
    "30,5deg",
    "30smth",
    "30 deg extra",
    "30deg extra",
    "deg",
    "",
    "   ",
  ];
  for (const mode of ["loose", "strict"] as const) {
    const re = new RegExp(`^(?:${patternFor(T, { mode })})$`);
    for (const input of corpus) {
      expect(re.test(input), `${mode} ${JSON.stringify(input)}`).toBe(
        is(T, input, { mode }),
      );
    }
  }
});

/**
 * The one place the pattern is deliberately narrower than `parse`: a bare
 * number is accepted by loose `parse` when `defaultUnit` is set, and the
 * table alone cannot know whether it was. A pattern that made the unit
 * optional would pass `30` through native validation on a field whose parser
 * rejects it, which is the worse failure of the two.
 */
test("the unit is required, which is narrower than defaultUnit parsing", () => {
  const loose = new RegExp(`^(?:${patternFor(T)})$`);
  expect(loose.test("30")).toBe(false);
  expect(is(T, "30", { defaultUnit: "deg" })).toBe(true);
});
