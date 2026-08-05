import { expect, test } from "bun:test";
import { COUNTRIES } from "./countries";

/**
 * Duplicated from `scripts/geo/build.ts` rather than imported. This test's job
 * is to fail when the committed file and the generator disagree, and a test
 * that imports the generator's own marker and hasher would agree with it by
 * construction — including when someone edits both.
 */
const BODY_MARKER = "// ---- generated body; the hash above covers everything below ----";

const source = await Bun.file(new URL("./countries.ts", import.meta.url)).text();

test("the committed body still hashes to what the header claims", () => {
  const claimed = /^\/\/ sha256 body\s+([0-9a-f]{64})$/m.exec(source)?.[1];
  const at = source.indexOf(BODY_MARKER);
  expect(at).toBeGreaterThan(0);
  const body = source.slice(at + BODY_MARKER.length);
  const actual = new Bun.CryptoHasher("sha256").update(body).digest("hex");
  // A mismatch means the table was hand-edited. Rerun `bun run
  // scripts/geo/build.ts` and commit what it produces (spec §7.3).
  expect(actual).toBe(claimed as string);
});

test("the whole T0 tier is present", () => {
  expect(COUNTRIES.length).toBe(252);
});

test("every alpha-2 is a lowercase code, and no two rows share one", () => {
  for (const c of COUNTRIES) expect(c.a2).toMatch(/^[a-z]{2}$/);
  expect(new Set(COUNTRIES.map((c) => c.a2)).size).toBe(COUNTRIES.length);
});

test("every alpha-3 is a lowercase code", () => {
  for (const c of COUNTRIES) expect(c.a3).toMatch(/^[a-z]{3}$/);
});

test("every zone is one the host's Intl accepts", () => {
  // The bridge in spec §3.1 hands `meta.zone` to datetime, which hands it to
  // Temporal. A zone that Intl rejects is a runtime throw in another package,
  // so it is caught here — at the data — rather than there.
  for (const c of COUNTRIES) {
    expect(() => new Intl.DateTimeFormat(undefined, { timeZone: c.zone })).not.toThrow();
  }
});

/**
 * Antarctica has no legal tender and GeoNames leaves the column blank. Pinned
 * as a named exception rather than relaxing the rule to `[A-Z]{3}|""`, so a
 * second blank currency appearing upstream fails this test instead of joining
 * a permissive pattern unnoticed.
 */
const NO_CURRENCY = new Set(["aq"]);

test("every currency is an ISO 4217 code, and only Antarctica has none", () => {
  for (const c of COUNTRIES) {
    if (NO_CURRENCY.has(c.a2)) expect(c.currency).toBe("");
    else expect(c.currency).toMatch(/^[A-Z]{3}$/);
  }
  expect(COUNTRIES.filter((c) => c.currency === "").map((c) => c.a2)).toEqual([
    ...NO_CURRENCY,
  ]);
});

test("every geoname id is a distinct positive integer", () => {
  // It becomes the Value's canonical (spec §4.2), which is what makes identity
  // free — two places are equal exactly when their canonicals are. A duplicate
  // id would make two countries the same place.
  for (const c of COUNTRIES) {
    expect(Number.isInteger(c.geonameId)).toBe(true);
    expect(c.geonameId).toBeGreaterThan(0);
  }
  expect(new Set(COUNTRIES.map((c) => c.geonameId)).size).toBe(COUNTRIES.length);
});

test("every position is on the globe", () => {
  for (const c of COUNTRIES) {
    expect(c.lat).toBeGreaterThanOrEqual(-90);
    expect(c.lat).toBeLessThanOrEqual(90);
    expect(c.lon).toBeGreaterThanOrEqual(-180);
    expect(c.lon).toBeLessThanOrEqual(180);
    // 0,0 is the Gulf of Guinea and is what a missing coordinate looks like.
    expect(c.lat === 0 && c.lon === 0).toBe(false);
  }
});

test("the alpha-2 is the unit id, so it is reachable as an alias", () => {
  // Spec §4.1: a place Value's `unit` is its country, and §3.1's `PlaceMeta`
  // requires `meta.country` to equal that unit. Both read `a2`, so the only
  // invariant the data itself can carry is that `a2` is findable by name.
  for (const c of COUNTRIES) expect(c.aliases).toContain(c.a2);
});

/**
 * Seven official names cannot be aliases of themselves: six run past the four
 * words the matcher's trie walks (spec §5.1) and "U.S. Virgin Islands" carries
 * dots a launcher tokenizes on. Each is still reachable by a shorter GeoNames
 * variant — "dr congo", "saint vincent", "caribbean netherlands" — except `um`,
 * which has none and is reachable only by its two codes.
 *
 * Pinned rather than excused by a looser assertion, so an eighth fails here.
 */
const NAME_TOO_LONG = new Set(["bq", "cd", "gs", "hm", "um", "vc", "vi"]);

test("a country is findable by its own name, or is one of the seven that cannot be", () => {
  const missing = COUNTRIES.filter((c) => !c.aliases.includes(c.name.toLowerCase()));
  expect(missing.map((c) => c.a2).sort()).toEqual([...NAME_TOO_LONG].sort());
});

test("no alias can shadow a unit or read as a number", () => {
  for (const c of COUNTRIES) {
    for (const alias of c.aliases) {
      expect(alias).toBe(alias.toLowerCase());
      expect(alias).toMatch(/^[a-z][a-z0-9' -]*$/);
      // Two letters is the whole ISO code space plus most of the unit
      // vocabulary; only the country's own code earns that length.
      if (alias.length < 3) expect(alias).toBe(c.a2);
      // Bounded by the trie the matcher walks (spec §5.1).
      expect(alias.split(" ").length).toBeLessThanOrEqual(4);
    }
    expect(new Set(c.aliases).size).toBe(c.aliases.length);
  }
});

test("population and area are non-negative numbers", () => {
  for (const c of COUNTRIES) {
    expect(c.population).toBeGreaterThanOrEqual(0);
    expect(c.area).toBeGreaterThanOrEqual(0);
  }
});

const find = (a2: string) => COUNTRIES.find((c) => c.a2 === a2);

test("Japan", () => {
  expect(find("jp")).toMatchObject({
    a3: "jpn",
    name: "Japan",
    capital: "Tokyo",
    currency: "JPY",
    phone: "81",
    zone: "Asia/Tokyo",
    geonameId: 1861060,
  });
});

test("Ukraine", () => {
  expect(find("ua")).toMatchObject({
    a3: "ukr",
    name: "Ukraine",
    capital: "Kyiv",
    currency: "UAH",
    phone: "380",
    zone: "Europe/Kyiv",
    geonameId: 690791,
  });
});

test("United States", () => {
  // Washington, not New York: the capital is resolved by PPLC, not population.
  expect(find("us")).toMatchObject({
    a3: "usa",
    name: "United States",
    capital: "Washington",
    currency: "USD",
    phone: "1",
    zone: "America/New_York",
    geonameId: 6252001,
  });
  expect(find("us")?.aliases).toContain("usa");
});
