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
  // Spec §4 and §13: core ships exactly one runtime dependency and does not
  // depend on @smartput/shared — the dependency runs the other way. It was
  // listed here for a while so that `from-table.ts` could `import type
  // { UnitTable }`; that type is now declared structurally in core as
  // `RatioTable`, so nothing in core names the package outside a dev-only test.
  "packages/core/package.json": ["decimal.js"],
  // The zone tables and the written-offset parser, with no runtime dependency
  // at all — a table of zone names needs no engine to be a table, and a form
  // field offering a zone picker should not install chrono and Temporal to get
  // one. It is underneath datetime for the same reason `@smartput/city` is
  // underneath country: the edge runs from the consumer inwards.
  "packages/timezone/package.json": [],
  // The datetime kind, the chrono bridge and the Temporal ops. `@smartput/
  // holiday` is a dependency of the *package* but not of its root entry: one
  // file imports it, `src/holiday.ts`, and that file is reachable only through
  // the `./holiday` subpath. This map cannot tell the difference — it reads a
  // manifest — so the claim is enforced next door instead, by the `datetime root
  // (no holiday data)` row in check-size.ts, which fails by a megabyte the
  // moment the import reaches the root graph.
  //
  // A devDependency was the other way to keep it off the root, and it is the
  // wrong one for the same reason `@smartput/country` lists `@smartput/city`
  // here: the emitted `holiday.d.ts` names the package, and a published
  // declaration naming a package absent from the manifest is a dependency a
  // consumer discovers on install.
  "packages/datetime/package.json": [
    "@smartput/core",
    "@smartput/holiday",
    "@smartput/timezone",
    "chrono-node",
    "decimal.js",
    "temporal-polyfill",
  ],
  // Which holiday a phrase names and when it falls: the `date-holidays` rule
  // table, a tokenising scorer over the names, and nothing else. No `@smartput`
  // edge at all — it knows nothing about kinds, values, `Decimal` or the engine
  // — which is what lets the package above reach it from a subpath rather than
  // from its root. Precedent: `@smartput/city` and `@smartput/timezone` ship
  // with none either.
  //
  // Size is why this is a package and not a file inside `datetime`.
  // `date-holidays@3.34.1` ships a 768 KB `holidays.json`, is CommonJS, and
  // pulls `date-holidays-parser`, `js-yaml`, `lodash` and `prepin` behind it;
  // bundled it is ~1.5 MB, six times the T0 gazetteer that the `country root`
  // row in check-size.ts exists to keep out of a bundle. As a plain dependency
  // of `datetime` it would charge every consumer of `today + 3 d` a megabyte for
  // a feature they did not ask for — the trade this repo has already refused
  // twice, for T1 inside `country` and for chrono and Temporal inside `core`.
  //
  // Its own edit-distance scorer is a copy of core's, not an import of it, and
  // that is deliberate: importing would cost this package the `@smartput` edge
  // its whole shape depends on, and core's `nearestWord` refuses a tie, which is
  // exactly wrong for something that has to return a ranked list.
  "packages/holiday/package.json": ["date-holidays"],
  // The rate half of money: snapshots, the ECB provider, the live-engine
  // facade, and the `money` kind whose unit ratios read an injected table. It
  // depends on `@smartput/currency` for the other half — the symbol, the minor
  // units, the aliases and the parser — because none of those change when a
  // rate does, and a form field that only wants to read "30 usd" should not
  // have to link a provider to do it.
  "packages/rate/package.json": ["decimal.js", "@smartput/core", "@smartput/currency"],
  // What a currency *is*, with nothing about what it is worth: the table, the
  // vocabulary, the parser and the formatter. Core is here for `Decimal` — the
  // repo forbids importing decimal.js directly, because core's module-load
  // `Decimal.set({ precision: 28 })` is what keeps every package at one
  // precision — and for the `Lexicon` type, which compiles away.
  "packages/currency/package.json": ["decimal.js", "@smartput/core"],
  // The number package is here for its word vocabulary, not its kind: reading
  // "one hundred and five" and spelling 105 back are what `latexFromWords` and
  // `describe` share with it. The cardinals briefly lived in a language package
  // of their own; they are back beside the kind whose unit is one, so this is
  // one edge rather than two.
  "packages/math/package.json": [
    "@cortex-js/compute-engine",
    "@smartput/core",
    "@smartput/number",
  ],
  // The great-circle op, and nothing else. It used to name `@smartput/zip` for
  // one constant — the id a postal code carries when nothing has positioned it,
  // which is the case `between` refuses. That package is gone and its postal
  // machinery lives inside `@smartput/geo`, whose kind names `PlaceDistance`, so
  // importing the constant back would close a cycle. It is restated in
  // `distance.ts` instead.
  "packages/distance/package.json": ["@smartput/core", "decimal.js"],
  // Free-text place search over the GeoNames web service and whatever else the
  // consumer plugs in. One edge, to core, for `SmartputError` — and not to
  // `decimal.js`, because nothing here is arithmetic on a Value: a score is a
  // ranking artefact and a coordinate is data at rest, exactly as `CountryRow`'s
  // header argues for the vendored tables.
  //
  // The edge to `@smartput/distance` is the place kind's one op, and it is the
  // only one: this package ships no gazetteer at all. `definePlace()` and
  // `bundled()` both take their rows as arguments, so the tiering rule the four
  // deleted packages existed to enforce now holds by construction — there is no
  // table to keep out of a bundle.
  "packages/geo/package.json": ["@smartput/core", "@smartput/distance", "decimal.js"],

  // The micro-validation path. Zero runtime dependencies, enforced here: a
  // first one would mean decimal.js or core leaked into a 600-byte budget.
  "packages/shared/package.json": [],

  // One package per language (spec §10). It is the words-free half — analyzers,
  // cardinals, keywords, plural selection, render defaults — so it names no kind
  // package at all: a vocabulary reaches its language through `composeLocale`,
  // at the integrator's own wiring, never through an import here. That is what
  // lets a Ukrainian package ship without the ratio tables, and it is why this
  // list is core and decimal.js and will stay that length for every language
  // after it.
  //

  // Extracted built-in kinds. Each is a leaf: it defines one kind against the
  // machinery in core and depends on nothing else, which is what keeps the
  // aggregator below the only package that has to know the full set.
  //
  // `@smartput/core` is absent from every list here and that is the point. It
  // is an *optional peer* for each of them (see CORE_IS_PEER below): the only
  // entries that reach it are `.` and `./locale/*`, both of which a consumer
  // reaches by having already written `createEngine` — so core is a package
  // they install by name, and listing it here would charge the far larger
  // `./validate` audience 1.4 MB of engine plus decimal.js on install for an
  // import their bundler was always going to shake out. check-size.ts has held
  // the *bundle* at 1.5 KB since the micro path shipped; this holds the
  // install graph to the same claim.
  "packages/angle/package.json": ["@smartput/shared"],
  // What a comparison returns. The odd one out of the leaf kinds: it names no
  // `@smartput/shared`, because the micro path is for *ratio* kinds — a
  // `parseBoolean` over units that do not exist would be a subpath with nothing
  // behind it — and it defines no operation at all. The six signatures that
  // produce a boolean are generated by core, per kind, beside the arithmetic
  // ones, so this package is a kind, a formatter and two ways to read a result.
  //
  // Core stays a plain dependency for that same reason, and it is the argument
  // for the peer next door stated backwards: this package ships *only* the
  // engine entry, so there is no audience for it that does not want core, and
  // demoting it to a peer would trade a guarantee for nothing.
  "packages/boolean/package.json": ["@smartput/core"],
  "packages/area/package.json": ["@smartput/shared"],
  "packages/datasize/package.json": ["@smartput/shared"],
  "packages/duration/package.json": ["@smartput/shared"],
  "packages/length/package.json": ["@smartput/shared"],
  "packages/mass/package.json": ["@smartput/shared"],
  "packages/measure/package.json": ["@smartput/shared"],
  // A leaf again, and the shortest way to say why: this package is a ratio of
  // one and a unit id. It carried a *language* edge for as long as `words.ts`
  // lived here — English cardinals, read through `@smartput/core/locale/en` — and
  // that file has moved to the language it was always written in, taking the
  // edge with it. A kind that named one language would have been a kind no
  // other language could ship without.
  "packages/number/package.json": ["@smartput/shared"],
  "packages/percent/package.json": ["@smartput/shared"],
  "packages/speed/package.json": ["@smartput/shared"],
  "packages/temperature/package.json": ["@smartput/shared"],
  "packages/volume/package.json": ["@smartput/shared"],

  // The four kinds that bridge two other kinds rather than standing alone. They
  // are leaves too, and that is the point worth stating: an op signature names
  // its operand kinds by *string*, so `datarate` can answer "500 mb / 20 s"
  // without depending on `@smartput/datasize` or `@smartput/duration`, and
  // `energy` can own the whole power x duration bridge without depending on
  // `@smartput/power`. A dependency here would mean someone reached for an
  // import where an id would do, and would drag two more tables into a bundle
  // that asked for one.
  "packages/datarate/package.json": ["@smartput/shared"],
  "packages/energy/package.json": ["@smartput/shared"],
  "packages/power/package.json": ["@smartput/shared"],
  // Reciprocal rather than linear — 120 bpm is a half-second beat — so its
  // bridge to `duration` is an `in` signature instead of a ratio row. Same
  // string-named operands, same empty edge list.
  "packages/tempo/package.json": ["@smartput/shared"],

  // The calendar-day half of datetime's recognition. It depends on datetime
  // rather than on chrono because it re-reads the match datetime already made
  // — `hasDate && !hasTime` — instead of parsing the string a second time. That
  // is also why `@smartput/timezone` is absent even though the design's summary
  // table lists it: the zone arrives inside the bridge match, so nothing here
  // names the zone package itself.
  "packages/date/package.json": ["@smartput/core", "@smartput/datetime"],
  // The clock-time half, on the same terms as `date`.
  "packages/time/package.json": ["@smartput/core", "@smartput/datetime"],
  // The interval algebra the three range kinds share: the meta shape, boundary
  // snapping, the window table, the endpoint seam and `InvertedRangeError`.
  // Depends on datetime for `Temporal` rather than importing temporal-polyfill
  // a second time — that package has one import site by design, and every
  // consumer of this one already pays for datetime.
  "packages/range-core/package.json": ["@smartput/core", "@smartput/datetime"],
  // The three range kinds. Each names only the endpoint kind it actually reads,
  // so a consumer who wants `10:00 - 20:00` does not link the calendar half.
  //
  // `@smartput/datetime` is here for the same two names `range-core` takes it
  // for — `Temporal`, because the polyfill has one import site in the repo by
  // design, and `addDuration`, because "whole week + 1 wk" has to walk the
  // calendar rather than add 604800 seconds. It costs a consumer nothing: this
  // package already reaches datetime through `@smartput/date`, which re-reads
  // datetime's chrono match instead of parsing again.
  "packages/date-range/package.json": [
    "@smartput/core",
    "@smartput/date",
    "@smartput/datetime",
    "@smartput/range-core",
  ],
  "packages/time-range/package.json": [
    "@smartput/core",
    "@smartput/range-core",
    "@smartput/time",
  ],
  // `@smartput/holiday` is a dependency of the package but not of its root
  // entry: one file imports it, `src/holiday.ts`, reachable only through the
  // `./holiday` subpath. This map cannot tell the difference — it reads a
  // manifest — so the claim is enforced next door by check-size.ts's
  // `datetime-range root (no holiday data)` row, exactly as datetime's is.
  //
  // It is a dependency rather than a devDependency for the reason stated above
  // for datetime: the emitted `holiday.d.ts` names the package, and a published
  // declaration naming a package absent from the manifest is a dependency a
  // consumer discovers on install.
  "packages/datetime-range/package.json": [
    "@smartput/core",
    "@smartput/date",
    "@smartput/datetime",
    "@smartput/holiday",
    "@smartput/range-core",
    "@smartput/time",
  ],
  // The selection range — "first three", "from 6 to 9", "4-5" — and the odd one
  // out of the four range packages: it names neither `@smartput/range-core` nor
  // `@smartput/datetime`, because a position in a list has no calendar in it and
  // the interval algebra over there is entirely about instants. `@smartput/
  // number` is here for `numberFromWords` alone, so that a spelled count reads
  // the same as a spelled quantity rather than through a second table of
  // cardinals.
  "packages/range/package.json": ["@smartput/core", "@smartput/number"],

  // The clause grammar over a declared schema, and the two dialects it emits.
  // Core is the only edge, and it is not the usual one: this package registers
  // no kind and defines no unit — it *drives* an engine the consumer built, so
  // every value it can read is a value that engine's kinds could read. That is
  // what keeps `€500`, `2 kg`, `last quarter` and `kyiv` working here without a
  // dependency on `@smartput/rate`, `@smartput/mass`, `@smartput/date-range` or
  // `@smartput/country`; all four are devDependencies, because the corpus has
  // to build the engine a real consumer would.
  //
  // The range and place shapes it reads off `Value.meta` are matched
  // structurally, on the precedent core's own `PlaceMeta` sets: the shape is
  // the contract, and importing the packages that produce it would drag
  // Temporal and a gazetteer into a bundle whose job is to emit a WHERE clause.
  "packages/query/package.json": ["@smartput/core"],

  // The aggregator: re-exports every kind above and owns BUILTIN_KINDS, so it
  // is the one package legitimately allowed to depend on all of them.
  "packages/kinds/package.json": [
    "@smartput/core",
    "@smartput/angle",
    "@smartput/boolean",
    "@smartput/area",
    "@smartput/datarate",
    "@smartput/datasize",
    "@smartput/duration",
    "@smartput/energy",
    "@smartput/length",
    "@smartput/mass",
    "@smartput/measure",
    "@smartput/number",
    "@smartput/percent",
    "@smartput/power",
    "@smartput/speed",
    "@smartput/temperature",
    "@smartput/tempo",
    "@smartput/volume",
  ],
};

