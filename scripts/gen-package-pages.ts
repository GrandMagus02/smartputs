import { mkdir, readdir, writeFile } from "node:fs/promises";
import type { UnitTable } from "@smartput/shared";
import { BUDGETS, type EntrySpec } from "./check-size";

/**
 * Writes one docs page per workspace package.
 *
 * The prose is here; every table is read from the source it describes — the
 * manifest's `exports`, the kind's `UnitTable`, the rows of `check-size.ts`.
 * That split is the whole point: a hand-written entry-point table drifts the
 * first time a subpath is added, and a hand-written unit table drifts the first
 * time a unit is. Run `bun run docs:packages` after either.
 */

export const rootDir = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const outDir = `${rootDir}/docs/packages`;

export interface PageMeta {
  /** One line. Used as the page description and the index row. */
  summary: string;
  /** The section under which the index lists it. */
  group: string;
  /** Markdown between the title and the generated tables. */
  body: string;
  /** Markdown appended after the generated tables. */
  after?: string;
  /** Extra `<Subpath, description>` rows for subpaths the defaults miss. */
  subpaths?: Record<string, string>;
  /** Related pages, as `[text, link]`. */
  see?: [string, string][];
}

const RATIO_DOORS = `Three doors, one table. The kind descriptor is for the
engine, \`/validate\` is free functions over JS numbers, \`/class\` is an
immutable value class — and all three read the same \`UnitTable\`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).`;

/**
 * A ratio kind's page: the sentence at the top differs, everything else is the
 * same three demos over that kind's own table — the free-function parse, the
 * combobox over its aliases, and the engine reading an expression in it.
 */
const ratio = (group: string, summary: string, lead: string): PageMeta => ({
  summary,
  group,
  body: `${lead}\n\n${RATIO_DOORS}`,
  see: [
    ["Kinds and units", "/guide/kinds"],
    ["The micro path", "/packages/shared"],
    ["Inputs and error messages", "/guide/inputs"],
  ],
});

