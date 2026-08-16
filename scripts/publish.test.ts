import { expect, test } from "bun:test";
import { parseArgs } from "./publish";

/**
 * The flags, and nothing that talks to npm.
 *
 * `parseArgs` is the half of `publish.ts` that can be wrong quietly: every other
 * step announces itself, but a misread flag changes what a run does to a public
 * registry without saying so. A `--dry-run` that parsed as `false` would publish
 * 38 packages that somebody was only inspecting.
 */

test("defaults: interactive, opens the token page, publishes for real", () => {
  const args = parseArgs([]);
  expect(args.dryRun).toBe(false);
  expect(args.ci).toBe(false);
  expect(args.open).toBe(true);
  expect(args.distTag).toBe("latest");
  expect(args.only).toBeUndefined();
  expect(args.version).toBeUndefined();
});

// Opt-out rather than opt-in, because the moment the prompt appears is exactly
// when the page is wanted; a flag you have to remember would be a flag nobody
// types on the one run that needed it.
test("--no-open is the only way to stop the browser", () => {
  expect(parseArgs(["--no-open"]).open).toBe(false);
  expect(parseArgs(["--dry-run"]).open).toBe(true);
  expect(parseArgs(["--only", "@smartput/kind"]).open).toBe(true);
});

test("--dry-run and --ci are independent of each other", () => {
  const dry = parseArgs(["--dry-run"]);
  expect(dry.dryRun).toBe(true);
  expect(dry.ci).toBe(false);

  const ci = parseArgs(["--ci"]);
  expect(ci.ci).toBe(true);
  expect(ci.dryRun).toBe(false);
});

test("--only splits, trims, and drops empties", () => {
  expect(parseArgs(["--only", "@smartput/kind, @smartput/shared"]).only).toEqual([
    "@smartput/kind",
    "@smartput/shared",
  ]);
  expect(parseArgs(["--only", "@smartput/kind,,"]).only).toEqual(["@smartput/kind"]);
});

test("--version and --tag read the following argument", () => {
  const args = parseArgs(["--version", "0.2.0", "--tag", "next"]);
  expect(args.version).toBe("0.2.0");
  expect(args.distTag).toBe("next");
});

// A flag at the end with nothing after it reads as absent rather than as the
// string "undefined" — npm would take that as a dist-tag and publish under it.
test("a value flag with no value is absent, not the literal undefined", () => {
  expect(parseArgs(["--version"]).version).toBeUndefined();
  expect(parseArgs(["--tag"]).distTag).toBe("latest");
});
