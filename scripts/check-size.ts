import { unlink } from "node:fs/promises";
import { type BunPlugin, Glob } from "bun";
import { buildPackage, packageManifests, rootDir } from "./build";

/**
 * Measures what a consumer actually pays for a named set of imports.
 *
 * The measurement bundles a synthetic entry that imports exactly `names` from
 * `from` and does something unremovable with them, then minifies. Importing
 * without using would let the minifier drop the whole graph and report a
 * budget of zero, which is why `globalThis.__keep` is assigned rather than the
 * values merely being referenced.
 *
 * A budget is the feature here. `check-deps.ts` is the precedent: the repo
 * enforces its tables rather than trusting them.
 */
export interface EntrySpec {
  label: string;
  from: string;
  names: string[];
  /** Budget in minified bytes. */
  min: number;
  /** Budget in gzipped bytes. */
  gzip: number;
  /**
   * Lower bound in minified bytes. Defaults to `FLOOR_RATIO * min`; set it
   * explicitly when a row's real measurement sits further below its ceiling
   * than the default band allows.
   */
  floor?: number;
}

/**
 * How far below its ceiling a row may measure before the number stops being
 * believable.
 *
 * A budget used to be one-sided, and the only guard against measuring nothing
 * was "the bundle is at least 32 bytes" — which `export const parseAngle = ()
 * => {};` clears at 36 B. That row printed OK while containing none of the
 * thing it claimed to measure, so a regression that shook a symbol's whole
 * graph away read as a pass.
 *
 * Every ceiling here is a measurement rounded up to the next 50 B, so a healthy
 * row sits just under its ceiling. Thirty percent of headroom is far more than
 * any of them uses and far less than "the graph vanished". A genuine
 * optimisation that big is supposed to fail here: re-measure, and amend §13
 * with the new pair, which is the same rule that governs raising one.
 */
const FLOOR_RATIO = 0.7;

export const floorOf = (spec: EntrySpec): number =>
  spec.floor ?? Math.floor(spec.min * FLOOR_RATIO);

export interface Sizes {
  min: number;
  gzip: number;
}

/**
 * Where synthetic entries are written. Inside the repo, because a bundle
 * resolving `decimal.js` out of a package's dist walks up from that file — an
 * entry in the system temp directory has no node_modules above it at all.
 */
const TMP_DIR = `${rootDir}/.size-tmp`;

const SELF = Bun.fileURLToPath(import.meta.url);

/**
 * Every workspace specifier mapped to the built file a consumer would load.
 *
 * Bun installs workspace packages into each dependent's own node_modules
 * rather than the root's, so nothing at the repo root can resolve
 * `@smartput/core` on its own; the map below is the resolver. Reading the
 * `default` condition is the other half of the point: a budget has to be
 * measured against dist, the thing that ships, not against src.
 *
 * It is computed once, up front, and never inside a plugin callback — running
 * a nested `Bun.build` from `onResolve` deadlocks.
 */
let resolutions: Promise<Map<string, string>> | undefined;

/**
 * When a package's shipping source was last touched. Test files are excluded:
 * they are never built, so editing one must not trigger a rebuild.
 *
 * `0` for a package with no source, which reads as "older than any dist" and so
 * never forces a build.
 */
async function newestSourceMtime(dir: string): Promise<number> {
  let newest = 0;
  for (const file of new Glob(`${dir}/src/**/*.ts`).scanSync(rootDir)) {
    if (file.endsWith(".test.ts")) continue;
    const at = Bun.file(`${rootDir}/${file}`).lastModified;
    if (at > newest) newest = at;
  }
  return newest;
}

async function computeResolutions(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const rebuild = new Set<string>();

  for (const manifest of packageManifests()) {
    const dir = manifest.replace(/\/package\.json$/, "");
    const pkg = await Bun.file(`${rootDir}/${manifest}`).json();
    // Asked once per package, not once per subpath.
    const sourceAt = await newestSourceMtime(dir);
    for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
      const file = (target as Record<string, string>).default;
      if (file === undefined) continue;
      const specifier =
        subpath === "." ? pkg.name : `${pkg.name}/${subpath.replace(/^\.\//, "")}`;
      const absolute = `${rootDir}/${dir}/${file.replace(/^\.\//, "")}`;
      map.set(specifier, absolute);
      const dist = Bun.file(absolute);
      // Missing *or* older than the source it was built from. Only the first
      // half used to be checked, so a budget could be measured against a dist
      // built before the change under review: `bun run check-size` printed
      // three green angle rows for source that was 2.4 KB over budget, and
      // only the accident of `bun run check` building first hid it. A budget
      // measured against a stale artefact is not a budget.
      if (!(await dist.exists()) || dist.lastModified < sourceAt) rebuild.add(dir);
    }
  }

  // Built here rather than reported as an error because dist is gitignored: a
  // fresh clone running `bun test` would otherwise fail on a missing file that
  // has nothing to do with the budget being measured. Declarations are skipped
  // — bytes are the question, and tsc is most of a build's wall clock.
  for (const dir of rebuild) {
    const result = await buildPackage(dir, { declarations: false });
    if (!result.ok) throw new Error(result.log);
  }

  return map;
}

