import { expect, test } from "bun:test";
import { BUILTIN_KINDS, measure } from "@smartput/kinds";
import { createEngine } from "../engine";
import en from "../locale/en";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

// `measure` is deliberately outside BUILTIN_KINDS -- its mm/cm aliases collide
// with length's -- so its units get their own engine rather than being folded
// into the corpus, which would change what every length row completes to.
const measures = createEngine({ locales: [en], kinds: [measure] });

const raw = await Bun.file(
  new URL("../../corpus/en-complete.tsv", import.meta.url),
).text();
const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the completion corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [input, kind, unit, text] of rows) {
  test(`completion corpus: ${input}`, () => {
    const top = engine.complete(input as string)[0];
    expect(`${input} -> ${top?.kind}:${top?.unit} ${top?.text}`).toBe(
      `${input} -> ${kind}:${unit} ${text}`,
    );
  });
}

// Prefixes of the word forms and symbols of every registered unit, plus the
// bare single letters a user passes through on the way to typing them -- "m"
// alone reaches length:m, duration:min, area:m2 and six more, and it is the
// single letter most likely to be sitting in the box mid-keystroke.
const FRAGMENTS = [
  "h ho hou min minu s sec d da wee ms millis",
  "m mi mil met km kilom mm millim cm centi in inc ft fo yd yar",
  "g gra kg kilog kilo mg millig lb poun oz oun t ton",
  "b by kb kilob mb megab gb gigab tb terab kib kibib mib mebib gib gibib tib tebib",
  "c cel cent f fah k kel",
  "deg degre rad radi grad gon tur rev",
  "sq sqm m2 m3 ha hect acr l lit ml millil gal pin",
  "kno kt kph kmh mph mps % perc pct",
].flatMap((group) => group.split(" "));

// measure's own prefixes, run against the measure-only engine.
const MEASURE_FRAGMENTS = ["pt", "poi", "pc", "pic", "px", "pix", "inc", "mm", "cm"];

// One count per CLDR category the locale distinguishes, plus a grouped one and
// a magnitude outside every typical band, so scaleFit is exercised both ways.
const COUNTS = ["1", "2", "30", "0.5", "0", "600", "1,500"];

// The property that protects every display form. A display form the parser
// cannot read turns a completion into a dead end, and nothing else checks it.
test("every completion of a single quantity evaluates back to its own kind", () => {
  for (const [e, fragments] of [
    [engine, FRAGMENTS],
    [measures, MEASURE_FRAGMENTS],
  ] as const) {
    for (const count of COUNTS) {
      for (const fragment of fragments) {
        const completions = e.complete(`${count} ${fragment}`, { limit: 50 });
        for (const c of completions) {
          const result = e.evaluate(c.text, { kinds: [c.kind] });
          expect(`${c.text} -> ${result.kind}`).toBe(`${c.text} -> ${c.kind}`);
        }
      }
    }
  }
});

// The fragment list above is only worth its length if it actually reaches the
// units it names. Without this, deleting a line from FRAGMENTS would silently
// shrink the property above rather than fail.
test("the fragment list reaches every unit of every built-in kind", () => {
  const reached = new Set<string>();
  for (const fragment of FRAGMENTS) {
    for (const c of engine.complete(`1 ${fragment}`, { limit: 50 })) {
      reached.add(`${c.kind}:${c.unit}`);
    }
  }

  const missing: string[] = [];
  for (const kind of BUILTIN_KINDS) {
    if (kind.value.mode !== "ratio") continue;
    for (const unit of Object.keys(kind.value.units)) {
      // number's sole unit has no aliases, so nothing can complete to it.
      if (kind.id === "number") continue;
      if (!reached.has(`${kind.id}:${unit}`)) missing.push(`${kind.id}:${unit}`);
    }
  }
  expect(missing).toEqual([]);
});

// Weaker claim for expressions, because completing only the trailing token is
// context-blind: "10 kg + 5 mil" -> "10 kg + 5 miles" is a legal completion and
// a DimensionMismatchError. Lexing is the most that can be asserted.
test("every completion inside an expression at least lexes", () => {
  const inputs = [
    "10 kg + 5 gr",
    "2 km in mil",
    "10 m + 5 ho",
    "3 lb - 1 oun",
    "(1 + 2) * 3 kilog",
    "212 f in cel",
    "90 deg in rad",
    "1 kib in by",
    "100 km / 2 ho",
    "3 m * 4 met",
    "20% of 50 lit",
  ];
  for (const input of inputs) {
    for (const c of engine.complete(input, { limit: 50 })) {
      expect(() => lex(normalize(c.text), en)).not.toThrow();
    }
  }
});
