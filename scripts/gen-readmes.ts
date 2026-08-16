import { writeFile } from "node:fs/promises";
import {
  budgetsFor,
  bytes,
  cell,
  DEFAULT_SUBPATHS,
  DEMOS,
  META,
  type PageMeta,
  packageDirs,
  rootDir,
  runtimeExports,
  unitTablesFor,
} from "./gen-package-pages";

/**
 * Writes one `README.md` per workspace package.
 *
 * It shares its metadata with `gen-package-pages.ts` rather than restating it:
 * the summary, the prose and the entry-point descriptions are that file's
 * `META`, the tables are read from the source they describe, and the only thing
 * that lives here is the example — because the docs page's demo is a Vue
 * component, and a Vue component in a README on npm renders as nothing.
 *
 * **Every example's output is computed by running it.** `EXAMPLES` gives the
 * expression; the generator evaluates it against the package's own source and
 * writes the value it actually got as the trailing comment. A README example is
 * the single most-copied thing in a package and the first to rot, and a comment
 * a human typed is a claim nobody checks. This one fails the build instead: an
 * example that throws stops generation and names the package.
 *
 * Run `bun run docs:readmes`.
 */

/**
 * Packages whose README was written by hand and is better than anything this
 * file would emit. They are skipped, and the skip is asserted rather than
 * assumed — a hand-written README that gets deleted should fail here, not go
 * quietly missing.
 */
const HANDWRITTEN = new Set(["currency", "distance", "geo", "math", "timezone"]);

interface Example {
  /** Import lines, shown verbatim above the calls. */
  imports: string[];
  /** Setup shown verbatim and not evaluated — its results arrive via `scope`. */
  preamble?: string[];
  /** One expression per line. Shown, evaluated, and annotated with the result. */
  lines: string[];
  /** The bindings `lines` are evaluated against. */
  scope: () => Promise<Record<string, unknown>>;
  /** Markdown printed under the block. */
  note?: string;
}

const src = (pkg: string, file: string) =>
  import(`${rootDir}/packages/${pkg}/src/${file}`);