function workspaceResolutions(): Promise<Map<string, string>> {
  resolutions ??= computeResolutions();
  return resolutions;
}

function workspacePlugin(map: Map<string, string>): BunPlugin {
  return {
    name: "smartput-workspace",
    setup(build) {
      build.onResolve({ filter: /^@smartput\// }, (args) => {
        const path = map.get(args.path);
        if (path === undefined) {
          throw new Error(
            `${args.path} is not an exported entry of any workspace package`,
          );
        }
        return { path };
      });
    },
  };
}

/** The measurement itself. Only ever called in a child process — see below. */
async function measureHere(spec: EntrySpec): Promise<Sizes> {
  const map = await workspaceResolutions();

  const source = `import { ${spec.names.join(", ")} } from ${JSON.stringify(spec.from)};
(globalThis as Record<string, unknown>).__keep = [${spec.names.join(", ")}];
`;
  const slug = spec.label.replace(/[^a-z0-9]+/gi, "-");
  const entry = `${TMP_DIR}/${slug}.ts`;
  await Bun.write(entry, source);

  try {
    const built = await Bun.build({
      entrypoints: [entry],
      target: "browser",
      format: "esm",
      minify: true,
      packages: "bundle",
      plugins: [workspacePlugin(map)],
      // Bun.build throws an AggregateError of its own by default, which loses
      // which row was being measured. Returning the result lets the message
      // below name the entry.
      throw: false,
    });

    if (!built.success) {
      throw new Error(
        `${spec.label}: build failed — ${built.logs.map(String).join("; ")}`,
      );
    }

    const output = built.outputs[0];
    if (output === undefined) throw new Error(`${spec.label}: build produced no output`);

    const text = await output.text();
    // A tree-shaken-to-nothing bundle means the symbol did not exist or the
    // keep-alive failed. This catches only the degenerate case; the floor in
    // the runner below is what catches a bundle that is merely far too small.
    if (text.length < 32) {
      throw new Error(`${spec.label}: bundle is ${text.length} bytes — nothing was kept`);
    }

    const bytes = new TextEncoder().encode(text);
    return { min: bytes.byteLength, gzip: Bun.gzipSync(bytes).byteLength };
  } finally {
    await unlink(entry).catch(() => {});
  }
}

/**
 * Measures one entry in a child process.
 *
 * Bun 1.3 leaks bundler resolutions into the runtime module resolver: after a
 * `Bun.build` in this process, `import "decimal.js"` fails from a directory
 * that resolves it perfectly well otherwise. In `bun test` that took out 61
 * unrelated tests in files this script never touches. Whatever process wants a
 * number, the bundler runs somewhere else.
 */
export async function measureEntry(spec: EntrySpec): Promise<Sizes> {
  const request = JSON.stringify({
    label: spec.label,
    from: spec.from,
    names: spec.names,
  });
  const proc = Bun.spawn(["bun", "run", SELF, "--measure", request], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`${spec.label}: measurement failed\n${(stdout + stderr).trim()}`);
  }

  const line = stdout.trim().split("\n").at(-1) ?? "";
  const sizes = JSON.parse(line) as Sizes;
  if (typeof sizes.min !== "number" || typeof sizes.gzip !== "number") {
    throw new Error(`${spec.label}: child returned ${line}`);
  }
  return sizes;
}

/** A parse-only row for one kind: the entry a consumer pays to validate input. */
const parseOnly = (pkg: string, fn: string, min: number, gzip: number): EntrySpec => ({
  label: `${pkg}/validate ${fn} only`,
  from: `@smartput/${pkg}/validate`,
  names: [fn],
  min,
  gzip,
});

