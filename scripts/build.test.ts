import { expect, test } from "bun:test";
import { Glob } from "bun";

const root = new URL("..", import.meta.url);
const rootDir = Bun.fileURLToPath(root);

const packages = [...new Glob("packages/*/package.json").scanSync(rootDir)]
  .map((p) => p.replaceAll("\\", "/"))
  .sort();

test("packages are discovered from the filesystem", () => {
  expect(packages.length).toBeGreaterThan(0);
});

/**
 * `sideEffects` has to be *declared*. Left undefined, a bundler must assume any
 * module in the package might mutate a global, and cross-module tree-shaking is
 * off for the whole package.
 *
 * `false` is the answer for every package but one. `@smartput/core` is the
 * documented exception: `packages/core/src/decimal.ts` runs
 * `Decimal.set({ precision: 28, ... })` at module load, and that statement is
 * not reachable from the `Decimal` export it lives next to. Rollup maps
 * `sideEffects: false` onto `moduleSideEffects: false`, which drops top-level
 * statements no used export depends on — so a `false` here would let a Vite
 * build silently run decimal.js at its 20-digit default and produce wrong
 * numbers with no error (the same failure biome.json's noRestrictedImports
 * message describes). Core therefore lists the files that carry that call.
 */
test("every package declares sideEffects", async () => {
  for (const path of packages) {
    const pkg = await Bun.file(new URL(path, root)).json();
    const flag = pkg.sideEffects;
    expect(flag, `${pkg.name} must declare sideEffects`).toBeDefined();
    if (flag !== false) {
      expect(Array.isArray(flag), `${pkg.name} sideEffects must be false or a list`).toBe(
        true,
      );
      expect(
        flag.length,
        `${pkg.name} sideEffects list must not be empty`,
      ).toBeGreaterThan(0);
      for (const item of flag) {
        expect(typeof item, `${pkg.name} sideEffects entries must be paths`).toBe(
          "string",
        );
        expect(item, `${pkg.name} sideEffects entries must be relative`).toMatch(/^\.\//);
      }
    }
  }
});

test("every export subpath resolves to src under the bun condition", async () => {
  for (const path of packages) {
    const pkg = await Bun.file(new URL(path, root)).json();
    for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
      expect(typeof target, `${pkg.name} ${subpath} must be a condition map`).toBe(
        "object",
      );
      const map = target as Record<string, string>;
      expect(map.bun, `${pkg.name} ${subpath} needs a bun condition`).toMatch(
        /^\.\/src\/.+\.ts$/,
      );
      expect(map.default, `${pkg.name} ${subpath} needs a default condition`).toMatch(
        /^\.\/dist\/.+\.js$/,
      );
      expect(map.types, `${pkg.name} ${subpath} needs types`).toMatch(
        /^\.\/dist\/.+\.d\.ts$/,
      );
      // Conditions match in key order, and `bun` has to win in this repo:
      // tsconfig.base.json sets customConditions: ["bun"], so tsc reads a
      // workspace import as source. With `types` first it reads dist/*.d.ts
      // instead, and emitting declarations then fails with TS5055 — the file
      // tsc is about to write is an input to its own program. Consumers never
      // match `bun`, so they still get `types` before `default`.
      expect(
        Object.keys(map),
        `${pkg.name} ${subpath} conditions must be ordered bun, types, default`,
      ).toEqual(["bun", "types", "default"]);
    }
  }
});