/** A ratio kind's three doors, over that kind's own table and demo examples. */
async function ratioExample(pkg: string): Promise<Example> {
  const Kind = pkg[0]?.toUpperCase() + pkg.slice(1);
  const demo = DEMOS[pkg] ?? "";
  // The sample and the expressions are the docs demo's, not a second set: a
  // README that shows different inputs from the live demo is a README that has
  // to be re-checked against it by hand.
  const sample = /model-value="([^"]+)"/.exec(demo)?.[1] ?? "";
  const exprs = [
    ...(/:examples="\[([^\]]+)\]"/.exec(demo)?.[1] ?? "").matchAll(/'([^']+)'/g),
  ]
    .map((m) => m[1] as string)
    .slice(0, 3);
  const units = await src(pkg, "units.ts");
  const tables = Object.keys(units).filter((k) => k.endsWith("_UNITS")).length;
  const table = units[`${pkg.toUpperCase()}_UNITS`] as {
    canonical: string;
    ratio: Record<string, string>;
  };
  // Converting to the unit the sample is already in demonstrates nothing, and
  // the sample is often the canonical one. Take the canonical unless that is
  // what was typed, and the next unit along if it is.
  const parsed = (await src(pkg, "validate.ts"))[`parse${Kind}`](sample) as {
    unit?: string;
  };
  const target =
    parsed.unit === table.canonical
      ? (Object.keys(table.ratio).find((u) => u !== parsed.unit) ?? table.canonical)
      : table.canonical;

  return {
    imports: [
      `import { parse${Kind}, as${Kind}, format${Kind} } from "@smartput/${pkg}/validate";`,
      `import { ${Kind} } from "@smartput/${pkg}/class";`,
    ],
    lines: [
      `parse${Kind}(${JSON.stringify(sample)})`,
      `as${Kind}(${JSON.stringify(sample)}, ${JSON.stringify(target)})`,
      `format${Kind}(parse${Kind}(${JSON.stringify(sample)}))`,
      `String(${Kind}.parse(${JSON.stringify(sample)}))`,
      "// …and the same table through the engine:",
      ...exprs.map((e) => `engine.evaluate(${JSON.stringify(e)}).formatted`),
    ],
    scope: async () => ({
      ...(await src(pkg, "validate.ts")),
      ...(await src(pkg, "class.ts")),
      engine: await kindEngine(pkg),
    }),
    // `temperature` ships two tables from one package, so "the one table" is
    // wrong there and only there. Counting beats hard-coding an exception.
    note: `\`parse\` and \`as\` never throw — they answer \`{ ok: true, … }\` or
\`{ ok: false, code, input }\`. The value class throws on bad input and
\`${Kind}.tryParse\` does not. All three read the ${tables > 1 ? `${tables} \`UnitTable\`s` : "one `UnitTable`"} below.`,
  };
}

/** The engine every example that needs one shares. Built once. */
let engineOnce: Promise<unknown> | undefined;
function builtinEngine(): Promise<unknown> {
  engineOnce ??= (async () => {
    const { createEngine, composeLocale } = await src("core", "index.ts");
    const { english } = await src("core", "locale/en.ts");
    const { BUILTIN_KINDS } = await src("kinds", "index.ts");
    const EN = (await src("kinds", "locale/en.ts")).default;
    return createEngine({
      locales: [composeLocale(english, EN)],
      kinds: BUILTIN_KINDS,
    });
  })();
  return engineOnce;
}

/**
 * The engine a ratio kind's examples run against.
 *
 * Almost always the shared built-in one. `measure` is the exception the docs
 * page also has to make: its `mm` and `cm` collide with `length`, so it is not
 * in `BUILTIN_KINDS` and an engine that is to read "12 pt" has to be told about
 * it. Registering it is a decision, and this is the file making it.
 */
async function kindEngine(pkg: string): Promise<unknown> {
  const { BUILTIN_KINDS } = await src("kinds", "index.ts");
  const registered = (BUILTIN_KINDS as { id: string }[]).some((k) => k.id === pkg);
  if (registered) return builtinEngine();

  const { createEngine, composeLocale } = await src("core", "index.ts");
  const { english } = await src("core", "locale/en.ts");
  const EN = (await src("kinds", "locale/en.ts")).default;
  const extraKind = (await src(pkg, "index.ts"))[pkg];
  const extraWords = (await src(pkg, "locale/en.ts")).default;
  return createEngine({
    locales: [composeLocale(english, [...EN, extraWords])],
    kinds: [...BUILTIN_KINDS, extraKind],
  });
}

// Split so a package with imports of its own can put them beside these rather
// than below the `createEngine` call — an import after a statement reads as a
// mistake even where the language allows it.
const ENGINE_IMPORTS = [
  'import { composeLocale, createEngine } from "@smartput/core";',
  'import { english } from "@smartput/core/locale/en";',
  'import { BUILTIN_KINDS } from "@smartput/kinds";',
  'import BUILTIN_EN from "@smartput/kinds/locale/en";',
];

const ENGINE_SETUP = [
  "const engine = createEngine({",
  "  locales: [composeLocale(english, BUILTIN_EN)],",
  "  kinds: BUILTIN_KINDS,",
  "});",
];

const ENGINE_PREAMBLE = [...ENGINE_IMPORTS, "", ...ENGINE_SETUP];

/** A date/time/range kind: the engine wiring differs, so it is spelled out. */
async function calendarEngine(extra: string[]): Promise<unknown> {
  const { createEngine, composeLocale } = await src("core", "index.ts");
  const { english } = await src("core", "locale/en.ts");
  const { BUILTIN_KINDS } = await src("kinds", "index.ts");
  const EN = (await src("kinds", "locale/en.ts")).default;
  const datetimeEn = (await src("datetime", "locale/en.ts")).default;
  const { datetime, TEST_NOW, TEST_ZONE } = await src("datetime", "index.ts");
  const kinds: unknown[] = [...BUILTIN_KINDS, datetime];
  for (const name of extra) {
    const mod = await src(name, "index.ts");
    kinds.push(mod[name.replace(/-(.)/g, (_, c: string) => c.toUpperCase())]);
  }
  return createEngine({
    locales: [composeLocale(english, [...EN, datetimeEn])],
    kinds,
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
}

const CALENDAR_PREAMBLE = (extra: string[], names: string[]) => [
  'import { composeLocale, createEngine } from "@smartput/core";',
  'import { english } from "@smartput/core/locale/en";',
  'import { BUILTIN_KINDS } from "@smartput/kinds";',
  'import BUILTIN_EN from "@smartput/kinds/locale/en";',
  'import { datetime } from "@smartput/datetime";',
  'import datetimeEn from "@smartput/datetime/locale/en";',
  ...extra.map((p, i) => `import { ${names[i]} } from "@smartput/${p}";`),
  "",
  "const engine = createEngine({",
  "  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn])],",
  `  kinds: [...BUILTIN_KINDS, datetime, ${names.join(", ")}],`,
  '  timeZone: "Europe/Kyiv",',
  "});",
];

/**
 * The examples that are not a ratio kind. Each is the shortest program that
 * shows what the package is *for* — not a tour of its exports.
 */
const EXAMPLES: Record<string, () => Promise<Example>> = {
  core: async () => ({
    imports: ENGINE_PREAMBLE,
    lines: [
      'engine.evaluate("1 kg + 500 g").formatted',
      'engine.evaluate("2 km in m").formatted',
      'engine.evaluate("20% of 250").formatted',
      'engine.evaluate("1 kg + 500 g").confidence',
      'engine.complete("12 k").length',
      'engine.explain("10 m + 5 min").candidates.length',
    ],
    scope: async () => ({ engine: await builtinEngine() }),
    note: `\`evaluate\` returns a \`Result\` — \`value\`, \`formatted\`, \`kind\`,
\`confidence\`, \`spans\`, \`meta\` — and never throws on unreadable input.
\`explain()\` returns the same run with every stage's intermediate state, which
is what to reach for when a reading is not the one you expected.`,
  }),

  shared: async () => ({
    imports: [
      'import { parse, convert, format, createValueClass } from "@smartput/shared";',
      'import { MASS_UNITS } from "@smartput/mass/units";',
    ],
    lines: [
      'parse(MASS_UNITS, "500 g")',
      'convert(MASS_UNITS, "1 kg", "g")',
      'format(MASS_UNITS, parse(MASS_UNITS, "500 g"))',
      'String(createValueClass(MASS_UNITS, "mass").parse("1 kg"))',
    ],
    scope: async () => ({
      ...(await src("shared", "index.ts")),
      ...(await src("mass", "units.ts")),
    }),
    note: `Zero dependencies, and not "none for now" — every ratio kind's
\`/validate\` and \`/class\` subpath is this package plus that kind's table, so
adding a kind adds a table and not another copy of the algebra.`,
  }),

  kind: async () => ({
    imports: [
      'import { decimalRatios, defineKind, defineVocabulary } from "@smartput/kind";',
      'import { LENGTH_UNITS } from "@smartput/length/units";',
    ],
    lines: [
      'Object.keys(decimalRatios(LENGTH_UNITS)).join(", ")',
      'defineKind({ id: "length", value: { mode: "ratio", canonical: "m", ratios: decimalRatios(LENGTH_UNITS) } }).id',
      'defineVocabulary({ kind: "length", units: { m: { one: "metre", other: "metres" } } }).kind',
      'Object.isFrozen(defineVocabulary({ kind: "length", units: {} }))',
    ],
    scope: async () => ({
      ...(await src("kind", "index.ts")),
      ...(await src("length", "units.ts")),
    }),
    note: `No engine anywhere in this block, which is the point: a kind and its
words are data, and defining them should not link a parser. \`defineKind\` and
\`defineVocabulary\` both deep-freeze what they return, so a descriptor cannot
be edited after an engine has read it.`,
  }),

  kinds: async () => ({
    imports: [
      'import { BUILTIN_KINDS, mass, length } from "@smartput/kinds";',
      'import { parseMass, parseLength } from "@smartput/kinds/validate";',
      'import { Mass } from "@smartput/kinds/class";',
    ],
    lines: [
      "BUILTIN_KINDS.length",
      'BUILTIN_KINDS.map((k) => k.id).join(", ")',
      'parseMass("2 kg")',
      'String(Mass.parse("2 kg"))',
    ],
    scope: async () => ({
      ...(await src("kinds", "index.ts")),
      ...(await src("kinds", "validate.ts")),
      ...(await src("kinds", "class.ts")),
    }),
    note: `\`measure\` is exported but deliberately **not** in \`BUILTIN_KINDS\`:
its \`mm\` and \`cm\` collide with \`length\`, so registering it is a decision
rather than a default.`,
  }),

  boolean: async () => ({
    imports: ENGINE_PREAMBLE,
    lines: [
      'engine.evaluate("1 kg > 900 g").formatted',
      'engine.evaluate("30 min < 1 h").formatted',
      'engine.evaluate("5 km != 5000 m").formatted',
      'engine.evaluate("1000 mb = 1 gb").formatted',
    ],
    scope: async () => ({ engine: await builtinEngine() }),
    note: `A comparison is a kind, so it ranks and formats like any other
reading. The last row is the interesting one: \`mb\` and \`gb\` are decimal, so
the answer is what the units say rather than what a binary intuition expects.`,
  }),

  number: async () => ({
    imports: [
      'import { numberFromWords, spellNumber } from "@smartput/number";',
      'import { parseNumber } from "@smartput/number/validate";',
    ],
    lines: [
      'numberFromWords(["one", "hundred", "and", "five"])',
      "spellNumber(105)",
      'parseNumber("1,500")',
      'engine.evaluate("(1 + 2) * 3").formatted',
      'engine.evaluate("twenty two + 5").formatted',
    ],
    scope: async () => ({
      ...(await src("number", "index.ts")),
      ...(await src("number", "validate.ts")),
      engine: await builtinEngine(),
    }),
    note: `\`numberFromWords\` takes the words already split, and reports how many
it \`consumed\` — it is a reader inside a larger sentence, not a whole-string
parser. \`spellNumber\` is its inverse over the same table.`,
  }),

  holiday: async () => ({
    imports: ['import { findHoliday, holidaysFor } from "@smartput/holiday";'],
    lines: [
      'findHoliday("christmas")?.[0]?.name',
      'holidaysFor(2026, "US").length',
      'holidaysFor(2026, "US")[0]?.name',
    ],
    scope: async () => src("holiday", "index.ts"),
    note: `No \`@smartput\` dependency at all — it knows nothing about kinds,
values or the engine, which is what lets \`@smartput/datetime\` reach it from a
subpath instead of from its root.`,
  }),

  datetime: async () => ({
    imports: CALENDAR_PREAMBLE([], []),
    lines: [
      'engine.evaluate("2026-01-15 14:00").formatted',
      'engine.evaluate("2026-01-15 14:00 in tokyo").formatted',
      'engine.evaluate("2026-01-15 14:00 + 3 h").formatted',
    ],
    scope: async () => ({ engine: await calendarEngine([]) }),
    note: `Months and years are calendar arithmetic, not durations — that is why
they are here and not in [\`@smartput/duration\`](../duration/README.md), whose
week is exactly 604800 seconds.`,
  }),

  date: async () => ({
    imports: CALENDAR_PREAMBLE(["date"], ["date"]),
    lines: [
      'engine.evaluate("today").formatted',
      'engine.evaluate("next friday").formatted',
      'engine.evaluate("3 days ago").formatted',
    ],
    scope: async () => ({ engine: await calendarEngine(["date"]) }),
  }),

  time: async () => ({
    imports: CALENDAR_PREAMBLE(["time"], ["time"]),
    lines: [
      'engine.evaluate("3pm").formatted',
      'engine.evaluate("09:30").formatted',
      'engine.evaluate("noon").formatted',
    ],
    scope: async () => ({ engine: await calendarEngine(["time"]) }),
  }),

  "range-core": async () => ({
    imports: [
      'import { startOfWeek, endOfWeek, endOfMonth } from "@smartput/range-core";',
      'import { Temporal } from "@smartput/datetime";',
    ],
    preamble: [
      'const now = Temporal.ZonedDateTime.from("2026-01-15T09:30[Europe/Kyiv]");',
    ],
    lines: [
      "startOfWeek(now).toString()",
      "startOfWeek(now, { weekStart: 7 }).toString()",
      "endOfWeek(now).toString()",
      "endOfMonth(now).toString()",
    ],
    scope: async () => {
      const { Temporal } = await src("datetime", "index.ts");
      return {
        ...(await src("range-core", "index.ts")),
        now: Temporal.ZonedDateTime.from("2026-01-15T09:30[Europe/Kyiv]"),
      };
    },
    note: `The window arithmetic every range kind shares, with no kind of its own.
\`DEFAULT_WEEK_START\` is Monday; \`createDateRange({ weekStart: 7 })\` is how a
Sunday-first calendar says so.`,
  }),

  "date-range": async () => ({
    imports: CALENDAR_PREAMBLE(["date", "date-range"], ["date", "dateRange"]),
    lines: [
      'engine.evaluate("whole week").formatted',
      'engine.evaluate("today to friday").formatted',
      'engine.evaluate("next month").formatted',
      'engine.evaluate("whole week + 1 wk").formatted',
    ],
    scope: async () => ({ engine: await calendarEngine(["date", "date-range"]) }),
  }),

  "time-range": async () => ({
    imports: CALENDAR_PREAMBLE(["time", "time-range"], ["time", "timeRange"]),
    lines: [
      'engine.evaluate("10:00 - 20:00").formatted',
      'engine.evaluate("9am to 5pm").formatted',
    ],
    scope: async () => ({ engine: await calendarEngine(["time", "time-range"]) }),
  }),

  "datetime-range": async () => ({
    imports: CALENDAR_PREAMBLE(
      ["date", "time", "datetime-range"],
      ["date", "time", "datetimeRange"],
    ),
    lines: [
      'engine.evaluate("yesterday morning").formatted',
      'engine.evaluate("tomorrow night").formatted',
      'engine.evaluate("from today until friday").formatted',
    ],
    scope: async () => ({
      engine: await calendarEngine(["date", "time", "datetime-range"]),
    }),
  }),

  range: async () => ({
    imports: ['import { sliceItems, parseSlice } from "@smartput/range";'],
    lines: [
      'JSON.stringify(parseSlice("2-4"))',
      'sliceItems(["a", "b", "c", "d", "e"], "2-4").join(",")',
      'sliceItems(["a", "b", "c", "d", "e"], "last 2").join(",")',
    ],
    scope: async () => src("range", "index.ts"),
    note: `Selection over a list — the "3, 5-7, last 2" a user types into a print
dialog. One-based by default, because that is what the user counted;
\`ZeroIndexError\` is what an index of 0 gets rather than a silent off-by-one.`,
  }),

  rate: async () => ({
    imports: [
      'import { money, snapshot, ecb } from "@smartput/rate";',
      'import { parseAmount, symbolOf } from "@smartput/currency";',
    ],
    lines: ['JSON.stringify(parseAmount("$12.50"))', 'symbolOf("uah")', "money.id"],
    scope: async () => ({
      ...(await src("rate", "index.ts")),
      ...(await src("currency", "index.ts")),
    }),
    note: `\`money\` is a kind whose ratios are read from a rate snapshot rather
than fixed, so \`createLiveEngine\` is what turns "100 usd in eur" into an
answer. \`ecb\` is the European Central Bank daily reference feed;
\`snapshot\` is the offline shape it fills. Nothing here calls the network until
you hand it a provider.`,
  }),

  query: async () => ({
    imports: [
      ...ENGINE_IMPORTS,
      'import { defineSchema, QueryEngine } from "@smartput/query";',
      'import { SqlCompiler } from "@smartput/query/sql";',
    ],
    preamble: [
      ...ENGINE_SETUP,
      "",
      "const schema = defineSchema({",
      "  tables: [",
      "    {",
      '      name: "orders",',
      '      key: "id",',
      "      columns: [",
      '        { name: "id" },',
      '        { name: "weight", kind: "mass" },',
      '        { name: "total", kind: "number" },',
      "      ],",
      "    },",
      "  ],",
      "});",
      "",
      "const query = new QueryEngine({ schema, engine });",
      "const sql = new SqlCompiler();",
    ],
    lines: [
      'query.compile("orders heavier than 2 kg", sql).text',
      'query.compile("orders heavier than 2 kg", sql).params.join()',
      'query.compile("orders with total over 100", sql).text',
    ],
    scope: async () => {
      const mod = await src("query", "index.ts");
      const { SqlCompiler } = await src("query", "sql.ts");
      const schema = mod.defineSchema({
        tables: [
          {
            name: "orders",
            key: "id",
            columns: [
              { name: "id" },
              { name: "weight", kind: "mass" },
              { name: "total", kind: "number" },
            ],
          },
        ],
      });
      return {
        query: new mod.QueryEngine({ schema, engine: await builtinEngine() }),
        sql: new SqlCompiler(),
      };
    },
    note: `A column declares the *kind* it holds, so "heavier than 2 kg" reaches
the same mass parser everything else in this repo uses, and the quantity leaves
as a bound parameter rather than as string-interpolated SQL. The dialect is a
subpath — \`/sql\` and \`/mongo\` — so the grammar is shared and only the
rendering is not.`,
  }),
};