export const META: Record<string, PageMeta> = {
  core: {
    group: "Engine",
    summary: "The engine: normalize, tokenize, parse, solve, eval, print.",
    body: `Everything that turns text into a \`Result\`, and nothing that knows
what a metre is. \`createEngine()\` composes locales and kinds into the six-stage
pipeline; \`defineKind()\` and \`defineLocale()\` are how anything gets into it.

One runtime dependency, \`decimal.js\`, and that is a deliberate ceiling —
\`check-deps.ts\` fails the build if a second one appears. Every stage is also
its own subpath, so a consumer that wants only the tokenizer pays for only the
tokenizer.`,
    subpaths: {
      "./testing": "`assertKindContract` — the contract every kind must satisfy.",
      "./normalize": "Stage 1: case, spacing, digits, punctuation.",
      "./tokenize": "Stage 2: text to `Token[]`.",
      "./parse": "Stage 3: tokens to candidate readings.",
      "./solve": "Stage 4: ranking, ambiguity, weights.",
      "./eval": "Stage 5: the arithmetic, in `Decimal`.",
      "./print": "Stage 6: `formatValue` and the locale number grammar.",
      "./registry": "The kind/locale registry the stages read.",
    },
    see: [
      ["The pipeline", "/guide/pipeline"],
      ["createEngine", "/api/create-engine"],
      ["Engine", "/api/engine"],
    ],
  },
  shared: {
    group: "Engine",
    summary: "The micro path: one parser, one algebra, one value-class factory.",
    body: `No kind, no engine, no dependency at all. Every ratio kind's
\`/validate\` and \`/class\` subpaths are this package plus that kind's table,
which is why \`@smartput/length/validate\` measures ~1.5 KB rather than ~1.5 KB
*per kind*.

It deliberately does not depend on \`@smartput/core\`: importing core would pull
\`decimal.js\` into a budget the whole design exists to protect.
\`ValidationError\` is not a subclass of \`SmartputError\` for the same reason —
same \`name\`/\`code\`/\`input\` shape, no dependency.`,
    see: [
      ["Inputs and error messages", "/guide/inputs"],
      ["Value classes", "/api/value-classes"],
      ["The `/validate` API", "/api/validate"],
    ],
  },
  smartputs: {
    group: "Engine",
    summary: "The unscoped install name. Everything `@smartput/core` is, under one word.",
    body: `\`\`\`sh
bun i smartputs
\`\`\`

Every subpath, every export and every object identity of
[\`@smartput/core\`](/packages/core), re-exported under the name someone types
when they have heard of this project and not of its package layout.
\`smartputs/locale/en\` is \`@smartput/core/locale/en\`; \`smartputs/solve\` is
\`@smartput/core/solve\`. There is nothing else in it, and \`parity.test.ts\`
asserts that subpath by subpath rather than trusting the generator that wrote
the re-exports.

**Read this part before installing.** This is the engine, and an engine with no
kinds registered cannot read anything — it fails loudly rather than quietly:

\`\`\`ts
import { composeLocale, createEngine } from "smartputs";
import { english } from "smartputs/locale/en";

createEngine({ locales: [], kinds: [] });
// Error: createEngine requires at least one locale

createEngine({ locales: [composeLocale(english, [])], kinds: [] })
  .evaluate("2 km in m");
// NoCandidateError: Unknown unit "km"
\`\`\`

Which kinds to register is the one decision nobody can make for you, so this
package does not make it. Add the kinds you want beside it —
[\`@smartput/length\`](/packages/length) alone, or
[\`@smartput/kinds\`](/packages/kinds) for all seventeen — and compose a locale:

\`\`\`sh
bun i smartputs @smartput/kinds
\`\`\`

If you only want to read one kind out of a form field, you want none of this:
[\`@smartput/length/validate\`](/packages/length) is 1.5 KB and has no engine in
it at all.`,
    see: [
      ["@smartput/core", "/packages/core"],
      ["The pipeline", "/guide/pipeline"],
      ["createEngine", "/api/create-engine"],
    ],
  },
  kind: {
    group: "Engine",
    summary: "The layer a kind and a language are written in, with no engine in it.",
    body: `\`defineKind\`, \`defineVocabulary\`, \`decimalRatios\`,
\`aliasesFor\`, \`deriveValue\`, the \`Decimal\` every ratio is carried in, the
\`SmartputError\` hierarchy, and the types all of it is spelled with.

It was \`@smartput/core\`'s until the edge was found running the wrong way:
seventeen leaf packages named the engine in order to say what a kilometre is,
which is a fact about metres and has nothing to do with parsing a sentence —
and core named four of them back as devDependencies, closing the loop. The
split is by **layer**: core is the pipeline (normalize, tokenize, parse, solve,
eval, print), and this is what the pipeline agrees with a kind about before it
runs.

Core re-exports every name here unchanged, so nothing that imported them from
\`@smartput/core\` had to stop. Writing a new kind, though, should name this
package and not the engine — that is the whole point of it existing.

It did **not** make anything smaller. A kind package's bundle barely moved,
because what it was carrying was \`decimal.js\` and never the pipeline; the
change bought layering, and \`scripts/check-size.ts\` records the 240 B per
core-consuming bundle that it cost.`,
    see: [
      ["Defining a kind", "/guide/kinds"],
      ["Vocabularies and languages", "/guide/languages"],
    ],
  },
  kinds: {
    group: "Engine",
    summary: "Every built-in kind, its vocabulary, and the two barrels over them.",
    body: `\`BUILTIN_KINDS\` is the list \`createEngine()\` is normally handed;
the individual descriptors are exported by name beside it. \`measure\` is
exported but **not** in \`BUILTIN_KINDS\` — its \`mm\` and \`cm\` collide with
\`length\`, so registering it is a decision, not a default.

The \`/validate\` and \`/class\` barrels re-export every kind's subpath. They are
a convenience, not the byte-safe door: they shake to one kind under esbuild,
Rollup and modern webpack, and to all seventeen under a bundler that does not
follow re-exports. Two rows in \`check-size.ts\` exist to catch the day that
stops being true.`,
    subpaths: {
      "./validate":
        "Every kind's free functions in one import — see the shake note above.",
      "./class": "Every kind's value class in one import.",
    },
    see: [["Kinds and units", "/guide/kinds"]],
  },

  length: ratio(
    "Kinds",
    "Millimetre to mile, exact in decimal.",
    `Eight units and thirty-two aliases. Every ratio is exact in decimal —
the imperial ones by definition of the international yard and pound agreement —
so no conversion in this table rounds.`,
  ),
  mass: ratio(
    "Kinds",
    "Milligram to ton, with the imperial pounds and ounces.",
    "Metric and avoirdupois in one table, canonical in grams.",
  ),
  duration: ratio(
    "Kinds",
    "Nanosecond to week, canonical in seconds.",
    `Calendar-free: a week is exactly 604800 seconds here. Months and years are
not units of duration, because they are not constant lengths — those live in
[\`@smartput/datetime\`](/packages/datetime), which has a calendar.`,
  ),
  angle: ratio(
    "Kinds",
    "Degree, radian, gradian, turn — with a 30-digit π.",
    `The ratios are decimal **strings**, not floats, which is what lets radians
carry a thirty-digit π through the engine without drift. The micro path does
\`Number(r)\` and accepts the float; the engine does \`new Decimal(r)\` and does
not.`,
  ),
  area: ratio("Kinds", "Square metres, hectares, acres.", "Canonical in square metres."),
  volume: ratio(
    "Kinds",
    "Litres, millilitres, cubic metres, and the two gallons.",
    "Canonical in litres. US and imperial gallons are separate units, never aliases.",
  ),
  speed: ratio(
    "Kinds",
    "m/s, km/h, mph, knots.",
    `Canonical in metres per second. The knot ratio is the full 28-digit value:
\`0.514444\` was the true number truncated, and a wrong constant is not a
smaller one.`,
  ),
  temperature: ratio(
    "Kinds",
    "Celsius, Fahrenheit, Kelvin — plus the delta kind beside them.",
    `Two kinds in one package. \`temperature\` is affine — \`canonical = (value +
offset) * ratio\` — and \`tempdelta\` is the same ratios with the offsets
dropped, because "a difference of 5 °C" and "5 °C" are not the same quantity and
adding them as if they were is the classic bug this split exists to make
impossible.`,
  ),
  datasize: ratio(
    "Kinds",
    "Bytes and bits, decimal and binary prefixes.",
    `Canonical in bits. \`kB\` and \`KiB\` are different units, not spellings of
one — see [Comparison](/packages/boolean) for what that does to \`1000 mb = 1
gb\`.`,
  ),
  datarate: ratio(
    "Kinds",
    "bit/s to Gbit/s, bridging data size and duration.",
    `Canonical in bits per second. \`datasize\`'s canonical is the byte and this
one's is the bit, so every bridge between them carries the factor of eight
explicitly rather than hiding it in a ratio.`,
  ),
  energy: ratio(
    "Kinds",
    "Joule, calorie, watt-hour, electronvolt.",
    "Canonical in joules.",
  ),
  power: ratio(
    "Kinds",
    "Watt to horsepower, bridging energy and duration.",
    "Canonical in watts.",
  ),
  tempo: ratio(
    "Kinds",
    "Beats per minute, and its bridge to duration.",
    "Canonical in beats per minute — two units, the second-smallest table in the repo.",
  ),
  number: ratio(
    "Kinds",
    "The unitless kind, and the one that accepts a bare number.",
    `One unit, \`one\`, and the only kind whose \`/validate\` carries a mode of
its own: \`native\` lets \`parseNumber("30")\` succeed where every other kind
returns \`missing-unit\`. That branch lives here rather than in the shared parser
precisely so that only this package's size row pays for it.`,
  ),
  percent: ratio(
    "Kinds",
    "One unit, ratio 0.01.",
    `\`"20%"\` is \`0.2\` canonically, which is what lets it behave like a number
in arithmetic with no special case anywhere. The smallest table in the repo, so
its size row is the earliest warning of growth in the shared parser.`,
  ),
  measure: ratio(
    "Kinds",
    "Typographic units: point, pica, em, pixel.",
    `Not in \`BUILTIN_KINDS\`: its \`mm\` and \`cm\` mean the same lengths but
belong to a different kind, and registering both makes every \`12 cm\`
ambiguous. \`px\` is the one ratio in the repo that is a function rather than a
constant — it reads \`dpi\` off the parse context.`,
  ),
  boolean: {
    group: "Kinds",
    summary: "The kind comparisons land in.",
    body: `\`1 kg > 900 g\` has to evaluate to something. This is that
something: a two-valued opaque kind, plus \`truthOf()\` and a \`Bool\` class, so
a comparison result is a value like any other rather than a JavaScript boolean
smuggled out of the engine.`,
    see: [["Comparison", "/packages/boolean"]],
  },

  currency: {
    group: "Money",
    summary: "Currency recognition and formatting, with no rate table.",
    body: `The half of money that a rate cannot change: which word names which
ISO code, how many minor units it has, what symbol it prints with.
\`parseAmount("30 usd")\` needs no engine and no rates.

The \`/validate\` subpath keeps \`Decimal\` out of its graph on purpose — one
re-export of \`formatAmount\` from it took that entry from 2.6 KB to 35 KB,
because core configures \`Decimal\`'s precision in a module-load side effect a
bundler may not drop.`,
    see: [
      ["Money and rates", "/packages/rate"],
      ["@smartput/currency API", "/api/currency"],
    ],
  },
  rate: {
    group: "Money",
    summary: "The money kind, rate snapshots, and the live-rate facade.",
    body: `Money is not in \`BUILTIN_KINDS\` and never will be: it needs an
injected rate table, so it ships here and the caller registers it. \`snapshot()\`
builds a dated immutable table; \`ecb()\` and \`custom()\` are providers;
\`createLiveEngine()\` wraps fetch, cache, TTL and one shared in-flight request.

A rate without an \`asOf\` is a number pretending to be a fact, so every
snapshot carries one.`,
    see: [
      ["Money and rates", "/packages/rate"],
      ["@smartput/rate API", "/api/rate"],
    ],
  },

  datetime: {
    group: "Dates and time",
    summary: "The datetime kind: chrono in front, Temporal underneath.",
    body: `\`chrono-node\` reads the phrase, \`temporal-polyfill\` holds the
instant, and the kind is the bridge. \`3pm in tokyo\` works because a place value
carries a \`meta.zone\` this kind reads — neither package knows the other exists.

Holidays are behind the \`./holiday\` subpath and not the root, because
\`date-holidays\` is ~1.5 MB bundled. The \`datetime root (no holiday data)\` row
in \`check-size.ts\` fails by a megabyte the moment that import reaches the root
graph, which is the enforcement a doc comment could not be.`,
    subpaths: {
      "./holiday": "`datetimeWithHolidays` — opt in, and pay ~288 KB gzipped for it.",
    },
    see: [["Dates and time zones", "/packages/datetime"]],
  },
  timezone: {
    group: "Dates and time",
    summary: "Zone tables and the written-offset parser. No dependencies.",
    body: `Eighteen named zones, every quarter hour from −12:00 to +14:00, and a
parser for \`GMT+3\` / \`utc-05:30\`. Zero runtime dependencies, deliberately: a
form field offering a zone picker should not install chrono and Temporal to get
a list of zone names.`,
    see: [["Dates and time zones", "/packages/datetime"]],
  },
  holiday: {
    group: "Dates and time",
    summary: "Which holiday a phrase names, and when it falls.",
    body: `A tokenising scorer over the \`date-holidays\` rule table, and nothing
else — no kinds, no values, no \`Decimal\`, no engine. That isolation is what
lets \`@smartput/datetime\` reach it from a subpath instead of its root.

It is a package rather than a file because of its weight: ~1.5 MB bundled, six
times the T0 gazetteer. As a plain dependency of \`datetime\` it would charge
every consumer of \`today + 3 d\` a megabyte for a feature they did not ask
for.`,
    see: [["Dates and time zones", "/packages/datetime"]],
  },
  date: {
    group: "Dates and time",
    summary: "A calendar day, with no time inside it.",
    body: `\`datetime\` truncated to a day and given its own kind id, so
\`tomorrow\` is a date and \`tomorrow at 3pm\` is a datetime, and the two do not
silently unify.`,
    see: [["Dates and time zones", "/packages/datetime"]],
  },
  time: {
    group: "Dates and time",
    summary: "A clock time, with no date attached.",
    body: `Nanoseconds since midnight, wrapped as a kind. The counterpart to
[\`@smartput/date\`](/packages/date): together they are what
[\`@smartput/datetime\`](/packages/datetime) splits into.`,
    see: [["Dates and time zones", "/packages/datetime"]],
  },

  "range-core": {
    group: "Ranges",
    summary: "Endpoints, ordering, windows — the machinery every range kind shares.",
    body: `\`wrapRange\`/\`unwrapRange\`, \`assertOrdered\` and
\`InvertedRangeError\`, plus \`WINDOWS\` — the named spans (\`this week\`, \`last
month\`) every range kind resolves against. No range kind of its own.`,
    see: [["Ranges", "/packages/range-core"]],
  },
  range: {
    group: "Ranges",
    summary: "Numeric and measured ranges: `10–20 km`.",
    body: "`RANGE_KINDS` registers a range over every ratio kind, and `Range` is the class door onto one.",
    see: [
      ["Ranges", "/packages/range-core"],
      ["Selections", "/packages/range"],
    ],
  },
  "date-range": {
    group: "Ranges",
    summary: "`last week`, `March 3–7`, `between May and June`.",
    body: "Date endpoints plus the phrase table that resolves a named span to two of them.",
    see: [["Ranges", "/packages/range-core"]],
  },
  "time-range": {
    group: "Ranges",
    summary: "`9am–5pm`, with no date on either end.",
    body: "The clock-time range, over `@smartput/time`'s endpoints.",
    see: [["Ranges", "/packages/range-core"]],
  },
  "datetime-range": {
    group: "Ranges",
    summary: "Full instants at both ends, holidays optional.",
    body: `The widest of the four. Its \`./holiday\` subpath carries the same
opt-in cost as \`datetime\`'s, for the same reason and behind the same size
row.`,
    see: [["Ranges", "/packages/range-core"]],
  },

  distance: {
    group: "Places",
    summary: "Great-circle distance between two places.",
    body: `The op, not the gazetteer: \`PlaceDistance\` reads coordinates off two
place values and returns a length. It knows nothing about where those values
came from, which is why it survived the fold below unchanged.`,
    see: [["@smartput/geo", "/packages/geo"]],
  },
  geo: {
    group: "Places",
    summary: "Places, whole: the kind, postal codes, and the GeoNames providers.",
    body: `\`@smartput/country\`, \`@smartput/city\` and \`@smartput/zip\` were
three packages and are now this one. What they had in common was a committed
table — 252 countries, 6 247 cities, 178 postal masks — and the argument against
it is that a library release is the wrong unit for a data release: populations
move, names change, borders are redrawn, and a translation of the table is
needed per language. GeoNames already holds every toponym's names in some 250
languages, so the table is a provider now and \`lang\` is the whole of the
internationalization story.

\`Geo\` fronts one or more providers with \`QueryCache\`, \`RateLimiter\` and a
strategy for what to do when one fails. The network is reachable only through
\`@smartput/geo/providers\`; the root is types, ranking and the \`Geo\` that
orchestrates them, so a bundle that imports a \`GeoKind\` links no fetch.`,
    subpaths: {
      "./providers":
        "`geonames()`, `postalCodes()`, `custom()` — the only door that reaches the network.",
    },
    see: [["@smartput/distance", "/packages/distance"]],
  },

  math: {
    group: "Math and queries",
    summary: "LaTeX in, steps out: evaluate, simplify, solve, analyse.",
    body: `\`createMathEngine()\` over \`@cortex-js/compute-engine\`, plus the
step machinery — \`ruleForOperator\`, \`titleForRule\` — and
\`describeOperator()\`, which is what lets a step be read aloud.`,
    see: [
      ["LaTeX math", "/packages/math"],
      ["Equations and matrices", "/packages/math"],
      ["@smartput/math API", "/api/math"],
    ],
  },
  query: {
    group: "Math and queries",
    summary: "A sentence to a database query, in SQL or Mongo.",
    body: `\`QueryEngine\` reads a schema and a phrase; the dialect compilers are
separate subpaths so a Postgres app never bundles the Mongo one. The grammar
knows about ranges, places and units because it reads the same kinds the engine
does.`,
    subpaths: {
      "./sql": "`SqlCompiler` — parameterised SQL, never string-concatenated.",
      "./mongo": "`MongoCompiler` — a filter document.",
    },
    see: [["Querying a database", "/packages/query"]],
  },
};

