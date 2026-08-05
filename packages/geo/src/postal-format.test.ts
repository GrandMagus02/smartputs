import { expect, test } from "bun:test";
import { COUNTRIES } from "./data/countries";
import {
  isBacktrackRisk,
  MAX_CODE_LENGTH,
  normalizePostal,
  PostalFormat,
  postalAccepts,
  postalShape,
} from "./postal-format";
import type { CountryRow } from "./types";

/**
 * Spec §10, M6.4. The subject is `PostalFormat` and the thing most worth
 * proving is not any single country: it is that this file and `postal.ts` agree
 * about `CountryRow.postalRegex` for every row, which is the defect the task
 * was written to avoid and the only one that could ship silently.
 */

const rowOf = (a2: string): CountryRow =>
  COUNTRIES.find((c) => c.a2 === a2) as CountryRow;

const WITH_FORMAT = COUNTRIES.filter((c) => c.postalRegex.trim() !== "");
const formatOf = (a2: string): PostalFormat => PostalFormat.for(a2) as PostalFormat;

// ---------------------------------------------------------------- the door

test("the class is the door and the instance is frozen", () => {
  const gb = formatOf("gb");
  expect(gb).toBeInstanceOf(PostalFormat);
  expect(Object.isFrozen(gb)).toBe(true);
  expect(gb.country).toBe("GB");
  // The column verbatim, not a compiled or de-anchored version of it: a caller
  // handing this to another language must get what GeoNames shipped.
  expect(gb.source).toBe(rowOf("gb").postalRegex);

  // Every method returns a new value; nothing on the instance moves.
  const before = { ...gb };
  gb.normalize("sw1a1aa");
  gb.validate("nonsense");
  expect({ ...gb }).toEqual(before);
});

test("for() takes alpha-2 or alpha-3 in any case, and hands back one instance", () => {
  expect(PostalFormat.for("GB")).toBe(PostalFormat.for("gb"));
  expect(PostalFormat.for("gbr")).toBe(PostalFormat.for("GB"));
  expect(PostalFormat.for(" us ")).toBe(PostalFormat.for("USA"));
  expect(PostalFormat.for("zz")).toBeNull();
  expect(PostalFormat.for("")).toBeNull();
});

test("of() is the same door for a row the caller brought", () => {
  const brought: CountryRow = { ...rowOf("nl"), a2: "xx", aliases: [] };
  const fmt = PostalFormat.of(brought) as PostalFormat;
  expect(fmt.country).toBe("XX");
  expect(fmt.normalize("1234ab")).toBe("1234 AB");
  // Keyed by row, so a `definePlace()` table gets instance identity too.
  expect(PostalFormat.of(brought)).toBe(fmt);
});

// ------------------------------------------------- no postal system at all

test("a country with no postal system is null, not a format that takes anything", () => {
  // The trap this is guarding: an empty pattern anchored as `^(?:)$` matches the
  // empty string and, unanchored, matches everything. `postal.ts`'s `compile`
  // returns null for both, and `for()` has to turn that into an absence rather
  // than into a permissive format.
  for (const a2 of ["aq", "to", "ky"]) {
    expect(rowOf(a2).postalRegex).toBe("");
    expect(PostalFormat.for(a2)).toBeNull();
    // And the layer underneath refuses rather than accepts.
    expect(postalAccepts(rowOf(a2), "12345")).toBe(false);
    expect(normalizePostal(rowOf(a2), "12345")).toBeNull();
  }
  expect(COUNTRIES.length - WITH_FORMAT.length).toBe(74);
});

test("Ireland is the near miss: the Eircode is in the column and validates", () => {
  // Worth pinning because Ireland reads like a country with no postcodes — it
  // had none before 2015 — and because its pattern is the one row in the table
  // with no closing `$`, so it is `postal.ts`'s re-anchoring that makes this
  // exact rather than a prefix match.
  const ie = formatOf("ie");
  expect(ie.validate("D02 AF30")).toBe(true);
  expect(ie.normalize("d02af30")).toBe("D02 AF30");
  // Without the re-anchoring "D02 AF30 and then some" would match too.
  expect(ie.validate("D02 AF30 EXTRA")).toBe(false);
});

// -------------------------------------------------------------- normalizing