/** Values as a reader would want to see them, not as `JSON.stringify` sees them. */
function render(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return String(value);
  const json = JSON.stringify(value);
  if (json === undefined) return String(value);
  return json.length > 78 ? `${json.slice(0, 75)}…` : json;
}

/** Runs one expression against the example's scope. A throw fails the build. */
function evaluateLine(code: string, scope: Record<string, unknown>): unknown {
  const names = Object.keys(scope);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  return fn(...names.map((n) => scope[n]));
}

async function exampleBlock(pkg: string, example: Example): Promise<string> {
  const scope = await example.scope();
  const width = Math.max(
    ...example.lines.filter((l) => !l.startsWith("//")).map((l) => l.length),
  );
  const body: string[] = [...example.imports, ""];
  if (example.preamble) body.push(...example.preamble, "");

  for (const line of example.lines) {
    // A comment line is a section break inside the block — shown, never run.
    if (line.startsWith("//")) {
      body.push("", line);
      continue;
    }
    let value: unknown;
    try {
      value = evaluateLine(line, scope);
      if (value instanceof Promise) value = await value;
    } catch (error) {
      throw new Error(`${pkg}: example line failed — ${line}\n  ${String(error)}`);
    }
    body.push(`${line.padEnd(width)}  // ${render(value)}`);
  }

  const note = example.note === undefined ? "" : `\n${example.note}\n`;
  return ["```ts", ...body, "```", note].join("\n");
}