/**
 * The three demos every ratio kind gets: the free-function parse behind a
 * field, the combobox over that kind's alias table, and the engine reading an
 * expression written in its units.
 */
const ratioDemo = (kind: string, value: string, examples: string[]): string =>
  [
    `<SpValidatedInput kind="${kind}" model-value="${value}" :switchable="false" />`,
    "",
    `<SpUnitCombobox kind="${kind}" model-value="${value}" />`,
    "",
    "<SpEvaluate",
    `  model-value="${examples[0]}"`,
    `  :examples="[${examples.map((e) => `'${e}'`).join(", ")}]" />`,
  ].join("\n");

/**
 * One live demo per package. The generator fails on a package that has no
 * entry here, for the same reason it fails on one with no metadata: a package a
 * reader cannot try is a package they have to take on trust.
 */
export const DEMOS: Record<string, string> = {
  core: [
    '<SpEvaluate model-value="1 kg + 500 g" />',
    "",
    '<SpExplain model-value="10 m + 5 min" />',
  ].join("\n"),
  shared: '<SpValidatedInput kind="length" />',
  // No demo component of its own: what this package does is let *another*
  // package have one. The custom-kind playground is that, run end to end.
  // The same demo core gets: it is the same engine, reached by a shorter name.
  smartputs: [
    '<SpEvaluate model-value="1 kg + 500 g" />',
    "",
    '<SpExplain model-value="10 m + 5 min" />',
  ].join("\n"),
  kind: "<SpCustomKind />",
  kinds: "<SpConvert />",

  length: ratioDemo("length", "12 cm", ["2 km in m", "12 inch", "1 mi + 500 m", "3 ft"]),
  mass: ratioDemo("mass", "500 g", ["1 kg + 500 g", "3 lbs", "2 t in kg", "16 oz"]),
  duration: ratioDemo("duration", "90 min", [
    "30 h - 30 min",
    "1 wk + 2 d",
    "90 min in h",
    "2 h * 3",
  ]),
  angle: ratioDemo("angle", "30 deg", [
    "30 deg in rad",
    "1 turn in deg",
    "90deg + 45deg",
  ]),
  area: ratioDemo("area", "40 m2", ["1 ha in m2", "40 m2 + 5 m2", "2 acre in ha"]),
  volume: ratioDemo("volume", "1.5 l", ["1 m3 in l", "500 ml + 1 l", "2 gal in l"]),
  speed: ratioDemo("speed", "80 kph", ["100 kph in mph", "10 knot in kph", "60 mph"]),
  datasize: ratioDemo("datasize", "256 MB", [
    "1 GB in MB",
    "1 GiB in MiB",
    "700 MB + 300 MB",
  ]),
  datarate: ratioDemo("datarate", "100 mbps", ["1 gbps in mbps", "100 mbps + 50 mbps"]),
  energy: ratioDemo("energy", "2 kWh", [
    "1 kWh in J",
    "2000 cal in kcal",
    "1 kJ + 500 J",
  ]),
  power: ratioDemo("power", "750 W", ["1 hp in W", "2 kW in W", "750 W + 250 W"]),
  tempo: ratioDemo("tempo", "120 bpm", ["120 bpm in hz", "2 hz in bpm"]),
  temperature: ratioDemo("temperature", "21 °C", ["212 F in C", "0 C in K", "21 C in F"]),
  measure: ratioDemo("measure", "12 pt", ["12 pt in mm", "1 pc in pt", "72 pt in inch"]),
  // Not `2^10`: there is no exponent operator, so the demo advertised an input
  // that throws. `gen-readmes.ts` runs every example it prints, which is how a
  // dud that had been sitting in the live demo turned up at all.
  number: ratioDemo("number", "42", ["(1 + 2) * 3", "1,500", "twenty two + 5"]),
  percent: ratioDemo("percent", "20%", ["20% of 250", "15% + 5%", "0.2 in %"]),

  boolean: [
    "<SpEvaluate",
    '  model-value="1 kg > 900 g"',
    "  :examples=\"['1 kg > 900 g', '1000 mb = 1 gb', '30 min < 1 h', '5 km != 5000 m']\" />",
  ].join("\n"),

  currency: "<SpMoney />",
  rate: "<SpMoney />",

  datetime: "<SpDatetime />",
  timezone: "<SpDatetime />",
  date: [
    "<SpRange",
    '  title="date, read through the range engine"',
    '  model-value="today"',
    "  :examples=\"['today', 'tomorrow', 'next friday', '3 days ago']\" />",
  ].join("\n"),
  time: [
    "<SpRange",
    '  title="time, read through the range engine"',
    '  model-value="3pm"',
    "  :examples=\"['3pm', '09:30', 'noon', 'midnight']\" />",
  ].join("\n"),
  holiday: "<SpHoliday />",

  "range-core": "<SpRange />",
  range: "<SpSelection />",
  "date-range": [
    "<SpRange",
    '  model-value="last week"',
    "  :examples=\"['last week', 'whole week', 'March 3 - 7', 'from today until friday']\" />",
  ].join("\n"),
  "time-range": [
    "<SpRange",
    '  model-value="10:00 - 20:00"',
    "  :examples=\"['10:00 - 20:00', '9am to 5pm', 'morning', 'evening']\" />",
  ].join("\n"),
  "datetime-range": [
    "<SpRange",
    '  model-value="yesterday morning"',
    "  :examples=\"['yesterday morning', 'tomorrow afternoon', 'today 9am to 5pm']\" />",
  ].join("\n"),

  distance: "<SpGeoScore />",
  geo: "<SpGeoScore />",

  math: ["<SpMathEvaluate />", "", "<SpMathSolve />"].join("\n"),
  query: "<SpQuery />",
};