test("normalization is per country and is not one rule", () => {
  // The four the milestone names, each a different rule, none of them written
  // down here: the placement is searched against the country's own format.
  expect(formatOf("gb").normalize("SW1A1AA")).toBe("SW1A 1AA");
  expect(formatOf("ca").normalize("m5v3l9")).toBe("M5V 3L9");
  expect(formatOf("nl").normalize("1234ab")).toBe("1234 AB");
  expect(formatOf("us").normalize("902101234")).toBe("90210-1234");
});

test("a code already spelled canonically comes back unchanged", () => {
  const same: [string, string][] = [
    ["gb", "SW1A 1AA"],
    ["ca", "M5V 3L9"],
    ["nl", "1234 AB"],
    ["us", "90210-1234"],
    ["us", "90210"],
    ["jp", "100-0001"],
    ["de", "12345"],
    ["pt", "1234-567 LISBOA"],
  ];
  for (const [a2, code] of same) expect(formatOf(a2).normalize(code)).toBe(code);
});

test("countries these tests only round-trip, rather than truly normalize", () => {
  // Being honest about the difference. For these the canonical form has no
  // separator to place, so `normalize` is doing case folding and whitespace
  // trimming and nothing else — passing here is not evidence that a separator
  // search works, which is what the four above are for.
  expect(formatOf("de").normalize(" 12345 ")).toBe("12345");
  expect(formatOf("fr").normalize("75008")).toBe("75008");
  expect(formatOf("au").normalize("2000")).toBe("2000");
  expect(formatOf("us").normalize("90210")).toBe("90210");
});

test("the separator search finds the format's own position, whatever it is", () => {
  // None of these placements is written down in `postal-format.ts`; each is the
  // one position the country's pattern accepts.
  expect(formatOf("jp").normalize("1234567")).toBe("123-4567");
  expect(formatOf("br").normalize("01310100")).toBe("01310-100");
  expect(formatOf("pl").normalize("12345")).toBe("12-345");
  expect(formatOf("se").normalize("12345")).toBe("123 45");
  expect(formatOf("cz").normalize("12345")).toBe("123 45");
  expect(formatOf("md").normalize("MD2001")).toBe("MD-2001");
  expect(formatOf("mt").normalize("ABC1234")).toBe("ABC 1234");
  expect(formatOf("gb").normalize("GIR0AA")).toBe("GIR 0AA");
  expect(formatOf("az").normalize("AZ1000")).toBe("AZ 1000");
});

test("a wrong separator is repaired rather than refused", () => {
  // "90210 1234" is separated and invalid, so the given form loses and the
  // search runs on the stripped core — which is the same path "902101234" takes.
  expect(formatOf("us").normalize("90210 1234")).toBe("90210-1234");
  expect(formatOf("jp").normalize("123 4567")).toBe("123-4567");
  expect(formatOf("gb").normalize("SW1A-1AA")).toBe("SW1A 1AA");
});

test("a single reinsertion cannot rebuild Portugal's two separators", () => {
  // The one known limit of the search, and the reason it is a limit rather than
  // a bug: `\d{4}-\d{3}\s?[a-zA-Z]{0,25}` is the only shipped format with two
  // separators, its second one is optional, and what comes back is a code the
  // format genuinely accepts.
  const pt = formatOf("pt");
  expect(pt.normalize("1234-567 lisboa")).toBe("1234-567 LISBOA");
  expect(pt.normalize("1234567LISBOA")).toBe("1234-567LISBOA");
  expect(pt.validate("1234567LISBOA")).toBe(true);
  expect(pt.normalize("1234567")).toBe("1234-567");
});

test("validate is normalize's answer, so a form cannot accept what it cannot canonicalize", () => {
  const us = formatOf("us");
  expect(us.validate("902101234")).toBe(true);
  expect(us.normalize("902101234")).toBe("90210-1234");
  // The strict question still exists, one layer down, and answers differently.
  expect(postalAccepts(rowOf("us"), "902101234")).toBe(false);
  expect(postalAccepts(rowOf("us"), "90210-1234")).toBe(true);
});

test("an invalid code is null from normalize and false from validate", () => {
  const gb = formatOf("gb");
  for (const bad of ["", "   ", "nope", "12345", "SW1A 1AA1", "---", "9"]) {
    expect(gb.normalize(bad)).toBeNull();
    expect(gb.validate(bad)).toBe(false);
  }
});