export const BUDGETS: EntrySpec[] = [
  // Every number here was measured first and then committed, rounded up to the
  // next 50 B — see the plan's Global Constraints. Raising one means amending
  // spec §13 in the same commit, never quietly.
  //
  // The three angle rows are well over §13's *original* budgets, which is why
  // §13 carries a dated amendment: the table costs what the spec predicted
  // (392 B), the shared parser costs six times what §13 implicitly assumed.
  {
    label: "angle/validate parseAngle only",
    from: "@smartput/angle/validate",
    names: ["parseAngle"],
    min: 1300,
    gzip: 750,
  },
  {
    label: "angle/validate parse + add + to",
    from: "@smartput/angle/validate",
    names: ["parseAngle", "addAngle", "toAngle"],
    min: 2300,
    gzip: 1100,
  },
  // 4218 B until 2026-08-06, when the shared factory learned to carry a `Ctx`
  // (so a `Measure` can hold a dpi, spec §8) and to bake a kind's own parse
  // defaults in (so `Number.parse("30")` works, spec §7.1). Both live in the
  // one factory every class shares, so every class pays: +453 B minified,
  // +141 B gzipped. Measured, then committed, then §13 amended — see the
  // 2026-08-06 amendment there for the reason.
  {
    label: "angle/class",
    from: "@smartput/angle/class",
    names: ["Angle"],
    min: 4700,
    gzip: 1950,
  },

  // The parse-only entry for every remaining kind. Each is the shared 883 B
  // parser plus that kind's table and wrapper, so the spread across these rows
  // — 1000 B for percent's single unit to 1408 B for length's eight units and
  // thirty-two aliases — is the table cost, and nothing else.
  parseOnly("area", "parseArea", 1200, 700),
  parseOnly("datasize", "parseDatasize", 1450, 750),
  parseOnly("duration", "parseDuration", 1250, 700),
  parseOnly("length", "parseLength", 1450, 750),
  parseOnly("mass", "parseMass", 1250, 700),
  parseOnly("measure", "parseMeasure", 1400, 750),
  parseOnly("number", "parseNumber", 1050, 600),
  // Measured at exactly 1000 B, so this row has no headroom at all: the
  // smallest table in the repo is also the tightest budget. That is the rule
  // working, not a mistake — any growth in the shared parser shows up here
  // first, which is the earliest warning the repo has.
  parseOnly("percent", "parsePercent", 1000, 600),
  // 1096 B until the knot ratio was corrected: "0.514444" was the true value
  // truncated, and the 28-digit string that replaced it is 22 characters
  // longer. A wrong constant is not a smaller one.
  parseOnly("speed", "parseSpeed", 1150, 650),
  parseOnly("temperature", "parseTemperature", 1150, 700),
  parseOnly("volume", "parseVolume", 1250, 700),
  // tempdelta shares temperature's package and its ratios, so this row exists
  // to catch the offset table leaking into the delta entry: it should cost
  // less than the reading, and it does (1115 B against 1140 B).
  parseOnly("temperature", "parseTempDelta", 1150, 650),

  // The barrel's whole claim is that a bundler which follows re-exports shakes
  // it to one kind. Measured, importing one kind through `@smartput/kinds/
  // validate` costs exactly what the subpath costs — 1270 B, delta zero — while
  // all twelve through the same barrel cost 4898 B. If the barrel ever stops
  // shaking, this row jumps by ~3.6 KB and fails loudly, rather than the doc
  // comment quietly becoming false.
  {
    label: "kinds/validate barrel, one kind (shake check)",
    from: "@smartput/kinds/validate",
    names: ["parseAngle"],
    min: 1300,
    gzip: 750,
  },

  // The same claim for the class barrel, which had no row at all. Spec §8 says
  // the `/*#__PURE__*/` annotation "is what lets an unused kind's class drop
  // out of a barrel import", and that sentence was the entire enforcement:
  // stripping the annotation from the twelve built class modules takes one
  // `Angle` imported through this barrel from 4218 B to 7975 B, +89%, and
  // nothing measured it. The subpath row above is unaffected by the annotation
  // — one class per module — so this barrel is the only place it can be
  // caught, which makes it exactly the place a row was missing.
  {
    label: "kinds/class barrel, one kind (shake check)",
    from: "@smartput/kinds/class",
    names: ["Angle"],
    min: 4700,
    gzip: 1950,
  },

  // Currency recognition with no engine in the graph — the half of `money` that
  // a rate cannot change, and the only micro-path row whose package exports no
  // kind. Above the other parse rows because the currency table carries plural
  // display forms and a typical band that a ratio table does not.
  //
  // The row exists for a claim a comment cannot hold: `Decimal` must stay out
  // of this graph. Core configures its precision in a module-load side effect,
  // which a bundler may not drop, so one re-export of `formatAmount` from
  // `./validate` takes this from 2.6 KB to 35 KB — measured, before the two
  // table lookups it needed were moved out of that module. Nothing about the
  // source says so; this number does.
  {
    label: "currency/validate parseAmount only",
    from: "@smartput/currency/validate",
    names: ["parseAmount"],
    min: 2650,
    gzip: 1050,
  },

  // `@smartput/country` is not a ratio kind and owes none of the subpaths above
  // — a place has no ratios to convert. It gets a row for a different claim its
  // own source makes: `place.ts` says the T1 tables are `@smartput/city`'s "so
  // that this package's import graph never reaches them", and until this row
  // that sentence was the whole enforcement. The split made the edge a package
  // name instead of a path, and `place.test.ts` reads the source for a value
  // import of it — this row is the other half, measuring the bundle rather than
  // reading the imports, so a re-export chain nobody thought to grep still fails.
  //
  // Measured, the T1 tier is 1_011_415 B against this root's 128_435 B, so a
  // leak is not a drift — it is an eightfold jump, and the ceiling here catches
  // it on the first build. The floor is set explicitly because the T0 country
  // table is ~99% of this number and would not move under any change to the
  // package's code; the default 70% band would let two thirds of the gazetteer
  // vanish silently.
  {
    label: "country root, T0 only (T1 must not leak in)",
    from: "@smartput/country",
    names: ["place"],
    min: 132_000,
    gzip: 46_000,
    floor: 120_000,
  },
  // The two packages below the kind, each measured for the claim that it is
  // usable without the gazetteer the kind ships. Both were inside the 128 KB row
  // above until the split, where "does the postal validator cost you a country
  // table" had no way to be asked. The answer is 37 KB rather than the 8 KB the
  // code is worth: decimal.js is ~35 KB of both numbers and is the floor for
  // anything that builds a Value at all. What these rows watch is the delta —
  // a country table arriving in either one is +90 KB and unmissable.
  {
    label: "zip root (postal machinery, no gazetteer)",
    from: "@smartput/zip",
    names: ["PostalFormat", "PostalFormats", "createPostalLiteral"],
    min: 39_000,
    gzip: 16_000,
  },
  {
    label: "distance root (the op, no gazetteer)",
    from: "@smartput/distance",
    names: ["PlaceDistance"],
    min: 40_500,
    gzip: 16_500,
  },
  // The search half of geo, measured for the claim its manifest makes: one
  // runtime dependency and no data of its own. `@smartput/city` is a
  // devDependency because `bundled()` takes rows as an argument, and this row
  // is what says so in bytes — the T1 tier is ~1 MB, so a value import of it
  // sneaking into the graph is a twenty-fold jump, not a drift.
  //
  // 38.8 KB for ~5.5 KB of code, because reaching `SmartputError` through
  // `@smartput/core`'s root costs 33.3 KB on its own: core configures
  // decimal.js's precision in a module-load side effect, which a bundler may
  // not drop. Same reason the zip and distance rows above sit where they do.
  // That constant mass is also why the floor is set explicitly — the default
  // 70% band bottoms out at 27 KB, below the 33.3 KB core alone costs, so
  // every symbol this package exports could shake away and the row would still
  // read as a pass.
  {
    label: "geocode root (one dependency, no gazetteer)",
    from: "@smartput/geocode",
    names: ["Geocoder", "rankHits", "QueryCache"],
    min: 38_912,
    gzip: 15_616,
    floor: 37_000,
  },
];

