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
  /**
   * The exported names to import and keep alive.
   *
   * `"default"` is spelled here as itself and means the module's default
   * export: every locale module in the repo is a bare
   * `export default defineVocabulary(...)`, so a harness that could only write
   * a named import had no way to measure one at all. The synthetic entry
   * rewrites it to `import { default as __default0 }`, because `default` is a
   * reserved word and cannot be a binding — see `measureHere`.
   */
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
  /**
   * This entry exports no runtime name at all, and the budget is that it never
   * starts to. `names` is empty, the synthetic entry is a bare side-effect
   * import, and the "nothing was kept" guard below is skipped — for a row like
   * `@smartput/kind/contracts`, keeping nothing IS the measurement.
   */
  typesOnly?: boolean;
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
      // Every workspace name is scoped except one. `smartputs` is the unscoped
      // install name — the thing somebody types who has heard of the project and
      // not of its package layout — so a filter of `^@smartput/` skipped it, the
      // bundler fell through to node resolution, and its budget row failed with
      // "Could not resolve" rather than a number. Anchored with `(?:/|$)` so it
      // matches the package and its subpaths without also swallowing some future
      // `smartputs-something`.
      build.onResolve({ filter: /^(?:@smartput\/|smartputs(?:\/|$))/ }, (args) => {
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

  // A name is normally its own local binding, which is why this used to be two
  // `join(", ")` calls. `"default"` is the exception and the reason the two
  // halves are now computed separately: it is the one export name that is also
  // a reserved word, so `import { default }` is a syntax error and the keep-
  // alive below cannot mention it either. Aliasing it per index — rather than to
  // a single fixed identifier — keeps a spec that asks for the default export
  // *and* a named one from colliding.
  const locals = spec.names.map((name, index) =>
    name === "default" ? `__default${index}` : name,
  );
  const clause = spec.names
    .map((name, index) => (name === locals[index] ? name : `${name} as ${locals[index]}`))
    .join(", ");

  // A types-only entry is imported for its side effects and nothing else,
  // because it has none of either: no name to bind, and so no keep-alive to
  // write. What the bundler emits for it is the whole claim of the row.
  const source = spec.typesOnly
    ? `import ${JSON.stringify(spec.from)};\n`
    : `import { ${clause} } from ${JSON.stringify(spec.from)};
(globalThis as Record<string, unknown>).__keep = [${locals.join(", ")}];
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
    if (!spec.typesOnly && text.length < 32) {
      throw new Error(`${spec.label}: bundle is ${text.length} bytes — nothing was kept`);
    }

    const bytes = new TextEncoder().encode(text);
    // An empty payload gzips to a ~20 B header and no content. Reporting the
    // header would make a 0 B row impossible to write, and it would be
    // measuring the container rather than the thing: nothing compresses to
    // nothing.
    const gzip = bytes.byteLength === 0 ? 0 : Bun.gzipSync(bytes).byteLength;
    return { min: bytes.byteLength, gzip };
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
    typesOnly: spec.typesOnly,
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
  //
  // 2026-08-16, the SmartputError retarget. Four rows here were over their
  // budgets for weeks and every one of them was over for the same reason, which
  // only became visible once something measured the modules instead of the
  // totals: they linked decimal.js — 61 KB unminified, ~33 KB minified — and
  // none of them called it. The path was `SmartputError`. Every package defines
  // its errors as subclasses of core's, reached it through core's ROOT barrel,
  // and a barrel is one module: naming one export links what the module had to
  // load to offer it.
  //
  // Two import lines in `query` and two in `geo`, pointed at
  // `@smartput/kind/errors` (134 B, no runtime dependency) instead:
  //
  //   query/sql       36_924 B -> 3_281 B   11.3x
  //   query/mongo     38_254 B -> 4_597 B    8.3x
  //   geo providers   43_368 B -> 9_656 B    4.5x
  //
  // Not one line of query or geo changed, only which door the error class came
  // through. The floor guard is what turned these from a silent win into an
  // amendment: all three failed UNDER on the next run and said so.
  //
  // Three rows are raised rather than fixed, and the reason is worth writing
  // down so nobody re-derives it:
  //
  //   geo root      49_461 B  Its `definePlace` lives in the root barrel and
  //                           genuinely needs `Decimal`, so a bundle asking for
  //                           `Geo` and `rank` cannot shake it — the barrel is
  //                           one module. Moving `definePlace` to a subpath is
  //                           the fix, and it is an API change, not a budget one.
  //   range         43_617 B  `slice.ts` does arithmetic on a `Value`, so its
  //   range/class   43_642 B  `Decimal` is real. It also drags core's English
  //                           locale (6_543 B) and `@smartput/number`, which are
  //                           worth a second look but are not a leak.
  // Every number here was measured first and then committed, rounded up to the
  // next 50 B — see the plan's Global Constraints. Raising one means amending
  // spec §13 in the same commit, never quietly.
  //
  // The three angle rows are well over §13's *original* budgets, which is why
  // §13 carries a dated amendment: the table costs what the spec predicted
  // (392 B), the shared parser costs six times what §13 implicitly assumed.
  //
  // 2026-08-16, the kind extraction: eleven rows below went up by 150–250 B and
  // every one of them is a package that imports `@smartput/core`. That is the
  // price of the boundary itself, not of any code that was added — `defineKind`,
  // the `SmartputError` hierarchy, `Decimal` and the types moved to
  // `@smartput/kind`, so what used to be modules inside core's bundle are now
  // modules across a package edge, and a bundler cannot flatten those away.
  // Measured, then committed, then §13 amended, in that order.
  //
  // It is worth recording that the trade did *not* pay for itself in bytes: the
  // kind packages it was meant to lighten barely moved (`boolean` root went
  // 33_818 -> 33_719, because what it was carrying was decimal.js and never the
  // pipeline), so this is 240 B spent on layering — no cycle between core and
  // the kinds, and fifteen packages that stopped naming the engine at all — and
  // not on size. Anyone reading these numbers later should not go looking for
  // the size win. There isn't one.
  //
  // Four rows — `geo root`, `range`, `range/class`, `query/sql` — were already
  // over their budgets before that change and are deliberately left alone here.
  // Raising them would have hidden someone else's regression inside this one.
  //
  // 2026-08-16, the Decimal brand: `deepFreeze` stopped importing decimal.js.
  // The guard that skips Decimal instances was `value instanceof Decimal`, which
  // made `@smartput/kind/freeze` import the class, and `defineVocabulary` calls
  // `deepFreeze` — so a table of nouns linked a 33 KB arithmetic engine. It now
  // reads a `Symbol.for("smartput.decimal")` brand that `decimal.ts` stamps onto
  // `Decimal.prototype`, and `freeze.ts` imports nothing but that symbol.
  //
  // The row it was aimed at:
  //
  //   kind/vocabulary defineVocabulary only   33_407 -> 272 B min, 13_276 -> 206 B gzip
  //
  // That is 123x, and the ceiling below is dropped to 300 B so the harness holds
  // it there. Every other row in the table was re-measured, because a fix that
  // only gets checked where it was expected to help is not checked:
  //
  //   * No movement at all in the twenty-two parse and class rows, the two
  //     barrel shake-checks, `currency/validate`, or `holiday root`. `deepFreeze`
  //     is authoring-time; a parser and a value class never call it.
  //   * +53 B min in every row that carries `@smartput/kind` itself — `kind root`
  //     33_407 -> 33_460, `boolean` 33_719 -> 33_772, `boolean/class` 34_042 ->
  //     34_095. That is the brand's whole runtime cost, once: the `Symbol.for`
  //     binding and the prototype assignment beside `Decimal.set`.
  //   * +130 to +217 B min in the rows that reach kind through several of its
  //     subpaths — the datetime and range family, `query root`, `query/mongo`,
  //     `geo providers`, `distance root`. `scripts/build.ts` runs with
  //     `packages: "external"` and no splitting, so a relative import is inlined
  //     into every dist entry that reaches it: a consumer pulling in three of
  //     kind's entries gets three copies of that 53 B. This is not new — the
  //     `Decimal.set` call next to the stamp has always been duplicated the same
  //     way — and it is what `brand.ts` uses `Symbol.for` rather than `Symbol()`
  //     for. Inlined copies of `Symbol()` would be different symbols and the
  //     brand would never match.
  //
  // Those ceilings are raised below rather than left failing, and the trade is
  // stated plainly: ~130 B added to about a dozen rows that were already paying
  // for decimal.js anyway, to take 33 KB off every vocabulary in the repo. The
  // four rows that were already over stay over — `geo root`, `range`,
  // `range/class`, `query/sql` moved by this change too, and raising them here
  // would fold someone else's regression into this one, which is the same
  // reasoning the extraction note above used.
  //
  // What did *not* move is the finding worth keeping: `length/locale/en` went
  // 34_667 -> 34_720, i.e. up by the same 53 B and not down by 33 KB. A locale
  // module reaches decimal.js by a second, entirely independent door —
  // `aliasesFor` shares a module with `decimalRatios` — and closing the first one
  // proves that door is load-bearing on its own rather than merely suspected.
  // Splitting `aliasesFor` out is the change that collects the win there.
  //
  // 2026-08-16, the aliasesFor split: that second door is now shut too, and the
  // win it was predicted to collect landed in full.
  //
  //   length/locale/en   34_720 -> 1_519 B min, 13_781 -> 655 B gzip
  //
  // `aliasesFor` and `RatioTable` moved out of `from-table.ts` into a new
  // `packages/kind/src/aliases.ts` that imports nothing, `from-table.ts` kept
  // `decimalRatios` and re-exports the type, and 273 locale files were
  // rewritten by script to take `@smartput/kind/aliases` and
  // `@smartput/kind/vocabulary` instead of the root barrel. No public name moved
  // — the barrel and core's shim still export both — so this is a byte change
  // with no API surface to it at all.
  //
  // Every other row was re-measured, and this time the answer is short: not one
  // of them moved a byte. Every number the brand commit above wrote down comes
  // back identical — `kind root` 33_460, `boolean` 33_772, `boolean/class`
  // 34_095, and the four over-budget rows at 49_461 / 43_617 / 43_642 / 36_924 —
  // so this commit neither pays that 53 B back nor adds to it, and no row
  // dropped far enough to trip the 70% floor. That is what the shape of the fix
  // predicts: the two functions never called each other, and outside the locale
  // files nobody had ever taken `aliasesFor` and `decimalRatios` by a path where
  // separating them changes the graph. The four rows that were already over
  // (`geo root`, `range`, `range/class`, `query/sql`) are, once again,
  // deliberately untouched.
  //
  // The trap that let a 33 KB vocabulary happen is now written down where it can
  // be tripped over — the header of `packages/kind/src/index.ts`. The root barrel
  // is the arithmetic tier and costs ~33 KB because `defineKind` needs `Decimal`,
  // so a consumer that wants only tables and words must come in by the
  // `./aliases`, `./vocabulary` and `./errors` subpaths. The tight ceiling on the
  // `length/locale/en` row below is what enforces that, and it is the only thing
  // that does.
  //
  // 2026-08-19, the second pass (defects A-G): sixteen ceilings move, and the
  // split between them is the finding, not the totals. One row reaches
  // `createEngine` and grew by 10_731 B min; the other fifteen reach only
  // `@smartput/kind`, and every one of them grew by between 1 and 133 B.
  //
  // The fifteen small ones are `kind/errors.ts` and nothing else. A
  // `KindMismatchError` now names the operator it was raised for and every kind
  // pair it tried, and every error class carries a span — +319 B min in that
  // module measured alone (3_349 -> 3_668, minified with imports external). A
  // row links whichever fraction of that its own graph reaches, and the
  // measured spread is exactly that fraction:
  //
  //   rate/locale/en           36_073   datetime/locale/en       35_986
  //   geo root                 49_617   query root               59_695
  //   range                    43_773   range/class              43_798
  //   datetime root           144_833   datetime/holiday      1_579_001
  //   date                    145_916   time                    146_202
  //   range-core              145_245   date-range              149_587
  //   time-range              147_522   datetime-range root     148_346
  //   datetime-range holiday 1_587_354
  //
  // Not one of the pass's seven features is reachable from any of them. The
  // number grammars, the compound fold, the derived-unit table, the display
  // policy, the non-throwing `explain` and the plugin context all sit behind
  // `createEngine`, which is why fifteen rows move by ~100 B and one moves by
  // ten kilobytes. That asymmetry is what these ceilings are for: it is the
  // measured evidence that a pass aimed at the engine stayed on the engine's
  // side of the wall instead of leaking into every vocabulary in the repo. The
  // trade is stated plainly rather than hidden in a total — ~100 B on fifteen
  // rows that were already paying for `@smartput/kind`, for an error that can
  // say which operator failed and where.
  //
  // 2026-08-19, the date grammars: nine ceilings move and no other row does,
  // which is the finding again. `@smartput/datetime` grew by 3_731 B min — the
  // ordinal words, the month scope, the nth-weekday arithmetic and the
  // calendar-interval table — and every row that moved is a row whose bundle
  // contains the bridge:
  //
  //   datetime root           148_564   datetime/holiday      1_582_732
  //   date                    149_647   time                    149_933
  //   range-core              148_976   date-range              153_885
  //   time-range              151_256   datetime-range root     152_507
  //   datetime-range holiday 1_595_235
  //
  // `date-range` moves furthest (+1_498 B over its previous ceiling) because it
  // pays for the shared ordinal module *and* its own week-span grammar on top;
  // `range-core` moves least, and moves at all only because the bridge it links
  // got bigger. No vocabulary row and no `/validate` row moved by a byte, which
  // is the wall holding: three new grammars in the date packages are invisible
  // to a bundle that parses kilometres.
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
  // What a kind package pays for the authoring layer, measured apart from any
  // kind so the number is the layer and nothing else. `defineKind` drags
  // `Decimal` behind it — a ratio is a decimal string until something reads it
  // — and decimal.js is very nearly the whole of this row. That is what the
  // `boolean` row further down has always been measuring; the extraction only
  // made it visible on its own instead of buried in a kind's total.
  // The unscoped install name, measured so the facade cannot grow a cost of its
  // own. Every module in `smartputs` is a re-export of the matching
  // `@smartput/core` entry, and the measurement says so exactly: the same
  // `createEngine` import is 78_895 B through either name — identical to the
  // byte — and 28_643 B against 28_647 B gzipped, a four-byte difference that is
  // compression noise over a re-export rather than a second copy of anything.
  //
  // So this row is an equality check wearing a budget. If it ever climbs away
  // from core's own number, some module in the facade stopped being a re-export
  // and started being code.
  //
  // 2026-08-16, scan mode: 78_895 -> 83_281 B min, 28_647 -> 30_161 B gzip.
  // `engine.scan()`, the cue-collection pass over `buildRegistry`'s index, and
  // the `Mark`/`Reading`/`CueHit` types it returns are all reachable from
  // `createEngine`, so the growth belongs to core and the facade merely
  // reports it.
  //
  // 2026-08-16, the scan-mode fix wave: 83_281 -> 83_714 B min, 30_161 ->
  // 30_279 B gzip. Three of the wave's fixes are real code, not test-only, and
  // all three are reachable from `createEngine` the same way scan mode itself
  // was: `matchAt`'s and `endsOperand`'s shared `gapBreaksRun` (the
  // punctuation-and-newline gap check backoff was missing), `collectCues`'s
  // locale-aware fold (`toLocaleLowerCase(locale)` in place of
  // `.toLowerCase()`), and its per-(token, kind) dedup plus `locales`
  // forwarding. The growth still belongs to core; the facade still only
  // reports it.
  //
  // 2026-08-16, the residual `gapBreaksRun`/`mapSpan` fix: 83_714 -> 83_766 B
  // min, 30_279 -> 30_301 B gzip. Real code again: `gapBreaksRun` now takes
  // one real `mapSpan({ start: prev.end, end: cur.start })` call instead of
  // two zero-width ones, and adds the `mapped.start === 0 && mapped.end ===
  // source.length` guard that detects an unmappable `nfkcShifted` answer and
  // skips the line-boundary check rather than misreading the whole source as
  // the gap. Same reachability path as above; the facade still only reports
  // core's growth.
  //
  // 2026-08-18, context-aware completion: 83_766 -> 84_834 B min, 30_301 ->
  // 30_623 B gzip. `complete()` now narrows a conversion target to the kinds
  // the head actually converts to, which is `complete/context.ts` (the keyword
  // walk back from the fragment and the `in`-signature set) plus the engine's
  // `contextFor` — a head parse and solve wired into `completerFor`. Reachable
  // from `createEngine` like everything above it, so the growth is core's and
  // the facade reports it.
  //
  // 2026-08-18, the count query: 84_834 -> 87_070 B min, 30_623 -> 31_444 B
  // gzip. "minutes in hour" is a question, not a conversion, and telling the
  // two apart is three pieces of real code — `eval/count.ts` (the reading),
  // the registry's lazily-built `formIndex` (which spelling of a unit is
  // plural, probed off `selectForm` rather than assumed), and the branch in
  // `evaluate` that swaps the operands and refuses an answer below one. Every
  // row below that moved by 30-100 B moved for the registry half alone; this
  // row carries the evaluator's too, because it is the one that reaches
  // `evaluate`.
  //
  // 2026-08-19, the second pass (defects A-G): 87_070 -> 97_801 B min, 31_444
  // -> 34_829 B gzip. The largest move this row has ever taken, and it is seven
  // features deep, so it is attributed rather than asserted. Each module below
  // was minified on its own with every import external, once at 46d8f77 and
  // once at HEAD; the deltas are per-module sizes, not bundle contributions, so
  // they apportion the growth rather than summing to it exactly:
  //
  //   solve/solver.ts      +2_069  number slots in `collectSlots`/`enumerate`
  //   engine.ts            +1_683  `explain` never throws; `context` config
  //   parse/pratt.ts       +1_460  the compound fold, derived-unit targets
  //   kind/registry.ts     +1_443  the derived-unit table, built at boot
  //   parse/lex.ts           +985  per-grammar digit scan, digit-run split
  //   parse/candidates.ts    +762  one number reading per installed grammar
  //   format/format.ts       +460  the display precision policy
  //   print/print.ts         +390  display rounding and tight symbol spacing
  //   locale/number.ts       +353  grammars derived from `locales`
  //   eval/evaluate.ts       +337  derived result units
  //   solve/weights.ts       +280  the `grammar:` selector
  //
  // That is 10_222 B of the 10_731 measured here. The remainder is
  // `kind/errors.ts` (+319, and see the header above for the fifteen rows that
  // pay only that) plus a handful of modules under 50 B each.
  //
  // One spec estimate was wrong, and it is recorded rather than rounded away:
  // §A.4 costed the per-grammar loop at "under 300 B" and `lex.ts` moved by
  // 985. The estimate was not wrong about the loop — §A.2's grammar loop and
  // §B.2's digit-run split and `in`-as-inch re-lex all landed in the one
  // module, and the spec costed only the first of the three. A per-defect byte
  // estimate is only meaningful per *module*, which is the lesson worth
  // carrying into the next spec.
  {
    label: "smartputs root (the facade over core)",
    from: "smartputs",
    names: ["createEngine"],
    min: 97_850,
    gzip: 34_850,
  },
  {
    label: "kind root (defineKind, with Decimal behind it)",
    from: "@smartput/kind",
    names: ["defineKind"],
    min: 33_500,
    gzip: 13_350,
  },
  {
    // The proof of ruling R-F1. `@smartput/kind/contracts` declares the shapes
    // kinds agree on — `PlaceMeta`, `RangeMeta`, `InstantMeta`, `MoneyContext` —
    // and declaring a shape is not code, so a consumer who imports one pays
    // nothing for it. That is the entire argument for a subpath over a
    // `@smartput/contracts` package, and this row is the argument measured.
    //
    // Zero, and the row exists to keep it zero: the moment someone puts a const
    // or a function in `contracts.ts`, every package that imports a shape starts
    // paying for it, and this row fails OVER on the first build.
    label: "kind/contracts (types only — the proof of ruling R-F1)",
    from: "@smartput/kind/contracts",
    names: [],
    typesOnly: true,
    min: 0,
    gzip: 0,
  },
  // Naming a kind's words used to cost the same 33 KB, and now costs 272 B.
  //
  // The path was `defineVocabulary` -> `deepFreeze` -> `value instanceof
  // Decimal`: one guard, which exists because decimal.js mutates instance
  // internals and freezing one breaks arithmetic, and which linked the whole
  // library into a bundle whose payload is a table of nouns. The reason was
  // sound and the mechanism was not. `deepFreeze` now tests a
  // `Symbol.for("smartput.decimal")` brand that `decimal.ts` stamps onto
  // `Decimal.prototype`, so recognising a Decimal no longer requires importing
  // one — see `packages/kind/src/brand.ts` for why the symbol is registry-global
  // and why that makes the check stricter than the `instanceof` it replaced.
  //
  // 33_407 -> 272 B minified, 13_276 -> 206 B gzipped, measured before and
  // after; the dated note at the head of this table has the rest of the ledger,
  // including the dozen rows that went *up* by ~53 B each to pay for it. The
  // budget is the measurement rounded up to the next 50 B like any other, which
  // means this row now has ~28 B of headroom and will fail on any regrowth at
  // all. That is the intent: this is the row where the engine gets back in.
  {
    label: "kind/vocabulary defineVocabulary only",
    from: "@smartput/kind/vocabulary",
    names: ["defineVocabulary"],
    min: 300,
    gzip: 250,
  },
  // What the row above costs a consumer who never asked for it: a kind's locale
  // entry, which is eight English nouns and their aliases, and which measured
  // 34_667 B when this row was added. Labelled for the general case because it
  // is one — every locale module in the repo is the same three lines over a
  // different table, so `de`, `ja` and `uk` all cost this too, and `length/en`
  // is only the one with a row.
  //
  // Nothing in this repo had ever measured a locale entry, which is exactly why
  // a 34 KB vocabulary survived this long in a repo with a byte-budget harness.
  // The `names: ["default"]` support two paragraphs up exists for this row: a
  // vocabulary is a default export, so until now the harness could not have
  // asked the question even if someone had thought to.
  //
  // 34 KB was the wrong answer for a table of nouns by roughly the whole of
  // decimal.js, which arrived twice over and by two unrelated doors:
  // `defineVocabulary` -> `deepFreeze` -> `value instanceof Decimal` (the guard
  // the row above documents), and `aliasesFor` sharing a module with
  // `decimalRatios`, so naming the alias helper links the ratio machinery. A
  // translator's file pays for the arithmetic engine because of an `instanceof`
  // and a module boundary, and neither has anything to do with words.
  //
  // 2026-08-16, the first door: `deepFreeze` stopped importing decimal.js and
  // `kind/vocabulary` went 33_407 -> 272 B, while this row went 34_667 -> 34_720
  // — *up* by the 53 B the brand costs and down by nothing at all. That was the
  // proof the second door was never merely suspected: both were load-bearing
  // independently, so closing one bought a locale module exactly zero.
  //
  // 2026-08-16, the second door, and the one this row was written for:
  //
  //   length/locale/en   34_720 -> 1_519 B min, 13_781 -> 655 B gzip
  //
  // 22.9x minified, 21.0x gzipped, and not one line of the vocabulary changed.
  // `aliasesFor` and the `RatioTable` interface moved to
  // `packages/kind/src/aliases.ts`, which imports nothing; `from-table.ts` keeps
  // `decimalRatios` and the `Decimal` it needs, and re-exports the type so no
  // public name moved. Then 273 locale files across the sixteen kind packages
  // with locales, plus the `kinds` aggregator, were rewritten by script from
  //
  //   import { aliasesFor, defineVocabulary } from "@smartput/kind";
  //
  // to the two subpaths — `@smartput/kind/aliases` and
  // `@smartput/kind/vocabulary` — because the root barrel is one module and
  // `defineKind` lives in it, so naming *anything* there links decimal.js
  // regardless of what you asked for. That trap is now written into
  // `packages/kind/src/index.ts`'s header, where the next person will meet it.
  //
  // 273 published entries — sixteen kind packages with a locale directory and
  // the `kinds` aggregator, seventeen languages each; `boolean` has none —
  // stopped shipping an arithmetic engine to say that "kilometre" means `km`.
  // Not every vocabulary in the repo: the sweep was written as "every kind
  // package", and `datetime`, `rate` and `geo` ship vocabularies without being
  // kind packages, so their 35 locale files were missed on the first pass and
  // migrated after a review caught it. Their rows are below. The whole 33 KB was
  // decimal.js arriving twice by two unrelated doors, and the second one was a
  // module boundary that existed because two functions were written the same
  // afternoon.
  //
  // The ceiling was 1_550 B — the measurement rounded up to the next 50 B like
  // every other row — which left ~31 B of headroom and a floor of 1_085 B.
  // A single stray `from "@smartput/kind"` in any locale file puts this row back
  // over by a factor of twenty-two, which is precisely the alarm wanted.
  //
  // 2026-08-16, scan mode: 1_519 -> 1_626 B min, 655 -> 735 B gzip. `en.ts`
  // gained a `cues` table so length's words can argue for a `scan()` mark —
  // and it is not the only kind package whose `locale/en.ts` did: area,
  // datasize, duration, energy, mass, percent, power, speed, temperature and
  // volume all gained one too. This is the only row of the ten-plus-one that
  // moved because it is the only one with a budget row at all — `length` is
  // the one kind package this block measures individually (`rate` and
  // `datetime` are the other two `locale/en` rows below, and neither ships
  // cues). The other ten grew with no row here to raise, which is a gap in
  // this file's coverage, not evidence their `en.ts` stayed the same size.
  {
    label: "length/locale/en (a kind's words, no arithmetic)",
    from: "@smartput/length/locale/en",
    names: ["default"],
    min: 1650,
    gzip: 750,
  },
  // The same guard for the two packages the first migration missed, and they are
  // the reason it is worth having more than one row for this. `length` is a kind
  // package; `rate` and `datetime` are not, so a sweep written as "every kind
  // package" walked straight past them and left their seventeen locales each
  // still importing core’s root barrel at ~35.7 KB apiece — a third of the
  // published vocabularies in the repo, reported as finished. One row per shape
  // rather than one row for the class, because the bug was never a byte count:
  // it was a sweep whose definition of "every" did not match the repo’s.
  {
    label: "rate/locale/en (a vocabulary outside the kind packages)",
    from: "@smartput/rate/locale/en",
    names: ["default"],
    min: 36_100,
    gzip: 14_200,
  },
  {
    label: "datetime/locale/en (a vocabulary outside the kind packages)",
    from: "@smartput/datetime/locale/en",
    names: ["default"],
    min: 36_000,
    gzip: 14_450,
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
  // The two packages below the kind, each measured for the claim that it is
  // usable without the gazetteer the kind ships. Both were inside the 128 KB row
  // above until the split, where "does the postal validator cost you a country
  // table" had no way to be asked. The answer is 37 KB rather than the 8 KB the
  // code is worth: decimal.js is ~35 KB of both numbers and is the floor for
  // anything that builds a Value at all. What these rows watch is the delta —
  // a country table arriving in either one is +90 KB and unmissable.
  {
    label: "distance root (the op, no gazetteer)",
    from: "@smartput/distance",
    names: ["PlaceDistance"],
    min: 40_500,
    gzip: 16_500,
  },

  // Search, ranking and the cache, with no gazetteer and no `decimal.js`. This
  // row is the claim the package's whole argument rests on: a live geocoder must
  // cost a fraction of the table it replaces, or a consumer is better off with
  // the table. It sits an order of magnitude under the `country root` row above,
  // and the day someone imports a data file into this graph it does not drift —
  // it jumps.
  {
    label: "geo root (search and ranking, no data at all)",
    from: "@smartput/geo",
    names: ["Geo", "rank"],
    min: 49_650,
    gzip: 19_750,
  },
  // The providers entry point, measured apart from the root for the reason it is
  // a separate export: a consumer who only wants the types and the ranking must
  // not link a fetch path they never call.
  {
    label: "geo providers (every adapter)",
    from: "@smartput/geo/providers",
    names: ["geonames", "postalCodes", "bundled", "custom"],
    min: 9_700,
    gzip: 3_400,
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
    min: 148_600,
    gzip: 52_050,
    floor: 138_000,
  },
  {
    // What opting in actually costs, as a number rather than as a warning in a
    // doc: this row minus the one above is the price of the feature, and it is
    // the number someone should be made to look at before adding the import.
    label: "datetime/holiday (the opt-in cost)",
    from: "@smartput/datetime/holiday",
    names: ["datetimeWithHolidays"],
    min: 1_583_000,
    gzip: 289_050,
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
  //   date-range   +5_321 B    the phrase table and the ordinal-week grammar
  //
  // That is the milestone's real size claim and the reason all six rows sit
  // within 6 KB of each other: none of these packages ships a second date
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
    min: 149_650,
    gzip: 52_100,
    floor: 138_000,
  },
  {
    label: "time",
    from: "@smartput/time",
    names: ["time"],
    min: 149_950,
    gzip: 52_200,
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
    min: 149_000,
    gzip: 52_000,
    floor: 138_000,
  },
  {
    label: "date-range",
    from: "@smartput/date-range",
    names: ["dateRange"],
    min: 153_900,
    gzip: 53_300,
    floor: 138_000,
  },
  {
    label: "time-range",
    from: "@smartput/time-range",
    names: ["timeRange"],
    min: 151_300,
    gzip: 52_700,
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
    min: 152_550,
    gzip: 53_150,
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
    min: 1_596_000,
    gzip: 294_250,
  },
  {
    // The selection range, and the one range package that is not a hundred and
    // forty kilobytes: it names neither Temporal nor chrono, so what it costs is
    // core's own graph plus `numberFromWords`. Roughly what `zip root` and
    // `distance root` cost, which is the band a kind with no data table sits in.
    label: "range",
    from: "@smartput/range",
    names: ["RANGE_KINDS"],
    min: 43_800,
    gzip: 17_350,
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
    min: 43_800,
    gzip: 17_350,
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
  // The four `@smartput/color` rows, and the gap between the third and the
  // others is the whole reason that package has a `/i18n` subpath.
  //
  // The root is core's graph plus `@urcolor/core` — a CSS Color 4 parser, the
  // space registry and the serialiser — and the class door is the same library
  // without the engine, which is why it measures *less* than the root rather
  // than more. `/i18n` is 2.5 MB: `@urcolor/i18n` ships colour-naming data for
  // 298 languages, and a consumer who pastes hex codes must never link it. That
  // claim is this row, not the comment in `check-deps.ts` next to it — move one
  // import of `ColorNames` into `src/color.ts` and the root row above jumps by
  // a factor of thirty-five.
  //
  // `locale/en` is the fourth row and the one that would break silently: at
  // ~2 KB it proves the vocabulary reaches neither decimal.js nor the colour
  // library, which is what `@smartput/kind/vocabulary` and a type-only import
  // of `SpaceId` buy. A root-barrel import in any of the seventeen locale files
  // puts it over by a factor of twenty.
  {
    label: "color root (the kinds, the parser, no datasets)",
    from: "@smartput/color",
    names: ["color", "COLOR_KINDS"],
    min: 71_450,
    gzip: 27_100,
  },
  {
    label: "color/class (upstream's Color, no engine)",
    from: "@smartput/color/class",
    names: ["Color", "colorValue"],
    min: 59_000,
    gzip: 23_200,
  },
  {
    label: "color/i18n (298 languages of colour names — the opt-in cost)",
    from: "@smartput/color/i18n",
    names: ["loadColorNames", "channelWordsFor"],
    min: 2_550_950,
    gzip: 667_000,
  },
  {
    label: "color/locale/en (notation words, no arithmetic and no colour library)",
    from: "@smartput/color/locale/en",
    names: ["default"],
    min: 2_000,
    gzip: 900,
  },
  {
    label: "query root (grammar + schema, no dialect)",
    from: "@smartput/query",
    names: ["QueryEngine", "defineSchema"],
    min: 59_700,
    gzip: 22_100,
  },
  {
    label: "query/sql",
    from: "@smartput/query/sql",
    names: ["SqlCompiler"],
    min: 3_300,
    gzip: 1_400,
  },
  {
    label: "query/mongo",
    from: "@smartput/query/mongo",
    names: ["MongoCompiler"],
    min: 4_600,
    gzip: 1_850,
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
