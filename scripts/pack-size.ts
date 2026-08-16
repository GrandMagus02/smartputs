import { rm } from "node:fs/promises";
import { rootDir } from "./build";
import { readWorkspace, stageAll, stageRoot, topoOrder } from "./pack";

/**
 * Measures the tarball each package would upload, and fails on one that has
 * outgrown its ceiling.
 *
 * `check-size.ts` already measures what a bundler charges a consumer for a
 * given import; this measures the other number — what npm downloads and unpacks
 * on `npm add`. They come apart easily: a data table added to `src`, a build
 * that starts emitting test declarations, a stray fixture directory. None of
 * those move an import budget by a byte and all of them make the install
 * bigger.
 *
 * One ceiling with three exceptions rather than a row per package. The point is
 * to catch the order-of-magnitude accident — a gazetteer landing in a tarball —
 * not to police a locale file, and 37 rows nobody can hold in their head get
 * raised without being read.
 */

/** Ceiling in kilobytes for a packed tarball, unless named below. */
const DEFAULT_LIMIT_KB = 96;

/**
 * The three packages that legitimately sit above the line, measured at 0.1.0
 * and rounded up to leave about a quarter of headroom. Raising one is a
 * decision, so it happens here, in a diff someone reviews.
 */
const LIMITS_KB: Record<string, number> = {
  // The engine, the tokeniser, the printer and sixteen locale vocabularies —
  // measured 397 KB.
  "@smartput/core": 512,
  // The T0 gazetteer, measured 122 KB.
  "@smartput/geo": 192,
  // chrono's bridge and the Temporal ops, measured 73 KB.
  "@smartput/datetime": 128,
};

export const limitOf = (name: string) => LIMITS_KB[name] ?? DEFAULT_LIMIT_KB;

export interface PackRow {
  name: string;
  bytes: number;
  unpacked: number;
  limitKb: number;
  ok: boolean;
}

/** What `npm pack` reports for an already-staged directory. */
async function measure(stagedDir: string): Promise<{ bytes: number; unpacked: number }> {
  const proc = Bun.spawn(["npm", "pack", "--dry-run", "--json"], {
    cwd: stagedDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) throw new Error(`npm pack failed in ${stagedDir}`);
  const [entry] = JSON.parse(stdout);
  return { bytes: entry.size, unpacked: entry.unpackedSize };
}

export async function packRows(): Promise<PackRow[]> {
  const workspace = await readWorkspace();
  // Versions do not affect size, and pinning one here means the check runs the
  // same before and after a release stamps the manifests.
  const versions = new Map([...workspace].map(([name]) => [name, "0.0.1"]));
  const staged = await stageAll(topoOrder(workspace), versions);

  const rows: PackRow[] = [];
  for (const pkg of staged) {
    const { bytes, unpacked } = await measure(pkg.stagedDir);
    const limitKb = limitOf(pkg.name);
    rows.push({ name: pkg.name, bytes, unpacked, limitKb, ok: bytes <= limitKb * 1024 });
  }
  return rows.sort((a, b) => b.bytes - a.bytes);
}

async function main() {
  const build = Bun.spawn(["bun", "run", "build"], {
    cwd: rootDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if ((await build.exited) !== 0) {
    console.error("build failed — nothing to measure.");
    process.exit(1);
  }

  const rows = await packRows();
  const kb = (bytes: number) => (bytes / 1024).toFixed(1);
  for (const row of rows) {
    const mark = row.ok ? "ok  " : "OVER";
    console.log(
      `${mark} ${kb(row.bytes).padStart(7)} KB / ${String(row.limitKb).padStart(4)} KB` +
        `  ${String(Math.round(row.unpacked / 1024)).padStart(5)} KB unpacked  ${row.name}`,
    );
  }

  await rm(stageRoot, { recursive: true, force: true });

  const over = rows.filter((r) => !r.ok);
  if (over.length > 0) {
    console.error(
      `\n${over.length} package(s) over budget: ${over.map((r) => r.name).join(", ")}\n` +
        "Shrink the tarball, or raise the ceiling in scripts/pack-size.ts and say why.",
    );
    process.exit(1);
  }
  console.log(`\n${rows.length} package(s) within budget.`);
}

if (import.meta.main) await main();
