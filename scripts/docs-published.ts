import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { $ } from "bun";

/**
 * Points the docs build at the packages as published, not as checked out.
 *
 * The demos on the site are the packages' only end-to-end proof that the
 * tarball on npm works: a workspace symlink resolves `@smartput/core` to
 * `packages/core`, which is the source the tests already cover, and hides
 * every packaging mistake — a subpath missing from `exports`, a `dist` file
 * that was never emitted, a dependency listed as `devDependencies`. So the
 * production build resolves them from the registry instead.
 *
 * The swap is a resolution swap, not an alias: aliasing `@smartput/kinds` to
 * a second copy would leave that copy's own `import "@smartput/core"` pointing
 * back at the workspace, and two copies of the engine means two registries and
 * two sets of classes. Instead the published tree is installed on its own in
 * `docs/.published`, where its internal imports resolve among themselves, and
 * then dropped into `docs/node_modules` — the first directory Node and Vite
 * look in for anything imported from `docs/`.
 *
 * Local `bun run docs:dev` and `docs:build` never call this; only the
 * production build does.
 */

const rootDir = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const docsDir = `${rootDir}/docs`;
const stageDir = `${docsDir}/.published`;
const docsModules = `${docsDir}/node_modules`;

interface Manifest {
  dependencies?: Record<string, string>;
}

/** The `@smartput/*` (and `smartputs`) entries of the docs manifest. */
async function publishedDeps(): Promise<string[]> {
  const manifest = (await Bun.file(`${docsDir}/package.json`).json()) as Manifest;
  return Object.keys(manifest.dependencies ?? {}).filter(
    (name) => name === "smartputs" || name.startsWith("@smartput/"),
  );
}

/**
 * Installs the given packages at their latest published version into a tree of
 * their own. `latest` rather than the workspace version: the workspace is
 * ahead of the registry between a version bump and the publish that follows
 * it, and the site is meant to show what is installable today.
 */
async function stage(names: string[]): Promise<void> {
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });
  await writeFile(
    `${stageDir}/package.json`,
    `${JSON.stringify(
      {
        name: "smartputs-docs-published",
        private: true,
        // Not a workspace member — the root globs are `packages/*` and `docs`
        // — so `bun install` here resolves every name from the registry.
        dependencies: Object.fromEntries(names.map((name) => [name, "latest"])),
      },
      null,
      2,
    )}\n`,
  );
  await $`bun install --no-cache`.cwd(stageDir);
}

/**
 * Copies the staged tree over `docs/node_modules`, dereferencing as it goes:
 * bun's entries are symlinks into a store the docs tree cannot reach.
 *
 * Everything the staged tree hoisted is copied, not just the scope — the
 * published packages depend on `decimal.js`, and a copy of `@smartput/core`
 * whose own dependency resolves nowhere is worse than no copy at all. Names
 * the docs tree already has are left alone unless they are ours.
 */
async function graft(): Promise<string[]> {
  const grafted: string[] = [];

  const copy = async (name: string): Promise<void> => {
    const from = `${stageDir}/node_modules/${name}`;
    const to = `${docsModules}/${name}`;
    // `rm` on the path itself: for a workspace entry this is a symlink, and
    // removing it must not follow through to `packages/<name>`.
    await rm(to, { recursive: true, force: true });
    await cp(from, to, { recursive: true, dereference: true });
    grafted.push(name);
  };

  for (const entry of await readdir(`${stageDir}/node_modules`, {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith(".")) continue;

    if (entry.name.startsWith("@")) {
      for (const scoped of await readdir(`${stageDir}/node_modules/${entry.name}`)) {
        await copy(`${entry.name}/${scoped}`);
      }
      continue;
    }

    // A hoisted transitive dependency. The docs tree's own copy wins if it has
    // one; this only fills the gaps the published packages opened.
    const existing = Bun.file(`${docsModules}/${entry.name}/package.json`);
    if (await existing.exists()) continue;
    await copy(entry.name);
  }

  return grafted;
}

const names = await publishedDeps();
if (names.length === 0)
  throw new Error("docs/package.json lists no @smartput dependencies");

await stage(names);
const grafted = await graft();
console.log(`docs resolve ${grafted.length} packages from the registry:`);
for (const name of grafted.sort()) {
  const version = (await Bun.file(`${docsModules}/${name}/package.json`).json()).version;
  console.log(`  ${name}@${version}`);
}