/**
 * One line a person could type into a field, per package — the input the
 * catalog card carries under the summary.
 *
 * The input and never the output: a card cannot run the engine, and a printed
 * result nobody computed is the one thing every live demo on this site exists
 * to avoid. Most of these are the first row of that package's `DEMOS` entry,
 * which `gen-readmes.ts` already evaluates; the rest are the call a package
 * with no expression to type is used through.
 */
export const EXAMPLES: Record<string, string> = {
  core: "1 kg + 500 g",
  kind: 'defineKind({ id: "css" })',
  kinds: "BUILTIN_KINDS",
  shared: 'parseLength("30 cm")',
  smartputs: "bun i smartputs",

  angle: "90 deg in rad",
  area: "1 ha in m2",
  boolean: "1 kg > 900 g",
  datarate: "1 gbps in mbps",
  datasize: "1 GiB in MiB",
  duration: "30 h - 30 min",
  energy: "1 kWh in J",
  length: "2 km in m",
  mass: "1 kg + 500 g",
  measure: "12 pt in mm",
  number: "(1 + 2) * 3",
  percent: "20% of 250",
  power: "1 hp in W",
  speed: "100 kph in mph",
  temperature: "212 F in C",
  tempo: "120 bpm in hz",
  volume: "500 ml + 1 l",

  currency: "30 usd",
  rate: "30 usd in gbp",

  date: "next friday",
  datetime: "3pm in tokyo",
  holiday: "christmas",
  time: "3pm",
  timezone: "gmt+3",

  "date-range": "last week",
  "datetime-range": "yesterday morning",
  range: "last three",
  "range-core": "whole week",
  "time-range": "9am to 5pm",

  distance: "haversine(kyiv, warsaw)",
  geo: "muenchen",

  math: "x^2 - 5x + 6 = 0",
  query: "orders over 500 usd",
};

