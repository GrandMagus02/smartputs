import { unlink } from "node:fs/promises";
import type { BunPlugin } from "bun";
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
}

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

async function computeResolutions(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unbuilt = new Set<string>();

  for (const manifest of packageManifests()) {
    const dir = manifest.replace(/\/package\.json$/, "");
    const pkg = await Bun.file(`${rootDir}/${manifest}`).json();
    for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
      const file = (target as Record<string, string>).default;
      if (file === undefined) continue;
      const specifier =
        subpath === "." ? pkg.name : `${pkg.name}/${subpath.replace(/^\.\//, "")}`;
      const absolute = `${rootDir}/${dir}/${file.replace(/^\.\//, "")}`;
      map.set(specifier, absolute);
      if (!(await Bun.file(absolute).exists())) unbuilt.add(dir);
    }
  }

  // Built here rather than reported as an error because dist is gitignored: a
  // fresh clone running `bun test` would otherwise fail on a missing file that
  // has nothing to do with the budget being measured. Declarations are skipped
  // — bytes are the question, and tsc is most of a build's wall clock.
  for (const dir of unbuilt) {
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
    // keep-alive failed. Either way the number would be a lie.
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
  {
    label: "angle/class",
    from: "@smartput/angle/class",
    names: ["Angle"],
    min: 4250,
    gzip: 1800,
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
  parseOnly("speed", "parseSpeed", 1100, 650),
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
      const ok = min <= spec.min && gzip <= spec.gzip;
      const line = `${spec.label}: ${min} B min (budget ${spec.min}), ${gzip} B gzip (budget ${spec.gzip})`;
      if (ok) {
        console.log(`OK   ${line}`);
      } else {
        console.error(`OVER ${line}`);
        failed = true;
      }
    }
    if (BUDGETS.length === 0) console.log("check-size: no budgets registered yet");
    if (failed) process.exit(1);
  }
}
