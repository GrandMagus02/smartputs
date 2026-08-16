import { describe, expect, test } from "bun:test";
import {
  descriptionOf,
  type Manifest,
  readWorkspace,
  stageManifest,
  topoOrder,
  type WorkspaceEntry,
} from "./pack";

const workspaceOf = (
  entries: Record<string, Partial<Manifest>>,
): Map<string, WorkspaceEntry> =>
  new Map(
    Object.entries(entries).map(([name, pkg]) => [
      name,
      { dir: `packages/${name}`, pkg: { name, version: "0.0.0", ...pkg } },
    ]),
  );

describe("topoOrder", () => {
  test("a dependency comes out before the package that needs it", () => {
    const order = topoOrder(
      workspaceOf({
        length: { dependencies: { kind: "workspace:*" } },
        kind: {},
        measure: { dependencies: { length: "workspace:*" } },
      }),
    );
    expect(order.indexOf("kind")).toBeLessThan(order.indexOf("length"));
    expect(order.indexOf("length")).toBeLessThan(order.indexOf("measure"));
  });

  test("peer dependencies order the graph too", () => {
    const order = topoOrder(
      workspaceOf({ number: { peerDependencies: { core: "workspace:*" } }, core: {} }),
    );
    expect(order).toEqual(["core", "number"]);
  });

  // devDependencies are cycles by design here — core dev-depends on packages
  // that depend on core — and none of them reach a tarball.
  test("dev dependencies are ignored", () => {
    const workspace = workspaceOf({
      core: { devDependencies: { kinds: "workspace:*" } },
      kinds: { dependencies: { core: "workspace:*" } },
    });
    expect(topoOrder(workspace)).toEqual(["core", "kinds"]);
  });

  test("a real cycle is an error, not a silent order", () => {
    const workspace = workspaceOf({
      a: { dependencies: { b: "workspace:*" } },
      b: { dependencies: { a: "workspace:*" } },
    });
    expect(() => topoOrder(workspace)).toThrow(/cycle/);
  });
});

describe("stageManifest", () => {
  const pkg = {
    name: "@smartput/length",
    version: "0.0.0",
    type: "module",
    exports: { ".": { bun: "./src/index.ts", default: "./dist/index.js" } },
    dependencies: { "@smartput/kind": "workspace:*", "decimal.js": "^10.6.0" },
    devDependencies: { "@smartput/core": "workspace:*" },
  };
  const versions = new Map([
    ["@smartput/length", "0.4.0"],
    ["@smartput/kind", "0.2.1"],
  ]);

  test("workspace ranges become the version being published", async () => {
    const staged = await stageManifest("packages/length", pkg, versions);
    expect(staged.version).toBe("0.4.0");
    expect(staged.dependencies["@smartput/kind"]).toBe("^0.2.1");
    expect(staged.dependencies["decimal.js"]).toBe("^10.6.0");
  });

  test("devDependencies do not reach the registry", async () => {
    const staged = await stageManifest("packages/length", pkg, versions);
    expect((staged as Record<string, unknown>).devDependencies).toBeUndefined();
  });

  test("the shared fields are filled in", async () => {
    const staged = await stageManifest("packages/length", pkg, versions);
    expect(staged.license).toBe("MIT");
    expect(staged.publishConfig).toEqual({ access: "public" });
    expect(staged.repository.directory).toBe("packages/length");
    // src ships because every exports map points bun at it.
    expect(staged.files).toContain("src");
    expect(staged.files).toContain("dist");
  });

  test("a dependency still at 0.0.0 is refused rather than published", async () => {
    const stale = new Map([...versions, ["@smartput/kind", "0.0.0"]]);
    expect(stageManifest("packages/length", pkg, stale)).rejects.toThrow(/0\.0\.0/);
  });
});

describe("descriptionOf", () => {
  test("takes the tagline under the README heading", async () => {
    expect(await descriptionOf("packages/length")).toBe(
      "Millimetre to mile, exact in decimal.",
    );
  });
});

describe("the workspace itself", () => {
  test("every package can be ordered, so every package can be published", async () => {
    const workspace = await readWorkspace();
    expect(topoOrder(workspace).length).toBe(workspace.size);
  });

  // A published manifest with no description is a blank registry page.
  test("every package has a README tagline to describe it", async () => {
    const workspace = await readWorkspace();
    const missing: string[] = [];
    for (const [name, { dir }] of workspace) {
      if (!(await descriptionOf(dir))) missing.push(name);
    }
    expect(missing).toEqual([]);
  });
});
