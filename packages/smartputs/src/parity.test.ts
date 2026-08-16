import { expect, test } from "bun:test";

/**
 * The façade is generated, and a generated file is only as true as the last
 * time somebody ran the generator. These tests are what make it true on every
 * run instead.
 *
 * The failure they exist to catch is silent and one-directional: somebody adds
 * an export to `@smartput/core`, nothing here changes, and `smartputs` quietly
 * publishes a smaller surface than the package it claims to be. Nothing else in
 * the repo would notice — the build passes, every type resolves, and the only
 * symptom is a consumer who read core's docs and cannot import what they say.
 *
 * Comparing subpath by subpath rather than only at the root matters for the same
 * reason `build.ts` discovers entries from `exports`: a subpath is the unit a
 * consumer actually imports, and a root that matches while `./solve` does not is
 * the exact drift this is here to fail on.
 */

const coreManifest = await Bun.file(
  new URL("../../core/package.json", import.meta.url),
).json();

/** Every subpath core publishes, as `[specifier suffix, core source, facade source]`. */
const SUBPATHS = Object.keys(coreManifest.exports).map((subpath) => {
  const rel = subpath === "." ? "index" : subpath.replace(/^\.\//, "");
  return {
    subpath,
    core: new URL(
      `../../core/${coreManifest.exports[subpath].bun.replace(/^\.\//, "")}`,
      import.meta.url,
    ),
    facade: new URL(`./${rel}.ts`, import.meta.url),
  };
});

test("the façade covers every subpath core publishes", async () => {
  const manifest = await Bun.file(new URL("../package.json", import.meta.url)).json();
  expect(Object.keys(manifest.exports).sort()).toEqual(
    Object.keys(coreManifest.exports).sort(),
  );
});

for (const { subpath, core, facade } of SUBPATHS) {
  test(`smartputs${subpath.slice(1)} re-exports every runtime name core has`, async () => {
    const [fromCore, fromFacade] = await Promise.all([
      import(core.pathname),
      import(facade.pathname),
    ]);
    expect(Object.keys(fromFacade).sort()).toEqual(Object.keys(fromCore).sort());
  });

  test(`smartputs${subpath.slice(1)} re-exports the same values, not copies`, async () => {
    const [fromCore, fromFacade] = await Promise.all([
      import(core.pathname),
      import(facade.pathname),
    ]);
    // Identity, not deep equality. A façade that rebuilt a value — wrapped a
    // function, spread an object — would pass a shape check and still break
    // `instanceof`, `===` on a frozen descriptor, and the single-registry
    // assumption every kind package is written against.
    for (const name of Object.keys(fromCore)) {
      expect(fromFacade[name]).toBe(fromCore[name]);
    }
  });
}