test("normalize is idempotent and every result it returns is strictly accepted", () => {
  const probes = [
    "90210",
    "902101234",
    "SW1A1AA",
    "m5v3l9",
    "1234ab",
    "1234567",
    "12345",
    "123456",
    "AZ1000",
    "D02AF30",
    "1234-567 lisboa",
    "GIR0AA",
    "01310100",
    "MD2001",
    "ABC1234",
  ];
  for (const row of WITH_FORMAT) {
    for (const probe of probes) {
      const once = normalizePostal(row, probe);
      if (once === null) continue;
      expect(postalAccepts(row, once)).toBe(true);
      expect(normalizePostal(row, once)).toBe(once);
    }
  }
});

test("anything the format accepts as written, normalize can canonicalize", () => {
  // The property that keeps `validate` honest: `validate` is defined as
  // "normalizable", so a code the pattern already takes must never come back
  // invalid because the search rearranged it.
  const probes = [
    "90210",
    "90210-1234",
    "SW1A 1AA",
    "M5V 3L9",
    "1234 AB",
    "123 45",
    "123-4567",
    "01310-100",
    "AZ 1000",
    "1000",
    "D02 AF30",
    "MD-2001",
    "GIR 0AA",
    "FIQQ 1ZZ",
    "NRU68",
    "96799",
    "ABC 1234",
    "LV-1010",
    "AD123",
  ];
  for (const row of WITH_FORMAT) {
    for (const probe of probes) {
      if (!postalAccepts(row, probe)) continue;
      expect(normalizePostal(row, probe)).not.toBeNull();
    }
  }
});

// ------------------------------------------------------------------- shape

test("shape reports the normalized code's shape, and only for a valid code", () => {
  const gb = formatOf("gb");
  expect(gb.shape("sw1a1aa")).toBe("@@#@ #@@");
  expect(gb.shape("SW1A 1AA")).toBe("@@#@ #@@");
  expect(gb.shape("nope")).toBeNull();
  expect(formatOf("us").shape("902101234")).toBe("#####-####");
  expect(formatOf("ca").shape("m5v3l9")).toBe("@#@ #@#");
  expect(postalShape("1234-567 LISBOA")).toBe("####-### @@@@@@");
});

// --------------------------------------------------- one reading of column 14

test("PostalFormat agrees with GeoNames' column for every country that has one", () => {
  // The whole point of the file. This is the ONLY place a second compilation of
  // `postalRegex` is written, it is written in a test rather than in the
  // implementation, and it exists so that a divergence between this file and
  // `postal.ts` fails here instead of shipping. Mirrors `postal.ts`'s `compile`
  // exactly: strip the anchors, wrap in a non-capturing group, re-anchor,
  // case-insensitive.
  const reference = (source: string): RegExp => {
    let body = source.trim();
    if (body.startsWith("^")) body = body.slice(1);
    if (body.endsWith("$")) body = body.slice(0, -1);
    return new RegExp(`^(?:${body.trim()})$`, "i");
  };

  const probes = [
    "90210",
    "90210-1234",
    "902101234",
    "SW1A 1AA",
    "SW1A1AA",
    "sw1a1aa",
    "M5V 3L9",
    "m5v3l9",
    "1234AB",
    "1234 AB",
    "123 45",
    "12345",
    "123-4567",
    "1234567",
    "01310-100",
    "AZ 1000",
    "AZ1000",
    "1000",
    "D02 AF30",
    "D02AF30",
    "MD-2001",
    "MD2001",
    "GIR 0AA",
    "GIR0AA",
    "1234-567 lisboa",
    "12-345",
    "FIQQ 1ZZ",
    "NRU68",
    "96799",
    "ABC 1234",
    "LV-1010",
    "LV1010",
    "LV 1010",
    "123456",
    "1234",
    "AD123",
    "",
    "   ",
  ];

  // `for()` reads "has a format" off the emptiness of the column, because the
  // other two ways `compile` gives up are invisible from outside it. That is
  // only sound while no row is in those states, so this is where it is checked:
  // a regeneration that ships an uncompilable pattern, or one that matches the
  // empty string, would hand out a `PostalFormat` that validates nothing.
  for (const row of WITH_FORMAT) {
    expect(() => reference(row.postalRegex)).not.toThrow();
    expect(reference(row.postalRegex).test("")).toBe(false);
  }

  const disagreements: string[] = [];
  for (const row of WITH_FORMAT) {
    const raw = reference(row.postalRegex);
    for (const probe of probes) {
      const expected = probe !== "" && raw.test(probe);
      if (postalAccepts(row, probe) !== expected)
        disagreements.push(`${row.a2} ${JSON.stringify(probe)}`);
    }
  }
  expect(disagreements).toEqual([]);
  expect(WITH_FORMAT.length).toBe(178);
});

