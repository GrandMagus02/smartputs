import { rootDir } from "./build";
import { type Manifest, readWorkspace, topoOrder } from "./pack";

/**
 * Works out what each package's next version is from the commits that touched
 * it, writes the version and its CHANGELOG entry, and prints the plan.
 *
 * Per-package versions rather than one number for the repo: `@smartput/geo`
 * moving does not make `@smartput/percent` a new release, and a consumer who
 * pinned percent should not be told there is an update when nothing in it
 * changed. Which commits belong to a package is a path question — `git log --
 * packages/<name>` — so the answer needs no annotation file and cannot drift
 * from what was actually edited.
 *
 * Conventional Commits decide the size of the bump, with the 0.x rule
 * semantic-release uses: while a package is below 1.0.0 a breaking change is a
 * minor, because major would claim a stability the package has not offered yet.
 *
 * A bumped package drags its dependents with it, at patch. `@smartput/length`
 * publishing against `^0.2.0` of `@smartput/kind` has to be republished when
 * kind becomes 0.3.0, or its range points at a version that is no longer the
 * one it was tested against.
 *
 *   bun run release --dry-run     # print the plan, touch nothing
 *   bun run release               # write versions + changelogs
 *   bun run release --json        # the plan, for CI to read
 */

const REPO_URL = "https://github.com/GrandMagus02/smartputs";

export type Bump = "major" | "minor" | "patch" | "none";

const RANK: Record<Bump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

export interface Commit {
  hash: string;
  type: string;
  scope: string;
  breaking: boolean;
  subject: string;
  body: string;
}

export interface Plan {
  name: string;
  dir: string;
  from: string;
  to: string;
  bump: Bump;
  /** Empty when the package moves only because a dependency did. */
  commits: Commit[];
  reason: "commits" | "dependency";
}

/** Types that produce a release. Everything else documents or tidies. */
const BUMP_OF: Record<string, Bump> = {
  feat: "minor",
  fix: "patch",
  perf: "patch",
  revert: "patch",
};

/** The types a commit subject may use — `check-commits.ts` enforces the same list. */
export const TYPES = [
  "feat",
  "fix",
  "perf",
  "revert",
  "docs",
  "style",
  "refactor",
  "test",
  "build",
  "ci",
  "chore",
];

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s*(?<subject>.+)$/;

export function parseCommit(
  hash: string,
  subject: string,
  body: string,
): Commit | undefined {
  const m = HEADER.exec(subject.trim());
  if (!m?.groups) return undefined;
  const breaking = m.groups.bang === "!" || /^BREAKING[ -]CHANGE:/m.test(body);
  return {
    hash,
    type: m.groups.type,
    scope: m.groups.scope ?? "",
    breaking,
    subject: m.groups.subject.trim(),
    body: body.trim(),
  };
}

export function bumpOf(commits: Commit[], currentMajor: number): Bump {
  let bump: Bump = "none";
  const raise = (next: Bump) => {
    if (RANK[next] > RANK[bump]) bump = next;
  };
  for (const commit of commits) {
    if (commit.breaking) raise(currentMajor === 0 ? "minor" : "major");
    raise(BUMP_OF[commit.type] ?? "none");
  }
  return bump;
}

export function nextVersion(version: string, bump: Bump): string {
  const [major, minor, patch] = version.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  return version;
}

export async function git(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  return exitCode === 0 ? stdout : "";
}

/** Highest `<name>@x.y.z` tag, or undefined when the package has never shipped. */
export async function lastTag(name: string): Promise<string | undefined> {
  const tags = (await git(["tag", "--list", `${name}@*`])).split("\n").filter(Boolean);
  const versions = tags
    .map((tag) => tag.slice(name.length + 1))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
    .sort(compareVersions);
  const highest = versions.at(-1);
  return highest ? `${name}@${highest}` : undefined;
}

export function compareVersions(a: string, b: string): number {
  const [am, an, ap] = a.split(".").map(Number);
  const [bm, bn, bp] = b.split(".").map(Number);
  return am - bm || an - bn || ap - bp;
}

/**
 * Commits that touched a package directory: since `from` (or the whole
 * history) and up to `to`, which the changelog backfill points at a tag rather
 * than at `HEAD` so an old version's entry lists only what that version had.
 */
export async function commitsFor(
  dir: string,
  from: string | undefined,
  to = "HEAD",
): Promise<Commit[]> {
  const range = from ? `${from}..${to}` : to;
  const log = await git(["log", range, "--format=%x1e%H%x1f%s%x1f%b", "--", dir]);
  return log
    .split("\u001e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body = ""] = record.split("\u001f");
      return parseCommit(hash, subject, body);
    })
    .filter((c): c is Commit => c !== undefined);
}

