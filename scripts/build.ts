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

/**
 * Which packages a package's declaration emit has to wait for.
 *
 * Almost nothing here needs ordering: `packages: "external"` leaves every
 * cross-package import bare, so a bundle never reads a sibling's `dist`, and
 * `tsc` normally resolves a sibling through its `exports` map, whose `bun`
 * condition points at source. The exception is a tsconfig `paths` entry aimed
 * at `../<sibling>/dist`, which `packages/geo` needs so that
 * `ambiguity.test.ts` can import `@smartput/color` without pulling
 * `@urcolor/*`'s source through this repo's stricter flags (the reason is
 * written out in that file).
 *
 * A mapping like that turns a sibling's *emitted* `.d.ts` into a build input,
 * and `buildAll` runs every package at once. The bundle half is fast and the
 * tsc half is slow, so the loser of that race sees `../color/dist/locale/uk.js`
 * with no `.d.ts` beside it yet and reports TS7016 on all nineteen locales — a
 * failure that never reproduces locally, where a previous build left the
 * declarations lying around, and failed every CI build and every release from
 * the moment `@smartput/color` landed.
 *
 * Read from the tsconfigs rather than hardcoded, so the next package that needs
 * the same pin is ordered without anyone remembering this.
 */
async function distPrerequisites(
  dirs: readonly string[],
): Promise<Map<string, string[]>> {
  const known = new Set(dirs);
  const edges = new Map<string, string[]>();

  for (const dir of dirs) {
    const file = Bun.file(`${rootDir}/${dir}/tsconfig.json`);
    if (!(await file.exists())) continue;
    // Comments are the norm in this repo's tsconfigs, and `JSON.parse` will not
    // have them. Stripping line comments is enough — no path here contains `//`.
    const text = (await file.text()).replace(/^\s*\/\/.*$/gm, "");
    let config: { compilerOptions?: { paths?: Record<string, string[]> } };
    try {
      config = JSON.parse(text);
    } catch {
      continue;
    }

    const targets = Object.values(config.compilerOptions?.paths ?? {}).flat();
    const needed = new Set<string>();
    for (const target of targets) {
      const match = /^\.\.\/([^/]+)\/dist\//.exec(target);
      const other = match?.[1] === undefined ? undefined : `packages/${match[1]}`;
      if (other !== undefined && other !== dir && known.has(other)) needed.add(other);
    }
    if (needed.size > 0) edges.set(dir, [...needed]);
  }

  return edges;
}

/** Builds every package. Returns false if any package failed. */
export async function buildAll(options: BuildOptions = {}): Promise<boolean> {
  const manifests = packageManifests();

  if (manifests.length === 0) {
    console.error("build found no packages/*/package.json — refusing to pass.");
    return false;
  }

  const dirs = manifests.map((manifest) => manifest.replace(/\/package\.json$/, ""));
  const prerequisites = await distPrerequisites(dirs);

  // Spawned in parallel for the reason typecheck.ts gives: seventeen cold tsc
  // starts in series is most of a minute. Output is buffered and printed in
  // glob order so the log reads the same however the race lands.
  //
  // The one exception is a package whose tsconfig reads a sibling's emitted
  // `dist` — see `distPrerequisites`. It waits, and only for what it named; a
  // memoized promise per directory keeps everything else running at once and
  // keeps a package from being built twice when two of them wait on it.
  const started = new Map<string, Promise<BuildResult>>();
  const build = (dir: string, waiting: readonly string[]): Promise<BuildResult> => {
    const already = started.get(dir);
    if (already !== undefined) return already;
    if (waiting.includes(dir)) {
      // Nothing produces one today, and a cycle here would hang the build
      // rather than fail it, which is the worst way for it to be found.
      throw new Error(`tsconfig paths cycle: ${[...waiting, dir].join(" → ")}`);
    }
    const started_ = (async () => {
      await Promise.all(
        (prerequisites.get(dir) ?? []).map((other) => build(other, [...waiting, dir])),
      );
      return buildPackage(dir, options);
    })();
    started.set(dir, started_);
    return started_;
  };

  const results = await Promise.all(dirs.map((dir) => build(dir, [])));

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
  // `--no-declarations` is for callers that only need something importable:
  // the docs dev server reads the bundles and never a `.d.ts`, and tsc is
  // three quarters of the wall clock here.
  const declarations = !process.argv.slice(2).includes("--no-declarations");
  if (!(await buildAll({ declarations }))) process.exit(1);
}
