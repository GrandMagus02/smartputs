import { expect, test } from "bun:test";
import { countryTable, regexFromMask } from "./countries";
import { MIN_NAME_LENGTH } from "./kind/matcher";
import { RESERVED_WORDS } from "./kind/reserved";
import { geonames } from "./providers/geonames";

/**
 * The half of the suite that asks GeoNames.
 *
 * Every other test in this package runs against a fixture or a stub, because a
 * test that needs a network is a test that fails for reasons nobody can act on.
 * These do need one, and the reason is the claim they make: that the *shape*
 * this package parses is the shape the live service actually sends, and that a
 * real table of ~250 countries carries no alias that would break an engine.
 * Neither is provable against data this repository wrote — a fixture that
 * satisfied them would only be saying the fixture is fine.
 *
 * They are what replaces the sweeps the vendored tables used to support. The old
 * `data/countries.test.ts` recomputed a body hash over a committed file; there
 * is no committed file now, so the equivalent guarantee is to fetch the thing
 * and check it.
 *
 * **Gating.** A free GeoNames account is a username, so these run only when
 * `GEONAMES_USERNAME` is set and are skipped otherwise. Skipped and never
 * silently passed: a fixture-shaped fallback here would report green for a
 * network contract nobody checked, which is the exact failure mode the whole
 * package exists to avoid. `bun test` prints them as skips, and the one test
 * below that always runs asserts the gate itself is wired.
 *
 * ```
 * GEONAMES_USERNAME=your-account bun test packages/geo
 * ```
 *
 * **Credits.** The table is fetched **once** for the whole file and shared, not
 * per test. `countryTable` costs nine requests against a free account's hourly
 * thousand, and a per-test fetch would spend ninety to assert one thing.
 */
const username = process.env.GEONAMES_USERNAME;
const live = username !== undefined && username !== "";

test("the live suite is gated on a credential and says so when it is missing", () => {
  // Always runs. Without it, a typo in the environment variable's name would
  // make this whole file skip forever and the suite would still print green.
  expect(typeof live).toBe("boolean");
  if (!live) {
    console.log(
      "packages/geo: live GeoNames tests skipped — set GEONAMES_USERNAME to run them",
    );
  }
});

/**
 * One table, fetched at module load when the gate is open.
 *
 * `null` rather than a lazy getter so the cost is visibly paid once, and so a
 * failure to fetch fails the file rather than the first test that happens to
 * touch it.
 */
const table = live
  ? await countryTable(geonames({ username: username as string }))
  : null;

test.skipIf(!live)("the live table has every country in it", () => {
  // ~250 is the real figure. The floor is deliberately well below it: this
  // asserts "the join worked", not "GeoNames has not admitted a new member".
  expect(table?.length ?? 0).toBeGreaterThan(200);
});

test.skipIf(!live)("every row carries what both bridges read", () => {
  for (const row of table ?? []) {
    // A row missing any of these is the failure `joinCountries` drops a country
    // to avoid: no zone breaks `3pm in <country>`, no coordinates break the
    // distance op, and both would break silently.
    expect(row.a2, `${row.name} has no alpha-2`).toMatch(/^[a-z]{2}$/);
    expect(row.zone, `${row.name} has no zone`).not.toBe("");
    expect(row.name, `${row.a2} has no name`).not.toBe("");
    expect(Number.isFinite(row.lat) && Number.isFinite(row.lon)).toBe(true);
    expect(row.geonameId).toBeGreaterThan(0);
  }
});

test.skipIf(!live)("the countries a bridge test names are all present", () => {
  const byA2 = new Map((table ?? []).map((row) => [row.a2, row]));
  for (const a2 of ["ua", "jp", "gb", "us", "fr", "pl"]) {
    expect(byA2.get(a2), `${a2} is missing from the live table`).toBeDefined();
  }
  expect(byA2.get("jp")?.currency).toBe("JPY");
  expect(byA2.get("ua")?.zone).toStartWith("Europe/");
});

test.skipIf(!live)(
  "alternate names arrive, which is what replaces a vendored alias table",
  () => {
    const gb = (table ?? []).find((row) => row.a2 === "gb");
    // The whole argument for fetching the feature rows as well as the table: the
    // official name alone would leave "uk" and "britain" unresolvable, and those
    // are what people type.
    expect(gb?.aliases.length ?? 0).toBeGreaterThan(2);
    expect(gb?.aliases).toContain("united kingdom");
  },
);