/**
 * The packages that declare `@smartput/core` as an optional peer instead of a
 * dependency, and the exact shape that declaration must have. Listed by path
 * rather than derived from "has a `./validate`" so that adding a kind is a
 * decision someone wrote down here, the same rule the map above follows.
 *
 * Optional and not required: `npm add @smartput/length` must install cleanly
 * and print nothing, because the consumer who stops at `parseLength` has
 * everything they came for. A required peer would warn every one of them about
 * a package they were right not to want.
 *
 * The devDependency alongside it is not redundant. A peer is resolved by the
 * consumer, and inside this workspace *we* are the consumer: the kind's own
 * `.` entry, its locale files and its tests all import core, and with only the
 * peer edge declared their resolution would depend on a hoist that no lockfile
 * promises.
 *
 * What makes any of this true rather than merely written down is
 * `peerLeaksInto` below. A manifest saying core is optional is a claim about
 * reachability, and the claim is worth exactly what checks it: move one import
 * of `defineKind` from `index.ts` into `units.ts` and every sentence above
 * becomes false while the manifest still reads the same.
 */
const CORE_IS_PEER = new Set([
  "packages/angle/package.json",
  "packages/area/package.json",
  "packages/datarate/package.json",
  "packages/datasize/package.json",
  "packages/duration/package.json",
  "packages/energy/package.json",
  "packages/length/package.json",
  "packages/mass/package.json",
  "packages/measure/package.json",
  "packages/number/package.json",
  "packages/percent/package.json",
  "packages/power/package.json",
  "packages/speed/package.json",
  "packages/temperature/package.json",
  "packages/tempo/package.json",
  "packages/volume/package.json",
]);