/**
 * The card icon, by group and then by package. Only names this site already
 * uses appear here: an icon set is resolved at build time by UnoCSS, and a
 * name that is not in `@iconify-json/hugeicons` renders as an empty box rather
 * than as an error anybody would notice.
 */
const GROUP_ICONS: Record<string, string> = {
  Engine: "i-hugeicons-puzzle",
  Kinds: "i-hugeicons-shapes",
  Money: "i-hugeicons-money-01",
  "Dates and time": "i-hugeicons-date-time",
  Ranges: "i-hugeicons-sliders-horizontal",
  Places: "i-hugeicons-map-pin",
  "Math and queries": "i-hugeicons-summation-01",
};

/** Per-package overrides, matching the result-card icons in `theme/engine.ts`. */
const PACKAGE_ICONS: Record<string, string> = {
  angle: "i-hugeicons-triangle",
  area: "i-hugeicons-square",
  datarate: "i-hugeicons-hard-drive",
  datasize: "i-hugeicons-hard-drive",
  duration: "i-hugeicons-timer-01",
  length: "i-hugeicons-ruler",
  mass: "i-hugeicons-weight-scale",
  measure: "i-hugeicons-ruler",
  number: "i-hugeicons-hashtag",
  percent: "i-hugeicons-percent",
  speed: "i-hugeicons-dashboard-speed-01",
  temperature: "i-hugeicons-thermometer",
  volume: "i-hugeicons-test-tube-01",
  math: "i-hugeicons-summation-01",
  query: "i-hugeicons-computer-terminal-01",
  shared: "i-hugeicons-checkmark-square-01",
  smartputs: "i-hugeicons-package",
  core: "i-hugeicons-calculator",
  boolean: "i-hugeicons-checkmark-square-01",
};