/** Reverse dependency edges, over runtime and peer deps only. */
function dependentsOf(workspace: Map<string, { pkg: Manifest }>): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const [name, { pkg }] of workspace) {
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      if (!workspace.has(dep)) continue;
      dependents.set(dep, [...(dependents.get(dep) ?? []), name]);
    }
  }
  return dependents;
}

export async function buildPlan(): Promise<Plan[]> {
  const workspace = await readWorkspace();
  const plans = new Map<string, Plan>();

  for (const [name, { dir, pkg }] of workspace) {
    const from = await lastTag(name);
    const commits = await commitsFor(dir, from);
    const bump = bumpOf(commits, Number(pkg.version.split(".")[0]));
    if (bump === "none") continue;
    plans.set(name, {
      name,
      dir,
      from: pkg.version,
      to: nextVersion(pkg.version, bump),
      bump,
      commits,
      reason: "commits",
    });
  }

  // Pull dependents along, transitively. Topological order means a package is
  // visited after everything it depends on, so one pass settles the graph.
  const dependents = dependentsOf(workspace);
  for (const name of topoOrder(workspace)) {
    if (!plans.has(name)) continue;
    for (const dependent of dependents.get(name) ?? []) {
      if (plans.has(dependent)) continue;
      const entry = workspace.get(dependent);
      if (!entry) continue;
      plans.set(dependent, {
        name: dependent,
        dir: entry.dir,
        from: entry.pkg.version,
        to: nextVersion(entry.pkg.version, "patch"),
        bump: "patch",
        commits: [],
        reason: "dependency",
      });
    }
  }

  return topoOrder(workspace)
    .filter((name) => plans.has(name))
    .map((name) => plans.get(name) as Plan);
}

const SECTIONS: Array<[string, (c: Commit) => boolean]> = [
  ["BREAKING CHANGES", (c) => c.breaking],
  ["Features", (c) => c.type === "feat" && !c.breaking],
  ["Bug Fixes", (c) => c.type === "fix" && !c.breaking],
  ["Performance", (c) => c.type === "perf" && !c.breaking],
  ["Reverts", (c) => c.type === "revert" && !c.breaking],
];

export function changelogEntry(plan: Plan, date: string): string {
  const lines = [`## ${plan.to} (${date})`, ""];
  if (plan.commits.length === 0) {
    lines.push("Released to pick up a new version of a workspace dependency.", "");
    return lines.join("\n");
  }
  for (const [title, matches] of SECTIONS) {
    const picked = plan.commits.filter(matches);
    if (picked.length === 0) continue;
    lines.push(`### ${title}`, "");
    for (const commit of picked) {
      const scope = commit.scope ? `**${commit.scope}:** ` : "";
      const link = `([${commit.hash.slice(0, 7)}](${REPO_URL}/commit/${commit.hash}))`;
      lines.push(`- ${scope}${commit.subject} ${link}`);
      if (commit.breaking) {
        const note = /BREAKING[ -]CHANGE:\s*([\s\S]+)/.exec(commit.body)?.[1]?.trim();
        if (note) lines.push(`  ${note.split("\n").join("\n  ")}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Prepends an entry, keeping the file's `# Changelog` heading on top. */
async function writeChangelog(plan: Plan, date: string) {
  const path = `${rootDir}/${plan.dir}/CHANGELOG.md`;
  const file = Bun.file(path);
  const head = `# ${plan.name}\n\n`;
  const previous = (await file.exists()) ? (await file.text()).replace(head, "") : "";
  await Bun.write(path, `${head}${changelogEntry(plan, date)}\n${previous.trimStart()}`);
}

async function writeVersion(plan: Plan) {
  const path = `${rootDir}/${plan.dir}/package.json`;
  const text = await Bun.file(path).text();
  await Bun.write(path, text.replace(/("version":\s*)"[^"]*"/, `$1"${plan.to}"`));
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const asJson = argv.includes("--json");
  const plans = await buildPlan();

  if (asJson) {
    console.log(
      JSON.stringify(
        plans.map(({ commits, ...rest }) => rest),
        null,
        2,
      ),
    );
  } else {
    if (plans.length === 0) console.log("no releasable commits since the last tags.");
    for (const plan of plans) {
      const why =
        plan.reason === "dependency" ? "dependency" : `${plan.commits.length} commit(s)`;
      console.log(`${plan.name}  ${plan.from} → ${plan.to}  (${plan.bump}, ${why})`);
    }
  }

  if (dryRun || plans.length === 0) return;

  // The commit date, not the wall clock: a release run twice from the same
  // commit writes the same changelog.
  const date = (await git(["log", "-1", "--format=%cs"])).trim();
  for (const plan of plans) {
    await writeVersion(plan);
    await writeChangelog(plan, date);
  }
  console.log(`\nwrote ${plans.length} version(s) and changelog entr(ies).`);
}

if (import.meta.main) await main();
