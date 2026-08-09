import { expect, test } from "bun:test";
import { COUNTRIES, RESERVED_WORDS } from "@smartput/country";
import { ADMIN1 } from "./admin1";
import { CITIES } from "./cities";

/**
 * Duplicated from `scripts/geo/build.ts` rather than imported, for the reason
 * `countries.test.ts` gives: a test that imports the generator's own marker and
 * hasher agrees with it by construction, including when someone edits both.
 */
const BODY_MARKER = "// ---- generated body; the hash above covers everything below ----";

const hashed = async (file: string) => {
  const source = await Bun.file(new URL(file, import.meta.url)).text();
  const claimed = /^\/\/ sha256 body\s+([0-9a-f]{64})$/m.exec(source)?.[1];
  const at = source.indexOf(BODY_MARKER);
  expect(at).toBeGreaterThan(0);
  const body = source.slice(at + BODY_MARKER.length);
  return { claimed, actual: new Bun.CryptoHasher("sha256").update(body).digest("hex") };
};

test("the committed bodies still hash to what their headers claim", async () => {
  // A mismatch means a table was hand-edited. Rerun `bun run
  // scripts/geo/build.ts` and commit what it produces (spec §7.3).
  for (const file of ["./cities.ts", "./admin1.ts"]) {
    const { claimed, actual } = await hashed(file);
    expect(actual).toBe(claimed as string);
  }
});

test("the whole T1 tier is present", () => {
  // Pinned rather than bounded, so a GeoNames release that halves the table is a
  // failure here and not a package that quietly stops resolving half its cities.
  expect(CITIES.length).toBe(6247);
  expect(ADMIN1.length).toBe(1664);
});

test("every row is over the floor, or is a seat of government", () => {
  // The second clause is the whole reason `capital` is a column: Ngerulmud has
  // no population on this table and is still what "palau" resolves through.
  for (const c of CITIES) {
    expect(c.population >= 100_000 || c.capital).toBe(true);
  }
  expect(CITIES.filter((c) => c.capital).length).toBe(241);
});

test("every geoname id is a distinct positive integer", () => {
  // It is the Value's canonical (spec §4.2), so a duplicate id would make two
  // cities the same place — and would make `paris to paris` a distance of zero
  // between the wrong two.
  for (const c of CITIES) {
    expect(Number.isInteger(c.geonameId)).toBe(true);
    expect(c.geonameId).toBeGreaterThan(0);
  }
  expect(new Set(CITIES.map((c) => c.geonameId)).size).toBe(CITIES.length);
});

test("no city id collides with a country id", () => {
  // Both tables feed the same kind, so their canonicals share one space.
  const countries = new Set(COUNTRIES.map((c) => c.geonameId));
  expect(CITIES.filter((c) => countries.has(c.geonameId))).toEqual([]);
});

test("every zone is one the host's Intl accepts", () => {
  // The bridge in spec §3.1 hands `meta.zone` to datetime, which hands it to
  // Temporal. A zone Intl rejects is a runtime throw in another package, so it
  // is caught here — at the data — rather than there.
  for (const zone of new Set(CITIES.map((c) => c.zone))) {
    expect(() => new Intl.DateTimeFormat(undefined, { timeZone: zone })).not.toThrow();
  }
});

test("every country joins to a COUNTRIES row", () => {
  // `CityRow.country` is the Value's `unit` (spec §4.1), and a unit no kind
  // registers is not a unit. A city whose country is missing would be a place
  // that cannot be formatted, converted or measured from.
  const known = new Set(COUNTRIES.map((c) => c.a2));
  for (const c of CITIES) {
    expect(c.country).toMatch(/^[a-z]{2}$/);
    expect(known.has(c.country)).toBe(true);
  }
});

test("every admin1 that is set joins to an ADMIN1 row", () => {
  // The generator blanks a code it cannot join rather than shipping a dangling
  // one, so `paris texas` is a walk that either finds a division or finds
  // nothing — never a key pointing at a row that is not there.
  const known = new Set(ADMIN1.map((a) => a.key));
  for (const c of CITIES) {
    if (c.admin1 === "") continue;
    expect(known.has(`${c.country.toUpperCase()}.${c.admin1}`)).toBe(true);
  }
});

test("every division key is a country this package knows", () => {
  const known = new Set(COUNTRIES.map((c) => c.a2));
  for (const a of ADMIN1) {
    expect(a.key).toMatch(/^[A-Z]{2}\..+$/);
    expect(known.has(a.key.slice(0, 2).toLowerCase())).toBe(true);
  }
  expect(new Set(ADMIN1.map((a) => a.key)).size).toBe(ADMIN1.length);
});

