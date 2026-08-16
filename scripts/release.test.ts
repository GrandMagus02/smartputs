import { describe, expect, test } from "bun:test";
import { bumpOf, type Commit, changelogEntry, nextVersion, parseCommit } from "./release";

const commit = (subject: string, body = ""): Commit => {
  const parsed = parseCommit("0123456789abcdef", subject, body);
  if (!parsed) throw new Error(`unparseable: ${subject}`);
  return parsed;
};

describe("parseCommit", () => {
  test("reads type, scope and subject", () => {
    const c = commit("feat(length): add the nautical mile");
    expect(c.type).toBe("feat");
    expect(c.scope).toBe("length");
    expect(c.subject).toBe("add the nautical mile");
    expect(c.breaking).toBe(false);
  });

  test("a scope is optional", () => {
    expect(commit("fix: stop rounding the yard").scope).toBe("");
  });

  test("`!` and a BREAKING CHANGE footer both mean breaking", () => {
    expect(commit("feat(core)!: rename parse()").breaking).toBe(true);
    expect(
      commit("feat(core): rename parse()", "BREAKING CHANGE: parse is now solve")
        .breaking,
    ).toBe(true);
  });

  test("a subject outside the convention is not a commit we can release from", () => {
    expect(parseCommit("abc", "made things better", "")).toBeUndefined();
  });
});

describe("bumpOf", () => {
  test("takes the largest bump in the set", () => {
    expect(bumpOf([commit("fix: a"), commit("feat: b"), commit("docs: c")], 1)).toBe(
      "minor",
    );
  });

  test("only feat, fix, perf and revert release anything", () => {
    const quiet = ["docs: a", "style: b", "refactor: c", "test: d", "chore: e", "ci: f"];
    expect(
      bumpOf(
        quiet.map((s) => commit(s)),
        1,
      ),
    ).toBe("none");
  });

  // The 0.x rule: a package that has never promised stability cannot break it.
  test("a breaking change is major at 1.x and minor at 0.x", () => {
    expect(bumpOf([commit("feat!: a")], 1)).toBe("major");
    expect(bumpOf([commit("feat!: a")], 0)).toBe("minor");
  });
});

describe("nextVersion", () => {
  test("resets the lower parts", () => {
    expect(nextVersion("1.4.2", "major")).toBe("2.0.0");
    expect(nextVersion("1.4.2", "minor")).toBe("1.5.0");
    expect(nextVersion("1.4.2", "patch")).toBe("1.4.3");
    expect(nextVersion("1.4.2", "none")).toBe("1.4.2");
  });
});

describe("changelogEntry", () => {
  const plan = {
    name: "@smartput/length",
    dir: "packages/length",
    from: "0.1.0",
    to: "0.2.0",
    bump: "minor" as const,
    reason: "commits" as const,
    commits: [
      commit("feat(length): add the nautical mile"),
      commit("fix: stop rounding the yard"),
      commit("feat!: drop parseLength", "BREAKING CHANGE: use parse() instead"),
    ],
  };

  test("groups by section and links every commit", () => {
    const entry = changelogEntry(plan, "2026-08-16");
    expect(entry).toContain("## 0.2.0 (2026-08-16)");
    expect(entry).toContain("### BREAKING CHANGES");
    expect(entry).toContain("### Features");
    expect(entry).toContain("### Bug Fixes");
    expect(entry).toContain("**length:** add the nautical mile");
    expect(entry).toContain("use parse() instead");
    expect(entry).toContain("/commit/0123456789abcdef");
  });

  test("a breaking commit appears once, under BREAKING CHANGES", () => {
    const entry = changelogEntry(plan, "2026-08-16");
    expect(entry.split("drop parseLength").length - 1).toBe(1);
  });

  // A dependency-driven release has no commits of its own; the entry still has
  // to say why the version moved.
  test("says so when the release is only a dependency bump", () => {
    const entry = changelogEntry(
      { ...plan, commits: [], reason: "dependency" },
      "2026-08-16",
    );
    expect(entry).toContain("workspace dependency");
  });
});