const PEER = "@smartput/core";

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
  // Re-exports all seventeen kinds, so the detection below sees a kind package.
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
  //
  // The exemption is about *conversion* and always was. Everything else the
  // micro path offers — which currency a word names, how much "30 usd" is, how
  // to write it back — needs no rate, and ships as `@smartput/currency/validate`.
  // That package exports no kind, so this map never sees it.
  "packages/rate/package.json": {
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

/**
 * Every `@smartput/*` package this package's shipping source names, test files
 * excluded.
 *
 * This is the check that runs in the direction the manifest cannot: a manifest
 * says what a package *may* depend on, and this says what it actually does.
 * Core listing `@smartput/shared` as a runtime dependency passed the manifest
 * check for a milestone because someone widened the allowlist; what nothing
 * asked was whether core's source imports it at all. It does not, and §4 says
 * it must not — so the two halves together are the invariant, and either alone
 * is a rubber stamp.
 *
 * `import type` counts. It compiles away, but it survives into the emitted
 * `.d.ts`, and a published declaration naming a package absent from the
 * manifest is a dependency a consumer discovers on install.
 *
 * Both patterns are anchored to the start of a line, which is what keeps a
 * documented example out of the answer. `@smartput/geo`'s `cities.ts` opens
 * with the two-line snippet a consumer types, indented inside a doc comment —
 * a bare `from "..."` search read that as geo importing itself and failed the
 * package for a line that compiles to nothing. Comment bodies carry a leading
 * `*`, and a statement never does, so requiring `import`/`export` to be the
 * first thing on its line separates the two without parsing TypeScript.
 * `[^;]*?` stops the multi-line form from running past its own semicolon into
 * the next statement's specifier.
 */
const IMPORT_FROM =
  /^\s*(?:import|export)\b[^;]*?\bfrom\s+"(@smartput\/[a-z-]+)(?:\/[^"]*)?"/gm;