export function iconFor(pkg: string): string {
  return (
    PACKAGE_ICONS[pkg] ?? GROUP_ICONS[META[pkg]?.group ?? ""] ?? "i-hugeicons-package"
  );
}

/**
 * Hand-written guide prose, by basename under `docs/_prose/`. These files were
 * `/guide/money`, `/guide/places` and the rest until one package's story stopped
 * being split across two trees that had to be kept in sync.
 */
const PROSE: Record<string, string[]> = {
  boolean: ["boolean"],
  shared: ["shared"],
  rate: ["rate"],
  datetime: ["datetime"],
  "range-core": ["range-core"],
  range: ["range"],
  query: ["query"],
  math: ["math", "math-solving"],
};

const GROUP_ORDER = [
  "Engine",
  "Kinds",
  "Money",
  "Dates and time",
  "Ranges",
  "Places",
  "Math and queries",
];

/** What a subpath contains, when the package has not said something better. */
export const DEFAULT_SUBPATHS: Record<string, string> = {
  ".": "The package root.",
  "./units": "The `UnitTable`: ratios and aliases, with no engine and no `Decimal`.",
  "./validate": "Free functions over JS numbers. `Ok | Err`, never a throw.",
  "./class": "The immutable value class.",
  "./types": "Type declarations only — erased at runtime.",
  "./providers": "The provider interfaces and the built-in implementations.",
  "./locale/en": "English vocabulary for this package's kinds (default export).",
  "./locale/uk": "Ukrainian vocabulary for this package's kinds (default export).",
  "./testing": "Test helpers, not shipped to consumers.",
};

/** A pipe inside a cell ends the cell. `Ok | Err` is a real description here. */
/**
 * A package's published name, read from the manifest that npm will publish.
 *
 * It is not always `@smartput/<dir>`, and spelling it that way was a bug rather
 * than a shortcut: `smartputs` is the unscoped install name, so every page this
 * file generated for it said `@smartput/smartputs` — in the title, the `npm add`
 * line, and all 26 rows of its entry-point table. A package that does not exist,
 * printed as the install instruction for the one package whose whole purpose is
 * being easy to install.
 *
 * Read rather than pattern-matched, because the manifest is the thing that gets
 * published and a second rule here would be a second thing to keep in sync.
 */
const NAMES = new Map<string, string>(
  await Promise.all(
    (await packageDirs()).map(
      async (dir) =>
        [
          dir,
          (await Bun.file(`${rootDir}/packages/${dir}/package.json`).json())
            .name as string,
        ] as const,
    ),
  ),
);

/** `specifierOf("smartputs", "./solve")` → `smartputs/solve`. */
export function specifierOf(pkg: string, subpath = "."): string {
  const name = NAMES.get(pkg);
  if (name === undefined) {
    throw new Error(`specifierOf: no manifest read for packages/${pkg}`);
  }
  return subpath === "." ? name : `${name}${subpath.slice(1)}`;
}

export const cell = (text: string): string => text.replace(/\|/g, "\\|");

export const bytes = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)} kB` : `${n} B`;

export function budgetsFor(pkg: string): EntrySpec[] {
  const prefix = specifierOf(pkg);
  return BUDGETS.filter(
    (row) => row.from === prefix || row.from.startsWith(`${prefix}/`),
  );
}

function isUnitTable(value: unknown): value is UnitTable<string> {
  return (
    typeof value === "object" &&
    value !== null &&
    "canonical" in value &&
    "ratio" in value &&
    "alias" in value
  );
}

/** Alias words per unit, shortest first — the order a reader scans. */
function aliasesOf(table: UnitTable<string>, unit: string): string[] {
  return Object.entries(table.alias)
    .filter(([, target]) => target === unit)
    .map(([alias]) => alias)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function unitTableMarkdown(name: string, table: UnitTable<string>): string {
  const units = [
    table.canonical,
    ...Object.keys(table.ratio).filter((unit) => unit !== table.canonical),
  ];
  const hasOffset = table.offset !== undefined;
  const head = hasOffset
    ? `| Unit | Ratio to \`${table.canonical}\` | Offset | Aliases |\n| --- | --- | --- | --- |`
    : `| Unit | Ratio to \`${table.canonical}\` | Aliases |\n| --- | --- | --- |`;

  const rows = units.map((unit) => {
    const raw = table.ratio[unit];
    const ratio = typeof raw === "function" ? "*f(ctx)*" : `\`${raw}\``;
    const aliases = aliasesOf(table, unit)
      .map((alias) => `\`${alias}\``)
      .join(" ");
    const offset = table.offset?.[unit];
    return hasOffset
      ? `| \`${unit}\` | ${ratio} | ${offset === undefined ? "—" : `\`${offset}\``} | ${aliases} |`
      : `| \`${unit}\` | ${ratio} | ${aliases} |`;
  });

  return `### ${name}\n\n${head}\n${rows.join("\n")}`;
}

export async function unitTablesFor(pkg: string, subpaths: string[]): Promise<string> {
  if (!subpaths.includes("./units")) return "";
  // By path, not by specifier: the workspace root is not a consumer of these
  // packages and has no `@smartput/*` in its own manifest to resolve through.
  const mod = (await import(`${rootDir}/packages/${pkg}/src/units.ts`)) as Record<
    string,
    unknown
  >;
  const tables = Object.entries(mod).filter(([, value]) => isUnitTable(value));
  if (tables.length === 0) return "";

  const body = tables
    .map(([name, table]) => unitTableMarkdown(name, table as UnitTable<string>))
    .join("\n\n");

  return `## Units\n\nRead from the table itself, not typed out — a unit added to
the source appears here on the next \`bun run docs:packages\`. Ratios are decimal
strings, which is what lets the engine widen them to \`Decimal\` without a float
in between.\n\n${body}\n`;
}