test("a valid prefix with rubbish after it is not a valid code", () => {
  // `postal.ts` walks longest-span-first and falls back to a shorter span, so
  // "something was claimed" is not the same question as "the code is valid" —
  // this is what the length check in the tester is for.
  expect(formatOf("us").validate("90210 nonsense")).toBe(false);
  expect(formatOf("gb").validate("SW1A 1AA nonsense")).toBe(false);
  expect(formatOf("nl").validate("1234 AB nonsense")).toBe(false);
});

test("a country code beside a code is not part of the code", () => {
  // `postal.ts` reads "de 12345" as Germany's 12345, which is right for a
  // sentence and wrong for a validator. Stripping the aliases before building
  // the matcher is what makes this false; without it every country would accept
  // its own name and code as a prefix.
  expect(formatOf("de").validate("de 12345")).toBe(false);
  expect(formatOf("us").validate("us 90210")).toBe(false);
  expect(formatOf("jp").validate("japan 100-0001")).toBe(false);
  // Azerbaijan's format contains its own prefix, so "AZ 1000" really is a code.
  expect(formatOf("az").validate("AZ 1000")).toBe(true);
});

test("a unit symbol inside a code is a code here and a unit in the parser", () => {
  // `postal.ts` refuses "1234 kg" as a Dutch postcode because claiming it would
  // take a mass away from the expression around it. There is no expression here,
  // so the answer flips — and 1234 KG is a real Kerkrade postcode.
  expect(formatOf("nl").validate("1234 kg")).toBe(true);
  expect(formatOf("nl").normalize("1234kg")).toBe("1234 KG");
});

// ------------------------------------------------------- untrusted patterns

test("the backtracking screen catches the two shapes that hang a process", () => {
  expect(isBacktrackRisk("^(a+)+$")).toBe(true);
  expect(isBacktrackRisk("^(?:a|aa)+$")).toBe(true);
  expect(isBacktrackRisk("^([a-z]*)*$")).toBe(true);
  expect(isBacktrackRisk("^(\\d{2,})+$")).toBe(true);
});

test("the screen is not quietly deleting countries", () => {
  // A conservative screen that refused a real format would remove that country's
  // codes from the API without anyone noticing, which is the failure mode that
  // makes a safety check worse than the risk. All 178 pass.
  const refused = WITH_FORMAT.filter((c) => isBacktrackRisk(c.postalRegex));
  expect(refused.map((c) => c.a2)).toEqual([]);
  // Including the shapes closest to the screen's edge: a starred group is fine
  // as long as nothing inside it repeats.
  expect(isBacktrackRisk(rowOf("ad").postalRegex)).toBe(false);
  expect(isBacktrackRisk("^(?:AZ )*(\\d{4})$")).toBe(false);
  expect(isBacktrackRisk("^\\d{5}(-\\d{4})?$")).toBe(false);
});

test("a row whose pattern the screen refuses accepts nothing, and has no format", () => {
  // Closed, not open. A format that cannot be trusted must not become one that
  // takes everything.
  const evil: CountryRow = { ...rowOf("us"), a2: "xx", postalRegex: "^(a+)+$" };
  expect(PostalFormat.of(evil)).toBeNull();
  expect(postalAccepts(evil, "aaaa")).toBe(false);
  expect(normalizePostal(evil, "aaaa")).toBeNull();
});

test("an over-long code is refused before a pattern sees a character", () => {
  // The other half of the mitigation: backtracking cost is a function of input
  // length, so the cap is what turns "unbounded" into "bounded". Portugal's is
  // the longest shipped format at 34 characters, so nothing real is turned away.
  expect(MAX_CODE_LENGTH).toBeGreaterThan(34);
  const us = formatOf("us");
  expect(us.validate("90210".padEnd(MAX_CODE_LENGTH + 1, "0"))).toBe(false);
  expect(us.normalize("9".repeat(MAX_CODE_LENGTH + 1))).toBeNull();

  // And the whole thing stays fast on an adversarial input of exactly the cap,
  // against every format at once. A bound nobody has measured is a hope.
  const worst = "a-9 ".repeat(MAX_CODE_LENGTH).slice(0, MAX_CODE_LENGTH);
  const started = performance.now();
  for (const row of WITH_FORMAT) normalizePostal(row, worst);
  expect(performance.now() - started).toBeLessThan(2000);
});