if (import.meta.main) {
  const flag = process.argv.indexOf("--measure");
  if (flag !== -1) {
    const request = process.argv[flag + 1];
    if (request === undefined) throw new Error("--measure needs a JSON spec");
    console.log(JSON.stringify(await measureHere(JSON.parse(request) as EntrySpec)));
  } else {
    let failed = false;
    for (const spec of BUDGETS) {
      const { min, gzip } = await measureEntry(spec);
      const floor = floorOf(spec);
      const over = min > spec.min || gzip > spec.gzip;
      const under = min < floor;
      const line = `${spec.label}: ${min} B min (budget ${spec.min}, floor ${floor}), ${gzip} B gzip (budget ${spec.gzip})`;
      if (over) {
        console.error(`OVER ${line}`);
        failed = true;
      } else if (under) {
        // Not a pass. Either the measured graph stopped being included — the
        // shake-to-nothing case a one-sided budget reports as a triumph — or
        // something got genuinely much smaller and the row needs re-measuring
        // and §13 needs amending.
        console.error(`UNDER ${line} — re-measure and amend the budget`);
        failed = true;
      } else {
        console.log(`OK   ${line}`);
      }
    }
    if (BUDGETS.length === 0) console.log("check-size: no budgets registered yet");
    if (failed) process.exit(1);
  }
}
