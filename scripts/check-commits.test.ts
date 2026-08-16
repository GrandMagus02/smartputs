import { describe, expect, test } from "bun:test";
import { allowedScopes, checkSubject } from "./check-commits";

const scopes = allowedScopes();
const check = (subject: string) => checkSubject("abc1234", subject, scopes)?.message;

describe("checkSubject", () => {
  test("accepts a conventional subject, with or without a scope", () => {
    expect(check("feat(length): add the nautical mile")).toBeUndefined();
    expect(check("fix: stop rounding the yard")).toBeUndefined();
    expect(check("feat(core)!: rename parse()")).toBeUndefined();
  });

  test("a package name is a scope, and so are the repo-wide areas", () => {
    expect(check("chore(deps): bump decimal.js")).toBeUndefined();
    expect(check("ci(release): publish with provenance")).toBeUndefined();
    expect(check("fix(lenght): typo in the scope")).toMatch(/unknown scope/);
  });

  test("rejects what the release script cannot read", () => {
    expect(check("made things better")).toMatch(/Conventional Commits/);
    expect(check("feature(length): add a unit")).toMatch(/unknown type/);
  });

  test("rejects the house-style slips", () => {
    expect(check("fix: Stop rounding the yard")).toMatch(/capital/);
    expect(check("fix: stop rounding the yard.")).toMatch(/full stop/);
    expect(check(`fix: ${"x".repeat(80)}`)).toMatch(/over the 72/);
  });
});
