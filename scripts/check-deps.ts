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
  // @smartput/validate is type-and-adapter only and itself has zero runtime
  // dependencies, so the standing "core ships one runtime dependency" target
  // is unchanged in substance. The dependency runs core -> validate; validate
  // must never import core.
  "packages/core/package.json": ["decimal.js", "@smartput/validate"],
  "packages/datetime/package.json": [
    "@smartput/core",
    "chrono-node",
    "decimal.js",
    "temporal-polyfill",
  ],
  "packages/rates/package.json": ["decimal.js", "@smartput/core"],
  // The number package is here for its word vocabulary, not its kind: reading
  // "one hundred and five" and spelling 105 back are what `latexFromWords` and
  // `describe` share with it.
  "packages/math/package.json": [
    "@cortex-js/compute-engine",
    "@smartput/core",
    "@smartput/number",
  ],

  // The micro-validation path. Zero runtime dependencies, enforced here: a
  // first one would mean decimal.js or core leaked into a 600-byte budget.
  "packages/validate/package.json": [],

  // Extracted built-in kinds. Each is a leaf: it defines one kind against the
  // machinery in core and depends on nothing else, which is what keeps the
  // aggregator below the only package that has to know the full set.
  "packages/angle/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/area/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/datasize/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/duration/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/length/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/mass/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/measure/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/number/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/percent/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/speed/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/temperature/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/volume/package.json": ["@smartput/core", "@smartput/validate"],

  // The aggregator: re-exports every kind above and owns BUILTIN_KINDS, so it
  // is the one package legitimately allowed to depend on all of them.
  "packages/kinds/package.json": [
    "@smartput/core",
    "@smartput/angle",
    "@smartput/area",
    "@smartput/datasize",
    "@smartput/duration",
    "@smartput/length",
    "@smartput/mass",
    "@smartput/measure",
    "@smartput/number",
    "@smartput/percent",
    "@smartput/speed",
    "@smartput/temperature",
    "@smartput/volume",
  ],
};

const root = new URL("..", import.meta.url);

/**
 * The three subpaths a package defining a ratio kind owes its consumers, in the
 * condition order the repo pins. `bun` must come before `types`: with `types`
 * first, tsc pulls the sibling `.d.ts` in as a program input and declaration
 * emit dies with TS5055.
 *
 * This is enforced rather than documented because the subpaths are the entire
 * point of the micro path — a kind reachable only through `.` drags the engine
 * into a bundle that wanted 1.3 KB of parser. A new kind that ships without
 * `./validate` is not a smaller kind, it is an unusable one, and the failure is
 * invisible until someone measures a bundle.
 */
const REQUIRED_SUBPATHS = ["./units", "./validate", "./class"] as const;
const CONDITION_ORDER = ["bun", "types", "default"];

/**
 * Ratio kinds that owe fewer than three subpaths, each with the reason. Stated
 * per package so that an exemption is a decision someone wrote down, not a kind
 * that quietly fell out of the check.
 *
 * `null` means the package owes nothing: spec §3 excludes it from the micro
 * path by name.
 */
const SUBPATH_EXEMPT: Record<string, { subpaths: string[] | null; why: string }> = {
  // Re-exports all thirteen kinds, so the detection below sees a kind package.
  // It owes the `./validate` and `./class` barrels, which it has, but no
  // `./units`: it publishes no table of its own.
  "packages/kinds/package.json": {
    subpaths: ["./validate", "./class"],
    why: "aggregator: re-exports kinds rather than defining one",
  },
  // `money`'s non-canonical ratios are functions reading an injected live rate
  // table, which `decimalRatios` refuses by name and a `UnitTable` of decimal
  // strings cannot express. Spec §3 excludes it: a micro path with no engine
  // has nowhere to inject rates, and a hard-coded FX table would be worse than
  // no feature.
  "packages/rates/package.json": {
    subpaths: null,
    why: "spec §3: money's ratios are live rates, not constants",
  },
};

/** Does this package define a ratio kind? Asked of the module, not the source. */
async function exportsRatioKind(dir: string): Promise<boolean> {
  const entry = new URL(`${dir}/src/index.ts`, root);
  if (!(await Bun.file(entry).exists())) return false;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(entry.pathname)) as Record<string, unknown>;
  } catch {
    // A package that cannot be imported is a different failure, and typecheck
    // and the test suite both report it far more legibly than this script can.
    return false;
  }
  return Object.values(mod).some((v) => {
    if (typeof v !== "object" || v === null) return false;
    const kind = v as { id?: unknown; value?: { mode?: unknown } };
    return typeof kind.id === "string" && kind.value?.mode === "ratio";
  });
}

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

  const dir = path.replace(/\/package\.json$/, "");
  if (!(await exportsRatioKind(dir))) continue;

  const exportsMap: Record<string, Record<string, string>> = pkg.exports ?? {};
  const exempt = SUBPATH_EXEMPT[path];
  if (exempt?.subpaths === null) {
    console.log(`${pkg.name} subpaths exempt — ${exempt.why}`);
    continue;
  }
  const required: readonly string[] = exempt?.subpaths ?? REQUIRED_SUBPATHS;

  const missing = required.filter((s) => exportsMap[s] === undefined);
  if (missing.length > 0) {
    console.error(
      `${pkg.name} exports a ratio kind but declares no ${missing.join(", ")} subpath. Every kind package must ship ${required.join(", ")} so consumers can reach the micro path without the engine.`,
    );
    failed = true;
    continue;
  }

  let subpathsOk = true;
  for (const subpath of required) {
    const entry = exportsMap[subpath] as Record<string, string>;
    const conditions = Object.keys(entry);
    if (conditions.join(",") !== CONDITION_ORDER.join(",")) {
      console.error(
        `${pkg.name} "${subpath}" declares conditions [${conditions.join(", ")}]; expected [${CONDITION_ORDER.join(", ")}] in that order (bun before types, or tsc reads the sibling .d.ts as an input and fails TS5055).`,
      );
      failed = true;
      subpathsOk = false;
      continue;
    }
    const source = new URL(`${dir}/${(entry.bun as string).replace(/^\.\//, "")}`, root);
    if (!(await Bun.file(source).exists())) {
      console.error(
        `${pkg.name} "${subpath}" points its bun condition at ${entry.bun}, which does not exist.`,
      );
      failed = true;
      subpathsOk = false;
    }
  }
  if (subpathsOk) {
    console.log(`${pkg.name} subpaths OK: ${required.join(", ")}`);
  }
}

if (failed) process.exit(1);