export async function runtimeExports(pkg: string): Promise<string[]> {
  try {
    const mod = (await import(`${rootDir}/packages/${pkg}/src/index.ts`)) as Record<
      string,
      unknown
    >;
    return Object.keys(mod)
      .filter((name) => name !== "default")
      .sort();
  } catch {
    // A package whose root pulls a megabyte of data, or one that exports types
    // only. Neither is worth failing the generator over.
    return [];
  }
}

interface Manifest {
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * The one line a reader needs about an optional peer: what installs it, and
 * what does not. Rendering the peer list beside the dependency list rather than
 * under the same heading is the whole point — a page that showed
 * `@smartput/length` depending on `@smartput/shared` alone would be true about
 * `npm add` and a lie about `import { length }`.
 */
function peerLine(pkg: string, peer: string): string {
  const name = peer.slice("@smartput/".length);
  return `- [\`${peer}\`](/packages/${name}) — needed only by \`${specifierOf(pkg)}\` and its \`/locale/*\` entries, and \`npm add\` does not fetch it. Anyone reaching those has written \`createEngine\` and installed it already; the \`/validate\`, \`/units\` and \`/class\` entries never touch it.`;
}

async function page(pkg: string, meta: PageMeta): Promise<string> {
  const manifest = (await Bun.file(
    `${rootDir}/packages/${pkg}/package.json`,
  ).json()) as Manifest;
  const subpaths = Object.keys(manifest.exports ?? { ".": {} });
  const deps = Object.keys(manifest.dependencies ?? {});
  const peers = Object.keys(manifest.peerDependencies ?? {});

  const entryRows = subpaths
    .map((subpath) => {
      const spec = specifierOf(pkg, subpath);
      const what =
        meta.subpaths?.[subpath] ??
        DEFAULT_SUBPATHS[subpath] ??
        "See the source for what this subpath carries.";
      return `| \`${spec}\` | ${cell(what)} |`;
    })
    .join("\n");

  const budgets = budgetsFor(pkg);
  const sizeSection =
    budgets.length === 0
      ? ""
      : `## What it costs\n\nCeilings, not measurements — \`scripts/check-size.ts\` bundles each
entry with \`bun build --minify\`, measures it, and fails \`bun run check\` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.\n\n| Import | Minified | Gzipped |\n| --- | --- | --- |\n${budgets
          .map((row) => `| ${row.label} | ≤ ${bytes(row.min)} | ≤ ${bytes(row.gzip)} |`)
          .join("\n")}\n`;

  const peerSection =
    peers.length === 0
      ? ""
      : `\n### Optional peers\n\n${peers.map((peer) => peerLine(pkg, peer)).join("\n")}\n`;

  const depSection =
    deps.length === 0 && peers.length === 0
      ? `## Dependencies\n\nNone. Not "none for now" — this package is depended on by others precisely
because it has none.\n`
      : `## Dependencies\n\n${
          deps.length === 0
            ? "None that `npm add` fetches.\n"
            : `${deps
                .map((dep) =>
                  dep.startsWith("@smartput/")
                    ? `- [\`${dep}\`](/packages/${dep.slice("@smartput/".length)})`
                    : `- \`${dep}\``,
                )
                .join("\n")}\n`
        }${peerSection}`;

  const exported = await runtimeExports(pkg);
  const exportSection =
    exported.length === 0
      ? ""
      : `## Runtime exports\n\nType-only exports are erased and do not appear here.\n\n${exported
          .map((name) => `\`${name}\``)
          .join(" · ")}\n`;

  const seeSection =
    meta.see === undefined
      ? ""
      : `## See also\n\n${meta.see.map(([text, link]) => `- [${text}](${link})`).join("\n")}\n`;

  const demo = DEMOS[pkg];
  if (demo === undefined) throw new Error(`${pkg}: no demo`);

  // Prose first-hand, tables second. Somebody who came here to read about the
  // package gets the page they used to get at /guide/<topic>; somebody who came
  // to look up a unit scrolls past it to a table that is generated.
  const prose: string[] = [];
  for (const name of PROSE[pkg] ?? []) {
    prose.push((await Bun.file(`${rootDir}/docs/_prose/${name}.md`).text()).trim());
  }

  return [
    `---\ntitle: "${specifierOf(pkg)}"\ndescription: ${JSON.stringify(meta.summary)}\n---`,
    `# ${specifierOf(pkg)}`,
    meta.body,
    `## Try it\n\n${demo}`,
    ...prose,
    "## Installing",
    `\`\`\`sh\nnpm add ${specifierOf(pkg)}\n\`\`\``,
    `## Entry points\n\n| Import | Contents |\n| --- | --- |\n${entryRows}`,
    await unitTablesFor(pkg, subpaths),
    exportSection,
    sizeSection,
    depSection,
    meta.after ?? "",
    seeSection,
  ]
    .filter((part) => part !== "")
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .concat("\n");
}

function indexPage(names: string[]): string {
  const groups = GROUP_ORDER.map((group) => {
    const members = names.filter((name) => META[name]?.group === group);
    return members.length === 0 ? "" : `## ${group}\n\n<SpCatalog group="${group}" />\n`;
  }).filter((section) => section !== "");

  // The cards are Vue and the page is also a corpus: `vitepress-plugin-llms`
  // ships this file's Markdown as `/packages.md`, and a reader with no browser
  // — an agent, a `curl`, a person with JavaScript off — would otherwise find
  // seven headings and no packages under them. So the same rows stay here as
  // one generated table, folded away for everyone who can see the grid.
  const rows = names.map(
    (name) =>
      `| [\`${specifierOf(name)}\`](/packages/${name}) | ${META[name]?.summary} | \`${EXAMPLES[name]}\` |`,
  );

  return `---
title: Packages
description: Every published package, what it is, what it costs, and what it depends on.
---

# Packages

${names.length} packages, one card each — the line under a package is what you
would type into it. Every table on the page a card opens is read from the source
it describes — the manifest's \`exports\`, the kind's \`UnitTable\`, the rows of
\`check-size.ts\` — so none of them can drift from the code without the build
noticing.

The shape is always the same: **core** is the engine and knows nothing about
metres; **shared** is the engine-free parser; each kind is a table plus three
doors onto it; and anything that costs real bytes — a gazetteer, a holiday rule
table — is its own package so that not importing it is possible.

Looking for what to *build* with them instead? The [examples](/guide/examples/)
are seven fields, each wired end to end.

${groups.join("\n")}
<details class="sp-details">
<summary>Every package as one table</summary>

| Package | What it is | Reads |
| --- | --- | --- |
${rows.join("\n")}

</details>
`;
}