/** `import "@smartput/x"` — for the side effect, no bindings, so no `from`. */
const IMPORT_BARE = /^\s*import\s+"(@smartput\/[a-z-]+)(?:\/[^"]*)?"/gm;

async function workspaceImportsOf(dir: string): Promise<Set<string>> {
  const out = new Set<string>();
  const glob = new Glob(`${dir}/src/**/*.ts`);
  for (const file of glob.scanSync(root.pathname)) {
    // `.test.ts` is obvious; `.fixture.ts` is the same claim for a file that
    // holds shared test *setup* rather than assertions. `@smartput/query`'s
    // worked schema needs six kind packages to stand up an engine, and it is
    // imported by three test files — inlining it in each would triple the
    // maintenance and put the same devDependency imports in all three anyway.
    // Neither suffix may appear in an `exports` map, so nothing here can reach
    // a consumer; `build.ts` only builds what `exports` names.
    if (file.endsWith(".test.ts") || file.endsWith(".fixture.ts")) continue;
    const text = await Bun.file(new URL(file, root)).text();
    for (const pattern of [IMPORT_FROM, IMPORT_BARE]) {
      for (const m of text.matchAll(pattern)) {
        const name = m[1];
        if (name !== undefined) out.add(name);
      }
    }
  }
  return out;
}

