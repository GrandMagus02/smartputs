import { mkdir, rm } from "node:fs/promises";
import { Glob } from "bun";
import { packageManifests, rootDir } from "./build";

/**
 * Turns a workspace package into the directory npm is allowed to see.
 *
 * Nothing here mutates `packages/<name>/package.json`. A published manifest and
 * a workspace manifest want different things — `workspace:*` is meaningless off
 * disk, `devDependencies` is nobody's business, and the shared fields (licence,
 * repository, author) are the same 37 times over and so belong in one place
 * rather than copy-pasted into every manifest where they can drift. Staging is
 * what lets both be true at once: the repo keeps the short manifest it edits,
 * the registry gets the long one it needs.
 *
 * The `bun` export condition is why `src` ships. Every exports map in this repo
 * points bun at `./src/*.ts` and everyone else at `./dist/*.js`; publishing
 * `dist` alone would leave a bun consumer resolving a path that is not in the
 * tarball, which fails at import rather than at install. Tests and corpora are
 * held back — they are the bulk of `src` and no consumer imports them.
 */

/** Fields identical across every published package, kept in one place. */
const REPO_URL = "https://github.com/GrandMagus02/smartputs";
const SHARED = {
  license: "MIT",
  author: "GrandMagus",
  homepage: `${REPO_URL}#readme`,
  bugs: { url: `${REPO_URL}/issues` },
  engines: { node: ">=20" },
};

/**
 * Paths that exist for the test run and not for a consumer.
 *
 * `dist` needs the same filter as `src`: tsc emits a declaration next to every
 * file it compiles, tests included, so a tarball built from `dist` alone still
 * carries a `corpus.test.d.ts` for every package.
 */