test.skipIf(!live)("no live alias is a word the engine needs", () => {
  // The sweep the fixture cannot do. A single-word alias that is a reserved word
  // would be claimed destructively — "and" is Andorra, "to" is Tonga, "km" is
  // Comoros — and this is the only test in the repo that can still say it about
  // real data.
  const offenders: string[] = [];
  for (const row of table ?? []) {
    for (const alias of row.aliases) {
      if (alias === row.a2) continue;
      if (alias.length < MIN_NAME_LENGTH)
        offenders.push(`${row.a2}: ${alias} (too short)`);
      else if (!alias.includes(" ") && RESERVED_WORDS.has(alias)) {
        offenders.push(`${row.a2}: ${alias} (reserved)`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test.skipIf(!live)("lang is the whole of the internationalization", async () => {
  const uk = await countryTable(geonames({ username: username as string }), {
    lang: "uk",
  });
  const ua = uk.find((row) => row.a2 === "ua");
  // Not "Ukraine". This is the assertion that makes the deleted `locale/uk.ts`
  // unnecessary: the names come back translated because the request asked.
  expect(ua?.name).toMatch(/[Ѐ-ӿ]/);
});

test.skipIf(!live)("a postal mask becomes a regex that accepts a real code", () => {
  const gb = (table ?? []).find((row) => row.a2 === "gb");
  expect(gb?.postalRegex).not.toBe("");
  expect(new RegExp(gb?.postalRegex ?? "$^").test("SW1A 1AA")).toBe(true);

  const us = (table ?? []).find((row) => row.a2 === "us");
  expect(new RegExp(us?.postalRegex ?? "$^").test("90210")).toBe(true);
});

test("regexFromMask is pure and runs without an account", () => {
  // The derivation itself needs no network, so it is asserted here rather than
  // behind the gate — the live rows above only prove the masks upstream sends.
  expect(new RegExp(regexFromMask("#####")).test("90210")).toBe(true);
  expect(new RegExp(regexFromMask("#####")).test("9021")).toBe(false);
  expect(new RegExp(regexFromMask("#####-####")).test("90210-1234")).toBe(true);

  // The United Kingdom's mask, verbatim: seven shapes separated by pipes. The
  // pipe is alternation, and treating it as a literal — which is what escaping
  // every other punctuation mark would do — yields a regex matching none of them.
  const gb = regexFromMask("@# #@@|@## #@@|@@# #@@|@@## #@@|@#@ #@@|@@#@ #@@|GIR0AA");
  expect(new RegExp(gb).test("SW1A 1AA")).toBe(true);
  expect(new RegExp(gb).test("SW1A1AA")).toBe(true);
  expect(new RegExp(gb).test("M1 1AE")).toBe(true);
  expect(new RegExp(gb).test("GIR0AA")).toBe(true);
  expect(new RegExp(gb).test("not a postcode")).toBe(false);

  // A space in a mask is optional, because half the world omits it.
  expect(new RegExp(regexFromMask("@@#@ #@@")).test("EC1A 1BB")).toBe(true);
  expect(new RegExp(regexFromMask("@@#@ #@@")).test("EC1A1BB")).toBe(true);

  expect(regexFromMask("")).toBe("");
  expect(regexFromMask("   ")).toBe("");
});

test.skipIf(!live)(
  "the search index answers, in the shape the parser expects",
  async () => {
    const hits = await geonames({ username: username as string }).search({
      text: "Kyiv",
      kinds: ["city"],
      limit: 5,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.place.country).toBe("ua");
    expect(hits[0]?.place.zone).not.toBe("");
    expect(hits[0]?.kind).toBe("city");
  },
);

test.skipIf(!live)("the postal index is a different index, and answers too", async () => {
  const rows = await geonames({ username: username as string }).postal("90210", "us");
  expect(rows[0]?.postal).toBe("90210");
  expect(rows[0]?.name).toBe("Beverly Hills");
  // A postal row carries no feature id upstream, and this package invents none.
  expect(rows[0]?.geonameId).toBe(0);
});

test.skipIf(!live)(
  "a river is reachable, which no vendored tier ever made it",
  async () => {
    const hits = await geonames({ username: username as string }).search({
      text: "Dnipro",
      kinds: ["water"],
      limit: 5,
    });
    expect(hits.every((hit) => hit.kind === "water")).toBe(true);
  },
);
