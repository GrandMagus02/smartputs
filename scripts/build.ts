import { Glob } from "bun";

/**
 * Builds every entry a package declares in its `exports` map, reading the
 * `bun` condition as the source and the `default` condition as the output.
 * Discovering entries from `exports` rather than a hardcoded list is what
 * stops a new subpath from being silently unbuilt — the same reason
 * check-deps.ts and typecheck.ts scan the filesystem.
 *
 * `packages: "external"` keeps workspace and npm dependencies as bare imports
 * so a consumer's bundler dedupes them. Bundling decimal.js into every package
 * would ship it several times over.
 *
 * Declarations come from `tsc`, which Bun cannot emit: every exports map
 * promises a `types` file next to the `default` one, and an exports map that
 * points at a `.d.ts` nobody generates is a lie a consumer only discovers on
 * install. The package tsconfigs are already `declaration` +
 * `emitDeclarationOnly` with `outDir: dist`, so this is the emit half of the
 * check `typecheck.ts` runs with `--noEmit`.
 *
 * The steps are exported rather than run on import so check-size.ts can build
 * one package on demand: measuring dist bytes must not depend on someone
 * having remembered to build first.
 */
const root = new URL("..", import.meta.url);
export const rootDir = Bun.fileURLToPath(root);

/** Every `packages/<name>/package.json`, relative to the repo root, sorted. */
export function packageManifests(): string[] {
  return [...new Glob("packages/*/package.json").scanSync(rootDir)]
    .map((p) => p.replaceAll("\\", "/"))
    .sort();
}

/** Absolute paths of a package's build entries, taken from its `bun` conditions. */
export async function entriesOf(dir: string): Promise<string[]> {
  const pkg = await Bun.file(`${rootDir}/${dir}/package.json`).json();
  return Object.values(pkg.exports ?? {})
    .map((t) => (t as Record<string, string>).bun)
    .filter((s): s is string => typeof s === "string")
    .map((s) => `${rootDir}/${dir}/${s.replace(/^\.\//, "")}`);
}

export interface BuildResult {
  ok: boolean;
  /** Everything the build wanted to say, printed by the caller in a stable order. */
  log: string;
}

export interface BuildOptions {
  /**
   * Emit `.d.ts` alongside the bundle. Off for callers that only need the
   * JavaScript — check-size.ts measures bytes, and tsc is the slow half of a
   * build it may have to run on demand.
   */
  declarations?: boolean;
}

/** Builds one package directory (e.g. `packages/core`): bundle, then declarations. */
export async function buildPackage(
  dir: string,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const declarations = options.declarations ?? true;
  const pkg = await Bun.file(`${rootDir}/${dir}/package.json`).json();
  const entries = await entriesOf(dir);

  if (entries.length === 0) {
    return { ok: false, log: `${pkg.name} declares no buildable entries` };
  }

  const bundled = await Bun.build({
    entrypoints: entries,
    outdir: `${rootDir}/${dir}/dist`,
    root: `${rootDir}/${dir}/src`,
    target: "browser",
    format: "esm",
    packages: "external",
    splitting: false,
  });

  if (!bundled.success) {
    const logs = bundled.logs.map(String).join("\n");
    return { ok: false, log: `${pkg.name} build FAILED\n${logs}` };
  }

  if (!declarations) {
    return { ok: true, log: `${pkg.name} built ${bundled.outputs.length} file(s)` };
  }

  const tsc = Bun.spawn(["tsc", "-p", `${rootDir}/${dir}/tsconfig.json`], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(tsc.stdout).text(),
    new Response(tsc.stderr).text(),
    tsc.exited,
  ]);

  if (exitCode !== 0) {
    return {
      ok: false,
      log: `${pkg.name} declaration emit FAILED\n${(stdout + stderr).trim()}`,
    };
  }

  return { ok: true, log: `${pkg.name} built ${bundled.outputs.length} file(s) + types` };
}

/** Builds every package. Returns false if any package failed. */
export async function buildAll(): Promise<boolean> {
  const manifests = packageManifests();

  if (manifests.length === 0) {
    console.error("build found no packages/*/package.json — refusing to pass.");
    return false;
  }

  // Spawned in parallel for the reason typecheck.ts gives: seventeen cold tsc
  // starts in series is most of a minute. Output is buffered and printed in
  // glob order so the log reads the same however the race lands.
  const results = await Promise.all(
    manifests.map((manifest) => buildPackage(manifest.replace(/\/package\.json$/, ""))),
  );

  let ok = true;
  for (const result of results) {
    if (result.ok) console.log(result.log);
    else {
      console.error(result.log);
      ok = false;
    }
  }
  return ok;
}

if (import.meta.main) {
  if (!(await buildAll())) process.exit(1);
}
