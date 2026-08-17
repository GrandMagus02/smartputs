import { rootDir } from "./build";
import { readWorkspace } from "./pack";
import { changelogEntry, commitsFor, compareVersions, git, type Plan } from "./release";

/**
 * Writes every package's CHANGELOG.md from the tags it already carries.
 *
 * `release.ts` appends one entry per release, which leaves the versions that
 * shipped before it — 0.1.0, tagged and published — with no file at all. This
 * rebuilds the whole history from git instead: for each `<name>@x.y.z` tag, the
 * commits between it and the tag before it, rendered by the same
 * `changelogEntry` the release run uses, so a backfilled entry and a future one
 * are the same shape.
 *
 * Idempotent, and safe to re-run: every date comes from the tagged commit, not
 * the wall clock, and the file is rewritten from the tags rather than prepended
 * to. Packages with no tag are skipped — they have not shipped, so there is
 * nothing to write about.
 *
 *   bun run changelogs            # write packages/<name>/CHANGELOG.md
 *   bun run changelogs --check    # exit 1 if any file is missing or stale
 */

/** Every `<name>@x.y.z` tag for a package, oldest first. */
async function taggedVersions(name: string): Promise<string[]> {
  const tags = (await git(["tag", "--list", `${name}@*`])).split("\n").filter(Boolean);
  return tags
    .map((tag) => tag.slice(name.length + 1))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort(compareVersions);
}

/** The tagged commit's date — the day the version shipped. */
async function dateOf(tag: string): Promise<string> {
  return (await git(["log", "-1", "--format=%cs", tag])).trim();
}

async function render(name: string, dir: string): Promise<string | undefined> {
  const versions = await taggedVersions(name);
  if (versions.length === 0) return undefined;

  const entries: string[] = [];
  for (const [index, version] of versions.entries()) {
    const tag = `${name}@${version}`;
    const previous = versions[index - 1];
    const commits = await commitsFor(
      dir,
      previous ? `${name}@${previous}` : undefined,
      tag,
    );
    const plan: Plan = {
      name,
      dir,
      from: previous ?? "0.0.0",
      to: version,
      bump: "minor",
      commits,
      // `reason` only decides the wording when there are no commits, and the
      // first release of a package that has never been touched on its own is
      // exactly that case: it moved because a dependency did.
      reason: commits.length === 0 ? "dependency" : "commits",
    };
    entries.push(changelogEntry(plan, await dateOf(tag)));
  }

  // Newest first, the order `release.ts` prepends in.
  return `# ${name}\n\n${entries.reverse().join("\n").trimEnd()}\n`;
}

async function main() {
  const check = process.argv.slice(2).includes("--check");
  const workspace = await readWorkspace();
  const stale: string[] = [];
  let written = 0;

  for (const [name, { dir }] of workspace) {
    const text = await render(name, dir);
    if (text === undefined) {
      console.log(`${name}: never tagged, skipped`);
      continue;
    }
    const path = `${rootDir}/${dir}/CHANGELOG.md`;
    const file = Bun.file(path);
    const current = (await file.exists()) ? await file.text() : "";
    if (current === text) continue;
    if (check) {
      stale.push(name);
      continue;
    }
    await Bun.write(path, text);
    written += 1;
  }

  if (check) {
    if (stale.length === 0) {
      console.log("every CHANGELOG.md is up to date.");
      return;
    }
    console.error(
      `${stale.length} CHANGELOG.md out of date — run \`bun run changelogs\`:\n  ${stale.join("\n  ")}`,
    );
    process.exit(1);
  }
  console.log(`wrote ${written} CHANGELOG.md file(s).`);
}

if (import.meta.main) await main();