/**
 * The docs site's absolute links, rewritten for a file read on GitHub or npm.
 * A `/packages/mass` link is a 404 in a README and a working page in VitePress,
 * so the same prose has to say it two ways.
 */
function relink(markdown: string, pkg: string): string {
  return markdown
    .replace(/\]\(\/packages\/([a-z-]+)\)/g, (_, target: string) =>
      target === pkg ? "](./README.md)" : `](../${target}/README.md)`,
    )
    .replace(/\]\(\/(guide|api)\/([a-z-]+)(#[a-z-]+)?\)/g, "](../../docs/$1/$2.md)");
}

/**
 * The one line a reader needs about an optional peer: what installs it, and
 * what does not. It sits beside the dependency list rather than inside it —
 * a README showing `@smartput/length` depending on `@smartput/shared` alone
 * would be true about `npm add` and a lie about `import { length }`.
 */
function peerLine(pkg: string, peer: string): string {
  const name = peer.slice("@smartput/".length);
  return `- [\`${peer}\`](../${name}/README.md) — needed only by \`@smartput/${pkg}\` and its \`/locale/*\` entries, and \`npm add\` does not fetch it. Anyone reaching those has written \`createEngine\` and installed it already; the \`/validate\`, \`/units\` and \`/class\` entries never touch it.`;
}

async function readme(pkg: string, meta: PageMeta): Promise<string> {
  const manifest = await Bun.file(`${rootDir}/packages/${pkg}/package.json`).json();
  const subpaths = Object.keys(manifest.exports ?? { ".": {} });
  const deps = Object.keys(manifest.dependencies ?? {});
  const peers = Object.keys(manifest.peerDependencies ?? {});

  const entryRows = subpaths
    .map((subpath) => {
      const spec =
        subpath === "." ? `@smartput/${pkg}` : `@smartput/${pkg}${subpath.slice(1)}`;
      const what =
        meta.subpaths?.[subpath] ??
        DEFAULT_SUBPATHS[subpath] ??
        "See the source for what this subpath carries.";
      return `| \`${spec}\` | ${cell(what)} |`;
    })
    .join("\n");

  // The locale subpaths are 17 near-identical rows in a 20-row table, which
  // buries the three rows a reader came for. One row stands for all of them.
  const localeRows = subpaths.filter((s) => s.startsWith("./locale/"));
  const trimmedRows =
    localeRows.length <= 2
      ? entryRows
      : entryRows
          .split("\n")
          .filter((row) => !/`@smartput\/[a-z-]+\/locale\//.test(row))
          .concat(
            `| \`@smartput/${pkg}/locale/<id>\` | One language's words for this kind. ${localeRows.length} ship: ${localeRows
              .map((s) => `\`${s.slice("./locale/".length)}\``)
              .join(", ")}. |`,
          )
          .join("\n");

  const budgets = budgetsFor(pkg);
  const sizeSection =
    budgets.length === 0
      ? ""
      : `## What it costs\n\nCeilings, not measurements. \`bun run check-size\` bundles each entry with
\`bun build --minify\` and fails if a row crosses its ceiling **or drops more
than 30 % below it** — a budget that is only an upper bound reports a vanished
graph as a triumph.\n\n| Import | Minified | Gzipped |\n| --- | --- | --- |\n${budgets
          .map((row) => `| ${row.label} | ≤ ${bytes(row.min)} | ≤ ${bytes(row.gzip)} |`)
          .join("\n")}`;

  const peerSection =
    peers.length === 0
      ? ""
      : `\n\n### Optional peers\n\n${peers.map((peer) => peerLine(pkg, peer)).join("\n")}`;

  const depSection =
    deps.length === 0 && peers.length === 0
      ? `## Dependencies\n\nNone. Not "none for now" — this package is depended on by others precisely
because it has none.`
      : `## Dependencies\n\n${
          deps.length === 0
            ? "None that `npm add` fetches."
            : deps
                .map((dep) =>
                  dep.startsWith("@smartput/")
                    ? `- [\`${dep}\`](../${dep.slice("@smartput/".length)}/README.md)`
                    : `- \`${dep}\``,
                )
                .join("\n")
        }${peerSection}`;

  const exported = await runtimeExports(pkg);
  const exportSection =
    exported.length === 0
      ? ""
      : `## Runtime exports\n\nType-only exports are erased and do not appear here.\n\n${exported
          .map((name) => `\`${name}\``)
          .join(" · ")}`;

  const build = EXAMPLES[pkg] ?? (() => ratioExample(pkg));
  const example = await exampleBlock(pkg, await build());

  return [
    `# @smartput/${pkg}`,
    `> ${meta.summary}`,
    relink(meta.body, pkg),
    "## Setup",
    `\`\`\`sh\nnpm add @smartput/${pkg}\n\`\`\``,
    "## Example",
    example.trimEnd(),
    `## Entry points\n\n| Import | Contents |\n| --- | --- |\n${trimmedRows}`,
    relink(await unitTablesFor(pkg, subpaths), pkg),
    exportSection,
    depSection,
    sizeSection,
    relink(meta.after ?? "", pkg),
    `---\n\nGenerated by \`scripts/gen-readmes.ts\` — run \`bun run docs:readmes\`. Every
output above was produced by running the line beside it. The full page, with
live demos, is [\`docs/packages/${pkg}.md\`](../../docs/packages/${pkg}.md).`,
  ]
    .filter((part) => part !== "")
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .concat("\n");
}

const dirs = await packageDirs();

const missingHandwritten = [...HANDWRITTEN].filter((name) => !dirs.includes(name));
if (missingHandwritten.length > 0) {
  console.error(
    `gen-readmes: HANDWRITTEN names a package that is gone — ${missingHandwritten.join(", ")}`,
  );
  process.exit(1);
}

let written = 0;
for (const name of dirs) {
  if (HANDWRITTEN.has(name)) continue;
  const meta = META[name];
  if (meta === undefined) {
    console.error(`gen-readmes: no metadata for ${name}`);
    process.exit(1);
  }
  await writeFile(`${rootDir}/packages/${name}/README.md`, await readme(name, meta));
  written += 1;
}

console.log(
  `gen-readmes: wrote ${written} READMEs, skipped ${HANDWRITTEN.size} hand-written`,
);
