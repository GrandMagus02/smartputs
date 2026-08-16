import { rootDir } from "./build";
import { packageDirs } from "./pack";
import { TYPES } from "./release";

/**
 * Fails on a commit subject that `release.ts` could not read.
 *
 * The version numbers and the CHANGELOG are computed from commit subjects, so a
 * subject outside Conventional Commits is not a style slip — it is a change
 * that silently releases nothing and appears in no changelog. Checking it on
 * the pull request is the only moment where it is still cheap to fix.
 *
 * Merge commits are skipped: GitHub writes those subjects, not the author.
 *
 *   bun run check-commits                 # HEAD only
 *   bun run check-commits origin/main..HEAD
 */

const SUBJECT = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<subject>.+)$/;
const MAX_SUBJECT = 72;

/** Scopes a subject may name: a package, or one of the repo-wide areas. */
export function allowedScopes(): Set<string> {
  const areas = ["repo", "ci", "deps", "docs", "scripts", "release"];
  return new Set([...packageDirs().map((d) => d.replace("packages/", "")), ...areas]);
}

export interface Problem {
  hash: string;
  subject: string;
  message: string;
}

export function checkSubject(
  hash: string,
  subject: string,
  scopes: Set<string>,
): Problem | undefined {
  const fail = (message: string) => ({ hash, subject, message });
  const m = SUBJECT.exec(subject);
  if (!m?.groups) {
    return fail("not Conventional Commits: expected `type(scope): subject`");
  }
  const { type, scope, subject: text } = m.groups;
  if (!TYPES.includes(type)) {
    return fail(`unknown type \`${type}\` — use one of ${TYPES.join(", ")}`);
  }
  if (scope && !scopes.has(scope)) {
    return fail(
      `unknown scope \`${scope}\` — use a package name or one of repo, ci, deps, docs, scripts, release`,
    );
  }
  if (subject.length > MAX_SUBJECT) {
    return fail(`subject is ${subject.length} chars, over the ${MAX_SUBJECT} limit`);
  }
  if (/^[A-Z]/.test(text)) return fail("subject starts with a capital");
  if (text.endsWith(".")) return fail("subject ends with a full stop");
  return undefined;
}

async function main() {
  const range = process.argv[2] ?? "-1";
  const proc = Bun.spawn(
    [
      "git",
      "log",
      "--no-merges",
      "--format=%H%x1f%s",
      ...(range === "-1" ? ["-1"] : [range]),
    ],
    { cwd: rootDir, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    console.error(`git log ${range} failed`);
    process.exit(1);
  }

  const scopes = allowedScopes();
  const problems: Problem[] = [];
  for (const line of stdout.split("\n").filter(Boolean)) {
    const [hash, subject] = line.split("\u001f");
    const problem = checkSubject(hash, subject, scopes);
    if (problem) problems.push(problem);
  }

  if (problems.length === 0) {
    console.log("every commit subject reads as Conventional Commits.");
    return;
  }
  for (const p of problems) {
    console.error(`${p.hash.slice(0, 7)}  ${p.subject}\n           ${p.message}`);
  }
  process.exit(1);
}

if (import.meta.main) await main();