/**
 * The entries that are allowed to reach an optional peer: the root, which is
 * the kind itself, and the locale files, which are vocabularies for it. Both
 * are read by someone who has already written `createEngine`, so core is
 * already in their manifest by the time either import resolves.
 *
 * Stated as a predicate over the whole `exports` map rather than as a list of
 * micro subpaths, so a subpath added next milestone is covered on the day it is
 * added rather than on the day someone remembers to widen a constant here.
 */
const reachesTheEngine = (subpath: string) =>
  subpath === "." || subpath.startsWith("./locale/");

/**
 * Every `@smartput/*` package that survives into a bundle of one entry, with
 * workspace and npm packages left external.
 *
 * The settings are build.ts's, deliberately: the question is what a consumer's
 * bundler resolves off the published entry, and answering it with anything
 * other than the bundle we publish would be answering a different question.
 * Reading the emitted text rather than the module graph is what makes it
 * transitive for free — an import three files deep is either shaken out, in
 * which case it is not in the text, or it is not, in which case it is.
 */
async function bundledImportsOf(entry: string): Promise<Set<string>> {
  const built = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "esm",
    packages: "external",
    splitting: false,
  });
  if (!built.success) {
    throw new Error(`${entry} failed to bundle:\n${built.logs.map(String).join("\n")}`);
  }
  const out = new Set<string>();
  for (const output of built.outputs) {
    const text = await output.text();
    for (const pattern of [IMPORT_FROM, IMPORT_BARE]) {
      for (const m of text.matchAll(pattern)) {
        const name = m[1];
        if (name !== undefined) out.add(name);
      }
    }
  }
  return out;
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
  const exportsMap: Record<string, Record<string, string>> = pkg.exports ?? {};

  // The optional-peer half, in three claims: the manifest says what this file
  // says it says, the workspace can still resolve it, and — the one that has
  // teeth — no entry outside `.` and `./locale/*` can actually reach it.
  const peers = Object.keys(pkg.peerDependencies ?? {});
  if (CORE_IS_PEER.has(path)) {
    const meta = (pkg.peerDependenciesMeta ?? {})[PEER];
    if (peers.join(",") !== PEER) {
      console.error(
        `${pkg.name} is listed in CORE_IS_PEER but declares peerDependencies [${peers.join(", ") || "(none)"}]; expected exactly ${PEER}.`,
      );
      failed = true;
    } else if (meta?.optional !== true) {
      console.error(
        `${pkg.name} declares ${PEER} as a peer but not an optional one. Without "peerDependenciesMeta": { "${PEER}": { "optional": true } }, every consumer who only wanted the micro path is warned about a package they were right not to install.`,
      );
      failed = true;
    } else if (Object.keys(pkg.devDependencies ?? {}).includes(PEER)) {
      console.log(`${pkg.name} peer OK: ${PEER} (optional, devDependency for the workspace)`);
    } else {
      console.error(
        `${pkg.name} declares ${PEER} as an optional peer but does not list it in devDependencies. Its own "." entry, locale files and tests import core, and a peer edge alone leaves that resolution to a hoist no lockfile promises.`,
      );
      failed = true;
    }

    for (const [subpath, entry] of Object.entries(exportsMap)) {
      if (reachesTheEngine(subpath)) continue;
      const source = new URL(`${dir}/${entry.bun.replace(/^\.\//, "")}`, root);
      if (!(await Bun.file(source).exists())) continue; // reported by the subpath check below
      if ((await bundledImportsOf(source.pathname)).has(PEER)) {
        console.error(
          `${pkg.name} "${subpath}" bundles ${PEER}, which this package declares only as an optional peer. That subpath is reachable by a consumer who never installed core, so it must not import it — move whatever needs core to "." or a "./locale/*" entry.`,
        );
        failed = true;
      }
    }
  } else if (peers.length > 0) {
    console.error(
      `${pkg.name} declares peerDependencies [${peers.join(", ")}] but has no entry in CORE_IS_PEER. A peer is a dependency the consumer has to install, so add it there with the reason or make it a plain dependency.`,
    );
    failed = true;
  }

  // Both directions, so neither half is a rubber stamp: what the source imports
  // must be declared, and what is declared must be allowed.
  //
  // An optional peer counts as declared: it is in the manifest, so it is not a
  // dependency a consumer discovers on install, which is the whole point of
  // this half of the check.
  const imported = [...(await workspaceImportsOf(dir))].sort();
  const undeclared = imported.filter(
    (name) => !deps.includes(name) && !peers.includes(name),
  );
  if (undeclared.length > 0) {
    console.error(
      `${pkg.name} imports ${undeclared.join(", ")} from its shipping source but does not declare ${undeclared.length === 1 ? "it" : "them"} in "dependencies". Either declare it (and add it to ALLOWED above with the reason) or stop importing it.`,
    );
    failed = true;
  } else if (imported.length > 0) {
    console.log(`${pkg.name} source imports OK: ${imported.join(", ")}`);
  }

  if (!(await exportsRatioKind(dir))) continue;

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