const TEST_PATHS = [/\.test\.(ts|js|d\.ts)$/, /(^|\/)corpus\//, /(^|\/)__snapshots__\//];

const isTestPath = (path: string) => TEST_PATHS.some((re) => re.test(path));

/** What the tarball carries, in `files` order. */
const SHIPPED = ["dist", "src", "README.md", "CHANGELOG.md", "LICENSE"] as const;

export interface StagedPackage {
  /** Workspace directory, e.g. `packages/length`. */
  dir: string;
  name: string;
  version: string;
  /** Absolute path of the staged directory handed to `npm publish`. */
  stagedDir: string;
}

/** The parts of a workspace `package.json` that publishing reads. */
export interface Manifest {
  name: string;
  version: string;
  type?: string;
  sideEffects?: boolean | string[];
  exports?: Record<string, Record<string, string>>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  devDependencies?: Record<string, string>;
}

/** The manifest the registry receives: every field npm shows or resolves. */
export interface PublishedManifest {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  license: string;
  author: string;
  homepage: string;
  bugs: { url: string };
  engines: Record<string, string>;
  repository: { type: string; url: string; directory: string };
  type: string;
  sideEffects: boolean | string[];
  exports?: Record<string, Record<string, string>>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  files: string[];
  publishConfig: { access: "public" };
}

export interface WorkspaceEntry {
  /** Workspace directory, e.g. `packages/length`. */
  dir: string;
  pkg: Manifest;
}

/** Every workspace directory, e.g. `packages/length`, in glob order. */
export function packageDirs(): string[] {
  return packageManifests().map((m) => m.replace(/\/package\.json$/, ""));
}

/** Reads every package manifest once, keyed by package name. */
export async function readWorkspace(): Promise<Map<string, WorkspaceEntry>> {
  const entries = await Promise.all(
    packageDirs().map(async (dir) => {
      const pkg = await Bun.file(`${rootDir}/${dir}/package.json`).json();
      return [pkg.name as string, { dir, pkg }] as const;
    }),
  );
  return new Map(entries);
}

/**
 * The one-line summary npm shows under a package's name.
 *
 * It comes from `META` in gen-package-pages.ts, which is already the single
 * source for the docs page heading, the index row and the README — a fourth
 * copy in 37 manifests would be a fourth thing to forget. The README tagline is
 * the fallback for a package `META` has not reached yet.
 */
export async function descriptionOf(dir: string): Promise<string> {
  const kind = dir.replace(/^packages\//, "");
  const { META } = await import("./gen-package-pages");
  const summary = META[kind]?.summary;
  if (summary) return summary;

  const readme = Bun.file(`${rootDir}/${dir}/README.md`);
  if (!(await readme.exists())) return "";
  for (const line of (await readme.text()).split("\n").slice(0, 12)) {
    const quoted = line.match(/^>\s+(.+?)\s*$/);
    if (quoted) return quoted[1];
  }
  return "";
}

/** `workspace:*` → `^<the version that dependency is being published at>`. */
function resolveDeps(
  deps: Record<string, string> | undefined,
  versions: Map<string, string>,
  from: string,
): Record<string, string> | undefined {
  if (!deps) return undefined;
  const out: Record<string, string> = {};
  for (const [name, range] of Object.entries(deps)) {
    if (!range.startsWith("workspace:")) {
      out[name] = range;
      continue;
    }
    const version = versions.get(name);
    if (!version)
      throw new Error(`${from} depends on ${name}, which is not a workspace package`);
    if (version === "0.0.0") {
      throw new Error(
        `${from} depends on ${name}@0.0.0 — set a real version before publishing`,
      );
    }
    out[name] = `^${version}`;
  }
  return out;
}

/** The manifest as the registry should see it. */
export async function stageManifest(
  dir: string,
  pkg: Manifest,
  versions: Map<string, string>,
): Promise<PublishedManifest> {
  const version = versions.get(pkg.name) ?? pkg.version;
  const kind = pkg.name.replace(/^@smartput\//, "");
  return {
    name: pkg.name,
    version,
    description: await descriptionOf(dir),
    keywords: ["smartput", kind, "parser", "units", "typescript", "i18n"],
    ...SHARED,
    repository: { type: "git", url: `git+${REPO_URL}.git`, directory: dir },
    type: pkg.type ?? "module",
    sideEffects: pkg.sideEffects ?? false,
    exports: pkg.exports,
    dependencies: resolveDeps(pkg.dependencies, versions, pkg.name),
    peerDependencies: resolveDeps(pkg.peerDependencies, versions, pkg.name),
    peerDependenciesMeta: pkg.peerDependenciesMeta,
    files: [...SHIPPED],
    publishConfig: { access: "public" },
  };
}

/** Absolute path of the staging root. Git-ignored; rebuilt every run. */
export const stageRoot = `${rootDir.replace(/\/$/, "")}/.publish`;

/**
 * Copies one package into `.publish/<kind>` and writes its published manifest.
 *
 * `dist` has to exist: the staged manifest promises `./dist/index.js` and a
 * tarball that does not contain it is a package that installs and cannot be
 * imported. Building on demand here would hide a stale build behind a publish,
 * so this fails instead and leaves `bun run build` to the caller.
 */
export async function stagePackage(
  dir: string,
  pkg: Manifest,
  versions: Map<string, string>,
): Promise<StagedPackage> {
  const src = `${rootDir}/${dir}`;
  const kind = pkg.name.replace(/^@smartput\//, "");
  const stagedDir = `${stageRoot}/${kind}`;

  const dist = [...new Glob("dist/**/*").scanSync(src)];
  if (dist.length === 0)
    throw new Error(`${pkg.name} has no dist/ — run \`bun run build\` first`);

  await rm(stagedDir, { recursive: true, force: true });
  await mkdir(stagedDir, { recursive: true });

  const copies: Promise<unknown>[] = [];
  for (const rel of [...dist, ...new Glob("src/**/*.ts").scanSync(src)]) {
    const path = rel.replaceAll("\\", "/");
    if (isTestPath(path)) continue;
    copies.push(Bun.write(`${stagedDir}/${path}`, Bun.file(`${src}/${path}`)));
  }
  for (const name of ["README.md", "CHANGELOG.md"]) {
    const file = Bun.file(`${src}/${name}`);
    if (await file.exists()) copies.push(Bun.write(`${stagedDir}/${name}`, file));
  }
  copies.push(Bun.write(`${stagedDir}/LICENSE`, Bun.file(`${rootDir}/LICENSE`)));
  await Promise.all(copies);

  const manifest = await stageManifest(dir, pkg, versions);
  await Bun.write(`${stagedDir}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  return { dir, name: pkg.name, version: manifest.version as string, stagedDir };
}

/**
 * Stages every package (or the named subset) against one version map.
 *
 * `versions` is passed in rather than read off disk so a dry run can stage a
 * version the workspace has not been stamped with yet — the run that only shows
 * you what would happen must not edit 37 manifests to do it.
 */
export async function stageAll(
  names?: string[],
  versions?: Map<string, string>,
): Promise<StagedPackage[]> {
  const workspace = await readWorkspace();
  versions ??= new Map(
    [...workspace].map(([name, { pkg }]) => [name, pkg.version as string]),
  );
  const wanted = names ?? [...workspace.keys()];
  const staged: StagedPackage[] = [];
  for (const name of wanted) {
    const entry = workspace.get(name);
    if (!entry) throw new Error(`no workspace package named ${name}`);
    staged.push(await stagePackage(entry.dir, entry.pkg, versions));
  }
  return staged;
}

/**
 * Publish order: a package never goes out before something it depends on.
 *
 * npm rejects a manifest whose dependency range matches nothing published, so
 * the graph decides the order rather than the glob. Dev dependencies are
 * ignored — they are cycles by design here (core dev-depends on packages that
 * depend on core) and none of them reach the tarball.
 */
export function topoOrder(workspace: Map<string, { pkg: Manifest }>): string[] {
  const edges = new Map<string, string[]>();
  for (const [name, { pkg }] of workspace) {
    const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
    edges.set(
      name,
      Object.keys(deps).filter((d) => workspace.has(d)),
    );
  }

  const order: string[] = [];
  const state = new Map<string, "open" | "done">();
  const visit = (name: string, trail: string[]) => {
    const seen = state.get(name);
    if (seen === "done") return;
    if (seen === "open")
      throw new Error(`dependency cycle: ${[...trail, name].join(" → ")}`);
    state.set(name, "open");
    for (const dep of edges.get(name) ?? []) visit(dep, [...trail, name]);
    state.set(name, "done");
    order.push(name);
  };
  for (const name of [...workspace.keys()].sort()) visit(name, []);
  return order;
}