/**
 * The card rows, emitted for `SpCatalog.vue` to render.
 *
 * Data and not markup: the index page is Markdown, and thirty-eight cards
 * written into it as HTML would be thirty-eight blocks of generated markup in a
 * file people read diffs of. This way the generator owns the facts, the
 * component owns the card, and the examples index under /guide reuses the same
 * component with rows of its own.
 */
function catalogModule(names: string[]): string {
  const rows = GROUP_ORDER.flatMap((group) => {
    const members = names.filter((name) => META[name]?.group === group);
    if (members.length === 0) return [];
    return [
      `  {\n    group: ${JSON.stringify(group)},\n    items: [`,
      ...members.map(
        (name) =>
          `      {\n        title: ${JSON.stringify(specifierOf(name))},\n` +
          `        summary: ${JSON.stringify(META[name]?.summary ?? "")},\n` +
          `        example: ${JSON.stringify(EXAMPLES[name] ?? "")},\n` +
          `        link: "/packages/${name}",\n` +
          `        icon: ${JSON.stringify(iconFor(name))},\n      },`,
      ),
      "    ],\n  },",
    ];
  });

  return `import type { CatalogGroup } from "./catalog";

// Generated by scripts/gen-package-pages.ts. Do not edit — run
// \`bun run docs:packages\` instead.
export const PACKAGE_CATALOG: readonly CatalogGroup[] = [
${rows.join("\n")}
];

export default PACKAGE_CATALOG;
`;
}

/**
 * Every package directory, sorted. Exported because `gen-readmes.ts` writes one
 * file per package too and must agree with this one about what the set is — a
 * second `readdir` would be a second answer waiting to disagree.
 */
export async function packageDirs(): Promise<string[]> {
  return (await readdir(`${rootDir}/packages`, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Everything below runs only when this file is the entry point. `gen-readmes.ts`
// imports the metadata and the generated-table helpers above, and importing a
// module should not write to the docs tree as a side effect.
if (import.meta.main) {
  const dirs = await packageDirs();

  const undemoed = dirs.filter((name) => DEMOS[name] === undefined);
  if (undemoed.length > 0) {
    console.error(`gen-package-pages: no demo for ${undemoed.join(", ")}`);
    process.exit(1);
  }

  const unexampled = dirs.filter((name) => EXAMPLES[name] === undefined);
  if (unexampled.length > 0) {
    // Same reason as the demo check above: a card with no example line is a
    // card that says less than the table it replaced.
    console.error(`gen-package-pages: no catalog example for ${unexampled.join(", ")}`);
    process.exit(1);
  }

  const missing = dirs.filter((name) => META[name] === undefined);
  if (missing.length > 0) {
    // Failing is the point: a package added without a page is a package with no
    // documentation, and the previous shape of this repo's docs let that happen
    // silently for a whole milestone.
    console.error(`gen-package-pages: no metadata for ${missing.join(", ")}`);
    process.exit(1);
  }

  /**
   * The sidebar, emitted rather than hand-maintained in `locales/en.ts`.
   *
   * Forty entries typed out by hand is forty chances to add a package and forget
   * the row — the same drift the tables above exist to prevent, one file over.
   */
  function sidebarModule(names: string[]): string {
    const groups = GROUP_ORDER.map((group) => {
      const items = names
        .filter((name) => META[name]?.group === group)
        .map((name) => `      { text: "@smartput/${name}", link: "/packages/${name}" },`);
      return items.length === 0
        ? ""
        : `  {\n    text: "${group}",\n    collapsed: false,\n    items: [\n${items.join("\n")}\n    ],\n  },`;
    }).filter((section) => section !== "");

    return `import type { DefaultTheme } from "vitepress";

// Generated by scripts/gen-package-pages.ts. Do not edit — run
// \`bun run docs:packages\` instead.
export const packagesSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: "Overview",
    items: [{ text: "All packages", link: "/packages/" }],
  },
${groups.join("\n")}
];

export default packagesSidebar;
`;
  }

  /**
   * Emitted TypeScript, run through the repo's own formatter.
   *
   * The generated modules are checked in and `bun run lint` reads them, so a
   * generator whose output biome would reformat makes every regeneration dirty
   * the tree. Piping through `biome format` is the only version of this that
   * cannot drift from the config in `biome.json` — matching its line-breaking
   * by hand is a second formatter waiting to disagree with the first.
   */
  async function formatted(source: string, path: string): Promise<string> {
    const biome = Bun.spawn(["bunx", "biome", "format", `--stdin-file-path=${path}`], {
      stdin: new TextEncoder().encode(source),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, code] = await Promise.all([
      new Response(biome.stdout).text(),
      biome.exited,
    ]);
    if (code !== 0) {
      throw new Error(`gen-package-pages: biome format failed for ${path}`);
    }
    return out;
  }

  await mkdir(outDir, { recursive: true });
  for (const name of dirs) {
    const meta = META[name];
    if (meta === undefined) continue;
    await writeFile(`${outDir}/${name}.md`, await page(name, meta));
  }
  await writeFile(`${outDir}/index.md`, indexPage(dirs));
  await writeFile(
    `${rootDir}/docs/.vitepress/locales/packages-sidebar.ts`,
    await formatted(sidebarModule(dirs), "packages-sidebar.ts"),
  );
  await writeFile(
    `${rootDir}/docs/.vitepress/theme/packages-catalog.ts`,
    await formatted(catalogModule(dirs), "packages-catalog.ts"),
  );

  console.log(
    `gen-package-pages: wrote ${dirs.length + 1} pages to docs/packages, the sidebar and the catalog`,
  );
}
