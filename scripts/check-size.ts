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

/**
 * A class row for one kind: the ergonomic surface, which is that kind's table
 * plus the one shared `createValueClass` factory. Spelled as a helper only once
 * there were more than a couple — `angle/class` below stays written out because
 * it carries the amendment history that explains the number.
 */
const classOnly = (pkg: string, cls: string, min: number, gzip: number): EntrySpec => ({
  label: `${pkg}/class`,
  from: `@smartput/${pkg}/class`,
  names: [cls],
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
    min: 1400,
    gzip: 800,
  },
  {
    label: "angle/validate parse + add + to",
    from: "@smartput/angle/validate",
    names: ["parseAngle", "addAngle", "toAngle"],
    min: 2400,
    gzip: 1150,
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
    min: 4800,
    gzip: 1950,
  },

  // The parse-only entry for every remaining kind. Each is the shared parser
  // plus that kind's table and wrapper, so the spread across these rows —
  // 1126 B for percent's single unit to 1534 B for length's eight units and
  // thirty-two aliases — is the table cost, and nothing else.
  //
  // The parser was 883 B until a unit with no count in front of it became one
  // of that unit. That branch is ~110 B and every row below carries it, which
  // is the whole argument for putting a *kind's* leniency in the kind: see
  // number's `native` note further down, which is the same shape of feature
  // paying for itself in one row instead of nineteen.
  parseOnly("area", "parseArea", 1350, 700),
  parseOnly("datasize", "parseDatasize", 1550, 800),
  parseOnly("duration", "parseDuration", 1400, 750),
  parseOnly("length", "parseLength", 1550, 800),
  parseOnly("mass", "parseMass", 1350, 750),
  parseOnly("measure", "parseMeasure", 1550, 800),
  // The one row in this block that is not table cost alone: `native` mode
  // lives in @smartput/number/validate rather than in the shared parser
  // precisely so that it shows up here and nowhere else. Putting the same
  // branch in `parse` would have moved all nineteen of these rows — which is
  // exactly what the implied count then did, and what it cost is written at
  // the head of this block.
  parseOnly("number", "parseNumber", 1350, 750),
  // The smallest table in the repo, so this row is the tightest budget and
  // the earliest warning the repo has: any growth in the shared parser shows
  // up here first. It did — 1000 B until the implied count, 1126 B after.
  parseOnly("percent", "parsePercent", 1150, 650),
  // 1096 B until the knot ratio was corrected: "0.514444" was the true value
  // truncated, and the 28-digit string that replaced it is 22 characters
  // longer. A wrong constant is not a smaller one.
  parseOnly("speed", "parseSpeed", 1250, 700),
  parseOnly("temperature", "parseTemperature", 1300, 700),
  parseOnly("volume", "parseVolume", 1350, 750),
  // tempdelta shares temperature's package and its ratios, so this row exists
  // to catch the offset table leaking into the delta entry: it should cost
  // less than the reading, and it does (1115 B against 1140 B).
  parseOnly("temperature", "parseTempDelta", 1250, 700),

  // The four kinds that bridge two others. These rows shipped with placeholder
  // budgets copied from the nearest kind by table size; every number below is
  // now the real measurement rounded up to the next 50 B, the same rule as
  // every other row here.
  //
  // The parse rows land exactly where their tables put them, and none of the
  // four carries an op: an op signature is data on the kind, and `validate`
  // reaches only `./units`. tempo's two units make the second-smallest table in
  // the repo after percent's one unit; energy's nine make the largest of the
  // four. Nothing in this spread is bridging cost.
  //
  // The class rows exist for a claim the parse rows cannot make: an op-carrying
  // kind's `index.ts` imports `deriveValue` and `Decimal` from core, and if a
  // class module ever reached its own package root instead of `./units`, that
  // graph would arrive with it — a ~35 KB jump, not a drift. All four measure
  // within 300 B of `angle/class` (4671 B), which is the shared
  // `createValueClass` factory being genuinely shared: the factory is most of
  // each number and the kind's own table is the rest.
  parseOnly("datarate", "parseDatarate", 1200, 650),
  parseOnly("energy", "parseEnergy", 1450, 750),
  parseOnly("power", "parsePower", 1300, 700),
  parseOnly("tempo", "parseTempo", 1150, 650),
  classOnly("datarate", "Datarate", 4650, 1850),
  classOnly("energy", "Energy", 4850, 1900),
  classOnly("power", "Power", 4700, 1900),
  // Measured at exactly 1750 B gzipped, so this row has no gzip headroom at
  // all — the same situation `percent/validate` is in on the minified side.
  classOnly("tempo", "Tempo", 4550, 1800),

  // The barrel's whole claim is that a bundler which follows re-exports shakes
  // it to one kind. Measured, importing one kind through `@smartput/kinds/
  // validate` costs exactly what the subpath costs — 1270 B, delta zero — while
  // all seventeen through the same barrel cost 5994 B. If the barrel ever stops
  // shaking, this row jumps by ~4.7 KB and fails loudly, rather than the doc
  // comment quietly becoming false. (4898 B for twelve kinds before datarate,
  // energy, power and tempo; the delta this row watches grows with the roster,
  // the row's own budget does not.)
  {
    label: "kinds/validate barrel, one kind (shake check)",
    from: "@smartput/kinds/validate",
    names: ["parseAngle"],
    min: 1400,
    gzip: 800,
  },

  // The same claim for the class barrel, which had no row at all. Spec §8 says
  // the `/*#__PURE__*/` annotation "is what lets an unused kind's class drop
  // out of a barrel import", and that sentence was the entire enforcement:
  // stripping the annotation from the built class modules took one `Angle`
  // imported through this barrel from 4218 B to 7975 B, +89% — measured when
  // there were twelve of them, and worse now that there are sixteen — and
  // nothing measured it. The subpath row above is unaffected by the annotation
  // — one class per module — so this barrel is the only place it can be
  // caught, which makes it exactly the place a row was missing.
  {
    label: "kinds/class barrel, one kind (shake check)",
    from: "@smartput/kinds/class",
    names: ["Angle"],
    min: 4800,
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

  // Holidays, and the guard row that is the entire argument for the subpath.
  //
  // The six numbers below shipped as placeholders from a `--target=bun` run and
  // are now the measurement this script actually makes: the `default` condition,
  // `target: "browser"`, `packages: "bundle"`. The placeholders were wrong in
  // one consistent direction — every minified ceiling was generous and every
  // gzip ceiling was too tight, because a CommonJS package with a `js-yaml`
  // behind it bundles differently for the browser than it does for bun, and
  // compresses better than a guess assumed.
  //
  // Rounding: the repo's rule is "up to the next 50 B", which means nothing on a
  // ceiling of 1.6 MB — 50 B there is noise in the minifier's variable names,
  // and a row that fails on noise gets raised without being read. So the two
  // megabyte rows round up to the next 1000 B, and the datetime root row keeps
  // the 50 B rule, because 50 B is a real amount of code at 144 KB and this is
  // the row where a real amount of code matters.
  //
  // The subtraction the three rows exist to allow, as measured: 1_578_431 -
  // 144_265 = 1_434_166 B, against a `holiday` root of 1_429_938 B. The opt-in
  // costs the rule table and 4 KB of bridge, which is the claim the docs make.
  //
  // Both measurements moved by 57 B when the chrono bridge started reporting
  // `hasDate` / `hasTime`, and the difference did not move at all — which is
  // the shape a change to shared bridge code is supposed to have, and the
  // reason the sentence above still says 1_434_166.
  //
  // Re-measured when the range milestone landed: 1_586_908 - 145_401 is not the
  // subtraction to make, because those are two different rows now. The pair
  // above reads 1_578_478 / 144_312 — another 47 B each, and the difference is
  // *still* exactly 1_434_166. Same evidence as the sentence before it: shared
  // bridge code grew, the holiday half did not. The root ceiling was 144_300
  // and the row went 12 B over, so it is raised to the next 50 B rather than
  // left failing; the gzip ceiling was already wide enough and is untouched.
  {
    // The guard. `@smartput/datetime`'s root must still cost what it cost before
    // any of this existed: `date-holidays` is reachable only from `./holiday`,
    // and the manifest cannot say so — `check-deps.ts` sees one dependency list
    // for the whole package. If a re-export chain nobody thought to grep ever
    // pulls the rule table into the root graph, this row does not drift, it
    // jumps by a megabyte, which is the same shape of claim the `country root`
    // row makes about T1.
    //
    // The floor is explicit for that row's reason too: the ceiling is almost
    // entirely chrono and Temporal, which no change to this package's own code
    // would move, so the default 70% band (100_975 B) would let a third of
    // chrono disappear silently. 138_000 B is about 4% of headroom, which is
    // the whole of this package's own code and nothing more.
    //
    // Verified rather than assumed: the bundle this row measures contains no
    // string from the rule table — no `Easter`, no `js-yaml` — while the row
    // below contains both.
    label: "datetime root (no holiday data)",
    from: "@smartput/datetime",
    names: ["datetime"],
    min: 144_400,
    gzip: 50_800,
    floor: 138_000,
  },
  {
    // What opting in actually costs, as a number rather than as a warning in a
    // doc: this row minus the one above is the price of the feature, and it is
    // the number someone should be made to look at before adding the import.
    label: "datetime/holiday (the opt-in cost)",
    from: "@smartput/datetime/holiday",
    names: ["datetimeWithHolidays"],
    min: 1_579_000,
    gzip: 288_000,
  },
  {
    // The package alone, so the megabyte has an owner. Without this row the one
    // above would be the only place the rule table is measured, and an upstream
    // `date-holidays` release adding a country would read as the bridge getting
    // fatter.
    label: "holiday root (the rule table, alone)",
    from: "@smartput/holiday",
    names: ["findHoliday"],
    min: 1_430_000,
    gzip: 236_000,
  },

  // The range milestone: one row per `exports` subpath across its six packages,
  // seven rows for seven subpaths. Every number below was measured with the
  // rows in place at a ceiling of zero, then rounded up to the next 50 B — the
  // one exception is the holiday row, which follows the megabyte rule stated
  // above and rounds to the next 1000 B, because 50 B on 1.6 MB is the
  // minifier's choice of variable names and a row that fails on noise gets
  // raised without being read.
  //
  // What these seven rows are *not* is six new packages' worth of code. Every
  // one of them is `@smartput/datetime`'s graph — chrono and Temporal, 144_312 B
  // of it — plus that package's own few kilobytes:
  //
  //   range-core     +412 B    the snap arithmetic, the window table
  //   date         +1_089 B    the kind, its matcher, its ops, its format
  //   time         +1_382 B    the same, plus the ns-of-day round trip
  //   time-range   +2_728 B    the dash race and the wrapping windows
  //   dt-range     +3_534 B    the window×day grid, `from`/`until`, endpoints
  //   date-range   +4_781 B    the phrase table, the widest of the six
  //
  // That is the milestone's real size claim and the reason all six rows sit
  // within 5 KB of each other: none of these packages ships a second date
  // library, and a row that jumped would mean one had.
  //
  // Every one carries the explicit floor the `datetime root` row carries, for
  // that row's reason and the same number. The ceiling here is ~97% chrono and
  // Temporal, which no change to a range package's own code could move, so the
  // default 70% band (101_780 B for `date`) would let a third of chrono vanish
  // and still print OK. 138_000 B is the floor that says "the bridge is still
  // in the bundle". It deliberately does not try to say "the kind is still in
  // the bundle" — a kind is 0.4–4.8 KB here, so a floor tight enough to catch
  // one disappearing would also fail on any honest refactor of it, and the
  // corpus test next door fails on that far more legibly than a byte count.
  {
    label: "date",
    from: "@smartput/date",
    names: ["date"],
    min: 145_500,
    gzip: 50_900,
    floor: 138_000,
  },
  {
    label: "time",
    from: "@smartput/time",
    names: ["time"],
    min: 145_750,
    gzip: 51_000,
    floor: 138_000,
  },
  {
    // Two names, not one: `WINDOWS` is a plain table and `startOfWeek` is the
    // arithmetic, and importing only the table would measure a graph with no
    // Temporal call in it at all. The pair is what any range kind actually
    // reaches for.
    label: "range-core",
    from: "@smartput/range-core",
    names: ["WINDOWS", "startOfWeek"],
    min: 144_800,
    gzip: 50_800,
    floor: 138_000,
  },
  {
    label: "date-range",
    from: "@smartput/date-range",
    names: ["dateRange"],
    min: 149_150,
    gzip: 51_950,
    floor: 138_000,
  },
  {
    label: "time-range",
    from: "@smartput/time-range",
    names: ["timeRange"],
    min: 147_100,
    gzip: 51_450,
    floor: 138_000,
  },
  {
    // The guard, and the only reason this package has two subpaths. It is the
    // `datetime root (no holiday data)` row one layer up, making the identical
    // claim about the identical dependency: `@smartput/holiday` is declared in
    // this package's manifest and `check-deps.ts` reads a manifest, so nothing
    // over there can tell that only `src/holiday.ts` imports it. This row can.
    // A re-export chain nobody thought to grep pulling the rule table into the
    // root graph does not drift this number, it adds 1_439_062 B to it — the
    // row below minus this one — and the ceiling catches it on the first build.
    //
    // Verified the same way the datetime row was, rather than assumed: the
    // bundle this row measures contains no `Easter` and no `Christmas`, and the
    // one below contains both. (Not `js-yaml` — that string survives in neither
    // bundle, because the rule table reaches the browser build as inlined JSON
    // and the loader shakes out. The datetime row's comment says otherwise and
    // is wrong about the marker, not about the claim.)
    label: "datetime-range root (no holiday data)",
    from: "@smartput/datetime-range",
    names: ["datetimeRange"],
    min: 147_900,
    gzip: 51_800,
    floor: 138_000,
  },
  {
    // What opting in costs here, stated as the subtraction rather than as a
    // warning: 1_586_908 - 147_846 = 1_439_062 B, against `@smartput/holiday`'s
    // own root of 1_429_938 B. The extra ~9 KB over the bare rule table is
    // `@smartput/datetime/holiday` — the phrase grammar, the selector, the name
    // scorer — which this subpath reaches through rather than reimplementing,
    // and which the datetime rows above already price at ~4 KB. Paying for it
    // twice in one bundle is not possible; paying for it at all is the choice
    // this row makes visible.
    //
    // Megabyte rounding, per the note above the datetime rows.
    label: "datetime-range holiday",
    from: "@smartput/datetime-range/holiday",
    names: ["datetimeRangeHoliday"],
    min: 1_587_000,
    gzip: 292_000,
  },
  {
    // The selection range, and the one range package that is not a hundred and
    // forty kilobytes: it names neither Temporal nor chrono, so what it costs is
    // core's own graph plus `numberFromWords`. Roughly what `zip root` and
    // `distance root` cost, which is the band a kind with no data table sits in.
    label: "range",
    from: "@smartput/range",
    names: ["RANGE_KINDS"],
    min: 41_600,
    gzip: 16_750,
  },
  {
    // The `./class` subpath, measured to record that it is an *ergonomics* door
    // rather than a size one — 200 B above the root, not below it. `Range.parse`
    // reaches the same phrase grammar the matcher does, and that grammar reads
    // spelled counts through `@smartput/number`, so the subpath cannot be
    // cheaper than the package. A future refactor that makes it genuinely
    // lighter will trip the floor here and be noticed rather than assumed.
    label: "range/class",
    from: "@smartput/range/class",
    names: ["Range"],
    min: 41_800,
    gzip: 16_750,
  },
  // Every row from here to the end of the range block was re-measured when
  // comparison shipped, and moved by 5-48 B. Nothing in those packages changed:
  // the six generated signatures, the two-character operator table in the lexer
  // and six entries in the Pratt binding map all live in core, and core is in
  // every one of these bundles. A milestone that adds to core adds to all of
  // them, and the whole reason these are one-sided budgets rather than
  // assertions is so that shift is a number someone reads rather than a test
  // someone silences.
  // What a comparison returns, and the smallest kind in the repo: an opaque
  // spec with one aliasless unit, a two-branch formatter and a six-line class.
  // The number is almost entirely core's graph, which is the point of measuring
  // it — a regression here would mean the kind had grown a table.
  {
    label: "boolean",
    from: "@smartput/boolean",
    names: ["boolean", "truthOf"],
    min: 33_850,
    gzip: 13_500,
  },
  {
    label: "boolean/class",
    from: "@smartput/boolean/class",
    names: ["Bool"],
    min: 34_200,
    gzip: 13_650,
  },
  // The query package's three entries. The number worth reading is the gap:
  // each dialect is ~36 KB and the root is ~59 KB, so a dialect is *not* the
  // root plus an emitter — it is core's graph plus an emitter, and the ~22 KB
  // between them is the clause grammar and the schema index that a compiler
  // never links. That is ruling R3 measured rather than asserted, and a dialect
  // that started importing the parser would land on the root's number here.
  //
  // Core is in every one of the three because `errors.ts` extends
  // `SmartputError`, which is deliberate: a caller distinguishes "no reading"
  // from "a bug in the emitter" by class, and a query error that were a plain
  // `Error` would be indistinguishable from a `TypeError`. The floor is what
  // makes that visible if someone later "optimises" it away.
  {
    label: "query root (grammar + schema, no dialect)",
    from: "@smartput/query",
    names: ["QueryEngine", "defineSchema"],
    min: 59_200,
    gzip: 21_950,
  },
  {
    label: "query/sql",
    from: "@smartput/query/sql",
    names: ["SqlCompiler"],
    min: 36_550,
    gzip: 14_700,
  },
  {
    label: "query/mongo",
    from: "@smartput/query/mongo",
    names: ["MongoCompiler"],
    min: 37_900,
    gzip: 15_150,
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