test("every division is reachable by at least one alias", () => {
  // A division nothing can name can scope nothing, so the generator drops it —
  // which is what makes `CityRow.admin1` worth carrying at all.
  for (const a of ADMIN1) expect(a.aliases.length).toBeGreaterThan(0);
});

test("every position is on the globe", () => {
  for (const c of CITIES) {
    expect(c.lat).toBeGreaterThanOrEqual(-90);
    expect(c.lat).toBeLessThanOrEqual(90);
    expect(c.lon).toBeGreaterThanOrEqual(-180);
    expect(c.lon).toBeLessThanOrEqual(180);
    // 0,0 is the Gulf of Guinea and is what a missing coordinate looks like.
    expect(c.lat === 0 && c.lon === 0).toBe(false);
  }
});

test("no city alias can shadow a unit, read as a number, or run past the trie", () => {
  for (const c of CITIES) {
    expect(c.aliases.length).toBeGreaterThan(0);
    for (const alias of c.aliases) {
      expect(alias).toBe(alias.toLowerCase());
      expect(alias).toMatch(/^[a-z][a-z0-9' -]*$/);
      // Four, where a country's floor is three: a country's alpha-2 is a code
      // and codes are exempt, and a city has no code to exempt.
      expect(alias.length).toBeGreaterThanOrEqual(4);
      // Bounded by the trie the matcher walks (spec §5.1).
      expect(alias.split(" ").length).toBeLessThanOrEqual(4);
    }
    expect(new Set(c.aliases).size).toBe(c.aliases.length);
  }
});

test("no single-word alias in either table is a reserved word", () => {
  // The filter that matters. It runs in the generator, so this is the assertion
  // that the shipped table is what the generator promised — the literal fold is
  // destructive, and a claim on "in" or "march" has no second chance.
  const offenders: string[] = [];
  for (const { name, aliases } of [...CITIES, ...ADMIN1]) {
    for (const alias of aliases) {
      if (alias.split(" ").length === 1 && RESERVED_WORDS.has(alias)) {
        offenders.push(`${name}: ${alias}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test("the ordinary English city names that are nobody's vocabulary survive", () => {
  // The reserved set is a filter on the engine's words, not on English. Nice,
  // Reading, Mobile and Split are cities of real size and no kind, keyword or
  // numeral owns any of them, so refusing them would be a cost paid for nothing.
  const has = (alias: string) => CITIES.some((c) => c.aliases.includes(alias));
  for (const alias of ["nice", "reading", "mobile", "split", "salt lake city"]) {
    expect(has(alias)).toBe(true);
  }
});

const find = (alias: string) => CITIES.find((c) => c.aliases.includes(alias));

test("Kyiv, under both spellings", () => {
  expect(find("kyiv")).toMatchObject({
    name: "Kyiv",
    country: "ua",
    admin1: "12",
    zone: "Europe/Kyiv",
    capital: true,
    geonameId: 703448,
  });
  // "kiev" is GeoNames' English alternate name, not a transliteration of another
  // script — the distinction `CITY_NAME_LANGUAGES` draws.
  expect(find("kiev")?.geonameId).toBe(703448);
});

test("a name three states share is carried three times, each with its scope", () => {
  // §6.1 ranks them and §5.2 scopes them; the data's only job is to carry all
  // three, so the ranking has something to choose between and `suggest()` has an
  // alternative to offer.
  //
  // Springfield rather than the spec's `paris texas`, which this floor does not
  // reach: Paris, Texas has 25 000 people, so at 100 000 the only Paris in the
  // table is France's and there is nothing for `texas` to scope.
  const springfields = CITIES.filter((c) => c.aliases.includes("springfield"));
  expect(springfields.map((c) => c.admin1).sort()).toEqual(["IL", "MA", "MO"]);
  for (const s of springfields) expect(s.country).toBe("us");
});

test("Texas is a division with both a name and a code", () => {
  expect(ADMIN1.find((a) => a.key === "US.TX")).toEqual({
    key: "US.TX",
    name: "Texas",
    aliases: ["texas", "tx"],
  });
});

test("a division whose code is another country's alpha-2 keeps only its name", () => {
  // "in" is India, "or" is nobody's code but is the conjunction between two
  // places, "ca" is Canada. Each would have claimed a word "paris in ukraine"
  // needs, so the code is dropped and the name stays.
  for (const key of ["US.IN", "US.OR", "US.CA"]) {
    const division = ADMIN1.find((a) => a.key === key);
    expect(division?.aliases.length).toBe(1);
  }
});
