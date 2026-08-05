import { Glob } from "bun";

/**
 * The one runtime dependency each package is allowed. Everything the repo
 * publishes has to appear here: the loop below discovers packages from the
 * filesystem and *fails* on one this map does not mention, rather than skipping
 * it. The previous version iterated this map instead, so a package added in a
 * later milestone was simply absent from the check and passed CI with any
 * dependency at all.
 */
const ALLOWED: Record<string, string[]> = {
  "packages/core/package.json": ["decimal.js"],
  "packages/rates/package.json": ["decimal.js", "@smartput/core"],
};

const root = new URL("..", import.meta.url);
const found = [...new Glob("packages/*/package.json").scanSync(root.pathname)]
  .map((p) => p.replaceAll("\\", "/"))
  .sort();

let failed = false;

if (found.length === 0) {
  console.error("check-deps found no packages/*/package.json — refusing to pass.");
  failed = true;
}

for (const path of found) {
  const allowed = ALLOWED[path];
  if (allowed === undefined) {
    console.error(
      `${path} has no entry in check-deps.ts's ALLOWED map. Add one stating the runtime dependencies this package may have.`,
    );
    failed = true;
    continue;
  }
  const pkg = await Bun.file(new URL(path, root)).json();
  const deps = Object.keys(pkg.dependencies ?? {});
  const extra = deps.filter((d) => !allowed.includes(d));
  if (extra.length > 0) {
    console.error(
      `${pkg.name} may depend only on ${allowed.join(", ")}. Found extra: ${extra.join(", ")}`,
    );
    failed = true;
  } else {
    console.log(`${pkg.name} dependencies OK: ${deps.join(", ") || "(none)"}`);
  }
}

if (failed) process.exit(1);
