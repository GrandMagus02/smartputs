import { expect, test } from "bun:test";
import type { LiteralMatch, LiteralMatcher, MatchCtx } from "@smartput/core";
import { createPlaceLiteral, MIN_NAME_LENGTH, RANK_STEP } from "./matcher";
import { ADMIN1, CITIES, COUNTRIES } from "./places.fixture";
import { RESERVED_WORDS } from "./reserved";
import type { Admin1Row, CityRow, CountryRow } from "./types";

const placeLiteral = createPlaceLiteral(COUNTRIES);

function ctx(isUnitAlias: (t: string) => boolean = () => false): MatchCtx {
  return { locale: "en", now: 0, timeZone: "UTC", isUnitAlias };
}

/**
 * Every reading of the claim, ranked heaviest first, or `[]` for no claim.
 *
 * `input` with the claim's offset marked by a `|`, which the helper strips.
 *
 * M6.3 widened `LiteralMatcher` to return an array, and a matcher that has one
 * reading still returns it bare — so the shape a caller gets back depends on the
 * data, which is not something a test should have to branch on. Normalized here
 * once instead.
 */
function readingsWith(
  matcher: LiteralMatcher,
  marked: string,
  isUnitAlias?: (t: string) => boolean,
): readonly LiteralMatch[] {
  const bar = marked.indexOf("|");
  const input = bar === -1 ? marked : marked.replace("|", "");
  const result = matcher(input, bar === -1 ? 0 : bar, ctx(isUnitAlias));
  if (result === null) return [];
  return Array.isArray(result) ? result : [result as LiteralMatch];
}

/**
 * The winning reading alone, which is what almost every assertion below is
 * about: the runners-up are a `suggest()` concern and `ambiguity.test.ts` is
 * where they are asserted.
 */
function claimWith(
  matcher: LiteralMatcher,
  marked: string,
  isUnitAlias?: (t: string) => boolean,
): LiteralMatch | null {
  return readingsWith(matcher, marked, isUnitAlias)[0] ?? null;
}

function claim(marked: string, isUnitAlias?: (t: string) => boolean) {
  return claimWith(placeLiteral, marked, isUnitAlias);
}

const row = (a2: string) => COUNTRIES.find((c) => c.a2 === a2) as CountryRow;

test("claims a single-word country name", () => {
  const jp = row("jp");
  const match = claim("japan");
  expect(match).toMatchObject({
    kind: "place",
    unit: "jp",
    length: 5,
    weight: 3,
    meta: {
      geonameId: jp.geonameId,
      zone: "Asia/Tokyo",
      currency: "JPY",
      lat: jp.lat,
      lon: jp.lon,
      population: jp.population,
      country: "jp",
    },
  });
  expect(match?.canonical.toNumber()).toBe(jp.geonameId);
});

test("matches case-insensitively — normalize() keeps the user's case", () => {
  expect(claim("Japan")?.unit).toBe("jp");
  expect(claim("JAPAN")?.unit).toBe("jp");
});

test("claims a multi-word name, which is the whole reason this is a matcher", () => {
  expect(claim("united kingdom")).toMatchObject({ unit: "gb", length: 14 });
  expect(claim("new zealand")).toMatchObject({ unit: "nz", length: 11 });
  expect(claim("united arab emirates")).toMatchObject({ unit: "ae", length: 20 });
});

test("longest match wins", () => {
  // "netherlands" is nl and a prefix of "netherlands antilles", which is an.
  expect(claim("netherlands")).toMatchObject({ unit: "nl", length: 11 });
  expect(claim("netherlands antilles")).toMatchObject({ unit: "an", length: 20 });
  expect(claim("bosnia")).toMatchObject({ unit: "ba", length: 6 });
  expect(claim("bosnia and herzegovina")).toMatchObject({ unit: "ba", length: 22 });
});

test("claims alpha-2 and alpha-3 codes, written as codes", () => {
  expect(claim("JP")).toMatchObject({ unit: "jp", length: 2 });
  expect(claim("JPN")).toMatchObject({ unit: "jp", length: 3 });
  expect(claim("Gbr")).toMatchObject({ unit: "gb", length: 3 });
});

test("a lowercase code is a word, not a country", () => {
  // "and" is Andorra and "ago" is Angola, and neither is any kind's unit, so
  // `isUnitAlias` cannot see them. The fold is destructive, so claiming one
  // would leave "two hundred and five g" and "3 days ago" with no reading.
  for (const word of ["jp", "and", "ago", "is", "it", "no"]) {
    expect(claim(word)).toBeNull();
  }
  expect(claim("AND")).toMatchObject({ unit: "ad" });
});

test("never claims part of a word", () => {
  // "new" is a node on the way to "new zealand"; "newark" is not a place.
  expect(claim("newark")).toBeNull();
  expect(claim("japanese")).toBeNull();
  expect(claim("chadwick")).toBeNull();
  expect(claim("japan's")).toBeNull();
});

test("a word the trie does not carry ends the walk", () => {
  // "the" is not a node, so a stray article stops it rather than being skipped.
  expect(claim("united the kingdom")).toBeNull();
  expect(claim("new york")).toBeNull();
});

test("the walk is bounded at four words", () => {
  const four = "federation of arab emirates";
  expect(claim(four)).toMatchObject({ unit: "ae", length: four.length });

  const alias = (...aliases: string[]): CountryRow => ({ ...row("jp"), aliases });
  const bounded = createPlaceLiteral([alias("alpha beta gamma delta")]);
  const unreachable = createPlaceLiteral([alias("alpha beta gamma delta epsilon")]);

  expect(bounded("alpha beta gamma delta", 0, ctx())).toMatchObject({ length: 22 });
  // The fifth word is never offered to the trie, so a five-word alias is dead
  // data and a four-word one still claims all four.
  expect(bounded("alpha beta gamma delta epsilon", 0, ctx())).toMatchObject({
    length: 22,
  });
  expect(unreachable("alpha beta gamma delta epsilon", 0, ctx())).toBeNull();
});

test("a single-word code yields to a registered unit alias", () => {
  // "km" is Comoros' alpha-2 and a kilometre. The unit wins whichever way it is
  // written, and the fold is destructive, so yielding is the only way "10 KM"
  // survives as a length.
  expect(claim("KM")).toMatchObject({ unit: "km" });
  expect(claim("KM", (t) => t === "km")).toBeNull();
  expect(claim("GB", (t) => t === "gb")).toBeNull();
  // The exemption is for names, which are never two letters and never collide.
  expect(claim("japan", (t) => t === "japan")).toMatchObject({ unit: "jp" });
  expect(claim("united kingdom", () => true)).toMatchObject({ unit: "gb" });
});

test("a single-word code never eats a conversion keyword", () => {
  // "in" is India, "to" is Tonga, "as" is American Samoa, "by" is Belarus.
  for (const word of ["in", "to", "as", "by"]) expect(claim(word)).toBeNull();
  expect(claim("japan |to france")).toBeNull();
  expect(claim("india")).toMatchObject({ unit: "in" });
});

test("prefers the larger country when one name is two countries", () => {
  // "congo" is both Congos, "soudan" is both Mali and Sudan. §6.1 ranks by
  // population everywhere else, so it ranks here; suggest() gets the rest.
  expect(claim("congo")).toMatchObject({ unit: "cd" });
  expect(claim("soudan")).toMatchObject({ unit: "sd" });
});

test("and the smaller one is a reading behind it, not nothing", () => {
  // M6.3's note closing. Both Congos weigh a flat +3, so carrying both was an
  // AmbiguityError between two countries until RANK_STEP existed to separate
  // them; it does, so `suggest("congo")` now has a second row to list.
  expect(readingsWith(placeLiteral, "congo").map((m) => m.unit)).toEqual(["cd", "cg"]);
  expect(readingsWith(placeLiteral, "congo").map((m) => m.weight)).toEqual([3, 2.5]);
  expect(readingsWith(placeLiteral, "soudan").map((m) => m.unit)).toEqual(["sd", "ml"]);
  // Both readings are of the same span: this is one claim with two meanings,
  // not a short claim and a long one.
  for (const m of readingsWith(placeLiteral, "congo")) expect(m.length).toBe(5);
});

test("an unambiguous name is still one reading, returned bare", () => {
  // The contract takes either shape and every country but the four below has
  // exactly one reading. Wrapping those would push every caller through `[0]`
  // to say nothing, and would change what every name in the corpora returns.
  expect(Array.isArray(placeLiteral("japan", 0, ctx()))).toBe(false);
  expect(Array.isArray(placeLiteral("united kingdom", 0, ctx()))).toBe(false);
  expect(Array.isArray(placeLiteral("congo", 0, ctx()))).toBe(true);
});

test("countries of one name order by population, then by alpha-2", () => {
  // Population is §6.1's rule and the cities' rule, and it decides both real
  // cases. The alpha-2 underneath it is not a tiebreak anyone will meet — no
  // two countries of one alias have the same population — it is there so the
  // order is a fact about the data rather than about the generator's row order.
  const at = (a2: string, population: number): CountryRow => ({
    ...row("jp"),
    a2,
    population,
    aliases: ["atlantis"],
  });
  const tied = createPlaceLiteral([at("zz", 100), at("bb", 900), at("aa", 100)]);
  expect(readingsWith(tied, "atlantis").map((m) => m.unit)).toEqual(["bb", "aa", "zz"]);
});

test("every country of a name is a reading the resolver can take", () => {
  // The whole table, not the two known rows: a runner-up naming a unit the kind
  // never registered is the same resolver error a winner would be, and it is
  // the reading nobody looks at.
  const units = new Set(COUNTRIES.map((c) => c.a2));
  const seen = new Map<string, string[]>();
  for (const country of COUNTRIES) {
    for (const alias of country.aliases) {
      const readings = readingsWith(placeLiteral, alias);
      if (readings.length < 2) continue;
      seen.set(
        alias,
        readings.map((m) => m.unit),
      );
      for (const match of readings) {
        expect(units.has(match.unit)).toBe(true);
        expect(match.length).toBe(alias.length);
      }
    }
  }
  // Stated as the whole set rather than as a spot check, because the interesting
  // number is how few there are: 251 countries and only two names collide.
  expect([...seen.entries()].sort()).toEqual([
    ["congo", ["cd", "cg"]],
    ["soudan", ["sd", "ml"]],
  ]);
});

test("the names that read as ambiguous are one country each in this table", () => {
  // Probed because a name being ambiguous in English says nothing about whether
  // the gazetteer is: GeoNames gives each of these one country outright, and
  // the second meaning is a longer alias the longest-match rule already
  // separates. Recorded so a table change that makes one of them collide has to
  // come past this row.
  expect(claim("guinea")).toMatchObject({ unit: "gn" });
  expect(claim("equatorial guinea")).toMatchObject({ unit: "gq" });
  expect(claim("papua new guinea")).toMatchObject({ unit: "pg" });
  expect(claim("samoa")).toMatchObject({ unit: "ws" });
  expect(claim("american samoa")).toMatchObject({ unit: "as" });
  expect(claim("china")).toMatchObject({ unit: "cn" });
  expect(claim("republic of china")).toMatchObject({ unit: "tw" });
  expect(claim("ireland")).toMatchObject({ unit: "ie" });
  for (const name of ["guinea", "samoa", "china", "ireland"]) {
    expect(readingsWith(placeLiteral, name)).toHaveLength(1);
  }

  // Two the table gets wrong, and neither is the matcher's to fix. "virgin
  // islands" is an alias of the British ones and of nothing else, though the
  // U.S. ones are three and a half times the size and are what the phrase means
  // in American use. And neither Korea is aliased "korea" at all, so the
  // commonest name for either is unclaimable — `3pm in korea` has no reading.
  // Both are missing rows in `data/countries.ts`, which is generated and hash
  // checked; curating them here would put country data in the mechanism, where
  // `createPlaceLiteral`'s own table argument says it does not belong.
  expect(claim("virgin islands")).toMatchObject({ unit: "vg" });
  expect(claim("korea")).toBeNull();
});

test("returns null for anything it does not carry", () => {
  expect(claim("qwertz")).toBeNull();
  expect(claim("100")).toBeNull();
  expect(claim("")).toBeNull();
  expect(claim("5 + 3")).toBeNull();
  expect(placeLiteral("japan", 5, ctx())).toBeNull();
});

test("claims from an offset in the middle of the input", () => {
  expect(claim("3pm in |japan")).toMatchObject({ unit: "jp", length: 5 });
  expect(claim("100 usd in |united kingdom")).toMatchObject({ unit: "gb", length: 14 });
});

test("length always lands on a word boundary", () => {
  const inputs = [
    "japan",
    "japan + france",
    "japan - france",
    "united kingdom to japan",
    "new zealand and japan",
    "JP",
    "bosnia and herzegovina now",
    "guinea-bissau to japan",
  ];
  for (const input of inputs) {
    const match = placeLiteral(input, 0, ctx());
    expect(match).not.toBeNull();
    const length = match?.length ?? 0;
    expect(length).toBeGreaterThan(0);
    const rest = input.slice(length);
    expect(rest === "" || /^[^\p{L}\p{N}]/u.test(rest)).toBe(true);
  }
});

test("every alias the trie carries claims itself whole, for a registered unit", () => {
  const units = new Set(COUNTRIES.map((c) => c.a2));
  for (const country of COUNTRIES) {
    for (const alias of country.aliases) {
      // A code the keyword guard refuses is the one alias with no reading, and
      // every reading is checked rather than the winner alone — a runner-up
      // naming a unit the kind never registered is the same resolver error.
      for (const match of readingsWith(placeLiteral, alias)) {
        expect(units.has(match.unit)).toBe(true);
        expect(match.meta?.country).toBe(match.unit);
        expect(match.length).toBe(alias.length);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// M6.2 — cities, and scoping by admin1 or country (spec §5.2, §6.1)
// ---------------------------------------------------------------------------

const withCities = createPlaceLiteral(COUNTRIES, CITIES, ADMIN1);

function city(marked: string, isUnitAlias?: (t: string) => boolean) {
  return claimWith(withCities, marked, isUnitAlias);
}

/** Every reading of a name, for the tests that are about the runners-up. */
function cities(marked: string) {
  return readingsWith(withCities, marked);
}

const cityRow = (id: number) => CITIES.find((c) => c.geonameId === id) as CityRow;

/**
 * Paris, Texas — 25 000 people, so T1 stops well short of it: cities.ts carries
 * everything over 100 000 plus the seats of government. It is nonetheless the
 * example §5.2 and §6.1 are both written around, so it is supplied here as a
 * caller's row. `createPlaceLiteral` takes the table as an argument precisely so
 * a consumer can bring a deeper one, and the scoping rule has to hold for it.
 */
const PARIS_TX: CityRow = {
  geonameId: 4717560,
  name: "Paris",
  aliases: ["paris"],
  country: "us",
  admin1: "TX",
  lat: 33.66094,
  lon: -95.55551,
  zone: "America/Chicago",
  population: 24782,
  capital: false,
};

const withParisTx = createPlaceLiteral(COUNTRIES, [...CITIES, PARIS_TX], ADMIN1);

test("claims an unscoped city, under its country's unit", () => {
  const chicago = cityRow(4887398);
  const match = city("chicago");
  expect(match).toMatchObject({
    kind: "place",
    // The kind registers one unit per country, so a city's unit is its
    // country's and the city itself rides on the canonical.
    unit: "us",
    length: 7,
    targetable: true,
    meta: {
      geonameId: 4887398,
      // The city's own zone, not its country's, which is the whole difference
      // between "3pm in chicago" and "3pm in the united states".
      zone: "America/Chicago",
      // A city has no currency of its own; it joins to its country for one.
      currency: "USD",
      lat: chicago.lat,
      lon: chicago.lon,
      population: chicago.population,
      country: "us",
    },
  });
  expect(match?.canonical.toNumber()).toBe(4887398);
});

test("claims a multi-word city, and prefers the larger of two of the name", () => {
  // "los angeles" is Los Angeles CA and Los Ángeles CL, thirty times smaller.
  expect(city("los angeles")).toMatchObject({ length: 11, unit: "us" });
  expect(city("los angeles")?.canonical.toNumber()).toBe(5368361);
  expect(city("san francisco")).toMatchObject({ length: 13, unit: "us" });
  expect(city("san francisco")?.canonical.toNumber()).toBe(5391959);
});

test("weights are §6.1's table and nothing else", () => {
  // Capital, flat +2.
  expect(city("kyiv")?.weight).toBe(2);
  // Population-scaled, and 2.6M scales past the cap.
  expect(city("chicago")?.weight).toBe(2);
  // Population-scaled below it: log10(170188) / 3.
  expect(city("springfield")?.weight).toBeCloseTo(Math.log10(170188) / 3, 10);
  // A country outweighs every city.
  expect(city("japan")?.weight).toBe(3);
  // Scoped, flat +4 — above the country, because the user was explicit.
  expect(city("toledo ohio")?.weight).toBe(4);
});

test("scopes a city by its admin1's name", () => {
  // Toledo is Ohio, Paraná and Cebu. Naming the division is the user being
  // explicit, so it is one claim across both words rather than two literals
  // and an operator that does not exist.
  expect(city("toledo ohio")).toMatchObject({ length: 11, weight: 4, unit: "us" });
  expect(city("toledo ohio")?.canonical.toNumber()).toBe(5174035);
  expect(city("springfield illinois")).toMatchObject({ length: 20, weight: 4 });
  expect(city("springfield illinois")?.canonical.toNumber()).toBe(4250542);
  // A multi-word division is the same walk, not a second mechanism.
  expect(city("sydney nova scotia")).toMatchObject({ length: 18, weight: 4, unit: "ca" });
  expect(city("sydney nova scotia")?.canonical.toNumber()).toBe(6354908);
});

test("scopes a city by its admin1's abbreviation", () => {
  // Two lowercase letters, which `claimable` refuses everywhere else. It is safe
  // here because it is never the first word of a claim, and because ADMIN1 is
  // filtered through RESERVED_WORDS — which is why "oh" and "wa" survived while
  // Indiana's "in" and Oregon's "or" did not.
  expect(city("toledo oh")).toMatchObject({ length: 9, weight: 4 });
  expect(city("toledo oh")?.canonical.toNumber()).toBe(5174035);
  expect(city("vancouver wa")).toMatchObject({ length: 12, weight: 4, unit: "us" });
  expect(city("vancouver wa")?.canonical.toNumber()).toBe(5814616);
  // Unscoped the same name is the Canadian one, six times the size.
  expect(city("vancouver")?.canonical.toNumber()).toBe(6173331);
});

test("scopes a city by its country", () => {
  expect(city("paris france")).toMatchObject({ length: 12, weight: 4, unit: "fr" });
  expect(city("paris france")?.canonical.toNumber()).toBe(2988507);
  expect(city("sydney australia")).toMatchObject({ length: 16, weight: 4, unit: "au" });
  expect(city("sydney australia")?.canonical.toNumber()).toBe(2147714);
  // The country has to be one this name is actually in. Toledo, Spain is under
  // the T1 floor, so no Toledo is Spanish: the city claims alone and "spain" is
  // left for a claim of its own rather than being eaten by a scope that failed.
  expect(city("toledo spain")).toMatchObject({ length: 6, unit: "us" });
});

test("a city scopes by the smaller country of a name that is two of them", () => {
  // Brazzaville is in the Republic of the Congo, the runner-up of "congo" and
  // unreachable while the node held one country: the scope asked the DRC for a
  // Brazzaville, missed, and degraded to the unscoped city. It walks both now,
  // in that same population order, so the largest Congo that actually holds a
  // city of the name is the one that scopes.
  expect(city("brazzaville congo")).toMatchObject({ length: 17, weight: 4, unit: "cg" });
  expect(city("brazzaville congo")?.canonical.toNumber()).toBe(2260535);
  expect(city("kinshasa congo")).toMatchObject({ length: 14, weight: 4, unit: "cd" });
  expect(city("kinshasa congo")?.canonical.toNumber()).toBe(2314302);
});

test("paris texas is one literal, and paris alone is the French one", () => {
  expect(claimWith(withParisTx, "paris texas")).toMatchObject({
    length: 11,
    weight: 4,
    unit: "us",
  });
  expect(claimWith(withParisTx, "paris texas")?.canonical.toNumber()).toBe(4717560);
  expect(claimWith(withParisTx, "paris tx")).toMatchObject({ length: 8, weight: 4 });
  expect(claimWith(withParisTx, "paris tx")?.canonical.toNumber()).toBe(4717560);

  // Unscoped, §6.1 ranks a capital of 2.1M over a county seat of 25 000.
  expect(claimWith(withParisTx, "paris")).toMatchObject({
    length: 5,
    weight: 2,
    unit: "fr",
  });
  expect(claimWith(withParisTx, "paris")?.canonical.toNumber()).toBe(2988507);
  expect(claimWith(withParisTx, "paris france")?.canonical.toNumber()).toBe(2988507);
});

test("a scope the shipped table cannot express degrades to the unscoped city", () => {
  // "springfield il" is §5.2's own example and it does not scope, because
  // Illinois ships no "il": "il" is Israel's alpha-2 and RESERVED_WORDS carries
  // every country short code, so the generator took it. The claim degrades to
  // the unscoped city rather than to nothing, which is the difference between a
  // worse reading and no reading at all.
  expect(ADMIN1.find((a) => a.key === "US.IL")?.aliases).not.toContain("il");
  expect(city("springfield il")).toMatchObject({ length: 11 });
  expect(city("springfield il")?.canonical.toNumber()).toBe(4409896);

  // The walk itself is indifferent to which alias a division carries.
  const il: Admin1Row = { key: "US.IL", name: "Illinois", aliases: ["illinois", "il"] };
  const loose = createPlaceLiteral(COUNTRIES, CITIES, [...ADMIN1, il]);
  expect(claimWith(loose, "springfield il")).toMatchObject({ length: 14, weight: 4 });
  expect(claimWith(loose, "springfield il")?.canonical.toNumber()).toBe(4250542);
});

test("unscoped, the heaviest city of a name wins", () => {
  // Springfield is Missouri, Massachusetts and Illinois, none of them a capital,
  // so §6.1's population scale is the only thing separating them.
  expect(city("springfield")?.canonical.toNumber()).toBe(4409896);
  expect(city("toledo")?.canonical.toNumber()).toBe(5174035);
});

test("the losers of that ranking survive as readings behind it", () => {
  // §12.3's first defect, closed: the contract returns every reading of the
  // span, so all three Springfields reach the solver and `suggest()` has
  // something to list.
  expect(cities("springfield").map((m) => m.canonical.toNumber())).toEqual([
    4409896, 4951788, 4250542,
  ]);
  // A country claims first and the city of the name is the runner-up, where in
  // M6.2 the country returned and the city did not exist.
  expect(cities("singapore").map((m) => m.weight)).toEqual([3, 2]);
});

test("readings of one span are spaced so the ranking survives being scored", () => {
  // The winner keeps §6.1's own figure — it is what leaves this package to be
  // scored against another kind — and every reading behind it is clamped to at
  // least RANK_STEP below its predecessor.
  const jose = cities("san jose");
  // Ranked +2 (capital) over +1.9996 (population), which is a decided ranking
  // and a coin flip once softmaxed. Spacing is what keeps `evaluate` deciding.
  expect(jose[0]?.weight).toBe(2);
  expect(jose.map((m) => m.weight ?? 0)).toEqual([2, 1.5, 1]);

  for (const name of ["springfield", "athens", "los angeles", "singapore"]) {
    const weights = cities(name).map((m) => m.weight ?? 0);
    expect(weights.length).toBeGreaterThan(1);
    for (let i = 1; i < weights.length; i += 1) {
      expect((weights[i - 1] as number) - (weights[i] as number)).toBeGreaterThanOrEqual(
        RANK_STEP,
      );
    }
  }

  // Clamped down, never lifted: a reading already far enough below its
  // predecessor keeps the weight §6.1 gives it.
  expect(cities("singapore")[1]?.weight).toBe(2);
});

test("a country outranks a city of the same name", () => {
  // Twenty-one city aliases are also country aliases. §6.1 puts a country at +3
  // and no city above +2, so the country takes all of them and "singapore to
  // japan" stays the distance between two countries.
  expect(city("singapore")).toMatchObject({ unit: "sg", weight: 3 });
  expect(city("monaco")).toMatchObject({ unit: "mc", weight: 3 });
  expect(city("salvador")).toMatchObject({ unit: "sv", weight: 3 });
});

test("a reserved word is never claimed as a city", () => {
  // The shipped table contains none of them: the generator applies
  // RESERVED_WORDS before emitting. The matcher applies it again on the way out
  // so a caller's own table cannot smuggle one in — the fold is destructive, and
  // a rule enforced only at build time is a rule the next table skips.
  for (const word of ["march", "may", "of", "same", "and", "ago", "one", "km"]) {
    expect(city(word)).toBeNull();
  }

  const march: CityRow = { ...cityRow(4887398), name: "March", aliases: ["march"] };
  const smuggled = createPlaceLiteral(COUNTRIES, [march], ADMIN1);
  expect(RESERVED_WORDS.has("march")).toBe(true);
  expect(claimWith(smuggled, "march")).toBeNull();
});

test("an ordinary English word that is a real city is still claimed", () => {
  // Nice, Mobile and Reading are 180 000 to 340 000 people and none of them is
  // in RESERVED_WORDS, because that set is derived — it holds the words some
  // package in this repo owns, and no package owns an adjective. So opting into
  // CITIES means "reading" reads as a place.
  //
  // Recorded rather than patched. A hand-written denylist here is the thing
  // `reserved.ts` exists to refuse, and it would be refusing a claim that
  // destroys nothing: no expression this engine parses contains "nice" or
  // "reading", and the shipped `place` carries no cities at all, so the corpora
  // are not exposed. If that changes, the fix is a source in the generator.
  expect(city("nice")).toMatchObject({ unit: "fr" });
  expect(city("reading")).toMatchObject({ unit: "gb" });
  expect(city("mobile")).toMatchObject({ unit: "us" });
  for (const word of ["nice", "reading", "mobile"]) {
    expect(RESERVED_WORDS.has(word)).toBe(false);
    // And the kind that ships by default has never heard of any of them.
    expect(claim(word)).toBeNull();
  }
});

test("a single-word city no longer yields to a registered unit alias", () => {
  // M6.2's behaviour, inverted on purpose: `cityClaimable` consulted
  // `isUnitAlias` and refused, which is spec §6.3's defect. Yielding was the
  // only non-destructive answer while the fold kept one claim per offset —
  // claiming "tokyo" took datetime's zone away and refusing it took the city
  // away. The fold now keeps the word beside the claim, so there is nothing left
  // to yield to and the solver ranks both readings. `ambiguity.test.ts` asserts
  // the engine-level half.
  expect(city("chicago", (t) => t === "chicago")).toMatchObject({ unit: "us" });
  // M6.1's exemption is for country *names*, and it survives cities joining the
  // trie untouched.
  expect(city("japan", () => true)).toMatchObject({ unit: "jp" });
  expect(city("united kingdom", () => true)).toMatchObject({ unit: "gb" });
  // What still refuses is `RESERVED_WORDS`, which is not a reading to be ranked:
  // "march" competes with a numeral, and a numeral never reaches the solver as a
  // candidate at all.
  expect(city("march", () => false)).toBeNull();
});

test("a city shorter than MIN_NAME_LENGTH is never a single-word claim", () => {
  const ufa: CityRow = { ...cityRow(4887398), name: "Ufa", aliases: ["ufa"] };
  const short = createPlaceLiteral(COUNTRIES, [ufa], ADMIN1);
  expect("ufa".length).toBeLessThan(MIN_NAME_LENGTH);
  expect(claimWith(short, "ufa")).toBeNull();
});

test("a scope never eats a conversion keyword", () => {
  // Nuku'alofa is Tongan and Tonga's alpha-2 is "to", so a scope walk that did
  // not stop at a keyword would claim "nuku'alofa to" as a scoped city and take
  // the distance query's operator with it. Nothing recovers it afterwards.
  expect(city("nuku'alofa to japan")).toMatchObject({ length: 10, unit: "to" });
  expect(city("kyiv to warsaw")).toMatchObject({ length: 4, unit: "ua" });
  expect(city("chicago in tokyo")).toMatchObject({ length: 7, unit: "us" });
});

test("never claims part of a word, with cities in the trie", () => {
  expect(city("chicagoland")).toBeNull();
  expect(city("parisian")).toBeNull();
  expect(city("chicago's")).toBeNull();
  // A scope has the same boundary: "ohio" is a whole word or it is not a scope.
  expect(city("toledo ohioan")).toMatchObject({ length: 6 });
});

test("the whole claim, scope included, is still bounded at four words", () => {
  const four = "sydney new south wales";
  expect(city(four)).toMatchObject({ length: four.length, weight: 4, unit: "au" });
  expect(city(four)?.canonical.toNumber()).toBe(2147714);
});

test("countries-only construction behaves exactly as it did in M6.1", () => {
  // Every test above this comment runs on the one-argument form, which is the
  // form `place` calls; this says the two extra arguments default to nothing
  // rather than to an empty-but-different code path.
  const empty = createPlaceLiteral(COUNTRIES, [], []);
  const probes = [
    "japan",
    "united kingdom",
    "new zealand",
    "netherlands antilles",
    "JP",
    "and",
    "chicago",
    "paris",
    "los angeles",
    "toledo ohio",
    "kyiv to warsaw",
    "bosnia and herzegovina",
    // Two readings rather than one, and `toEqual` covers both: a claim that
    // grew a runner-up has to grow the same one either way it is constructed.
    "congo",
  ];
  for (const probe of probes) {
    expect(empty(probe, 0, ctx())).toEqual(placeLiteral(probe, 0, ctx()));
  }
  // And a city is not a country, so the countries-only matcher has never heard
  // of one. This is the behaviour `place` and M6.1's tests depend on.
  for (const probe of ["chicago", "paris", "kyiv", "los angeles", "toledo ohio"]) {
    expect(placeLiteral(probe, 0, ctx())).toBeNull();
  }
});

test("adding cities takes no country alias away from its country", () => {
  // The destructive direction, checked over the whole table rather than by
  // spot check: a city may lengthen a claim that started at a country's node,
  // but a country alias standing alone must still resolve to its country.
  const stolen: string[] = [];
  for (const country of COUNTRIES) {
    for (const alias of country.aliases) {
      const before = claimWith(placeLiteral, alias);
      if (before === null) continue;
      // The winner, which is the reading that decides. A country alias picking
      // up a city runner-up behind it — "singapore" does — takes nothing away.
      const after = claimWith(withCities, alias);
      if (after?.unit !== before.unit || after.length !== before.length) {
        stolen.push(`${alias}: ${before.unit} -> ${after?.unit ?? "null"}`);
      }
    }
  }
  expect(stolen).toEqual([]);
});

/**
 * What the scanner can produce: words of letters, digits and marks, joined by
 * single spaces, with `-` and `'` allowed only *between* two of those. A `'` at
 * either end of a word is not part of it, which is the rule that keeps "japan's"
 * out of the trie and "japan - france" three tokens.
 */
const TOKENIZABLE = (() => {
  const word = String.raw`[\p{L}\p{N}\p{M}]+(?:['-][\p{L}\p{N}\p{M}]+)*`;
  return new RegExp(`^${word}(?: ${word})*$`, "u");
})();

test("a city alias claims itself whole exactly when the scanner can produce it", () => {
  const units = new Set(COUNTRIES.map((c) => c.a2));
  const unread: string[] = [];
  for (const c of CITIES) {
    for (const alias of c.aliases) {
      const match = claimWith(withCities, alias);
      if (match === null || match.length !== alias.length) {
        unread.push(alias);
        continue;
      }
      // A city may lose its alias to a country — "singapore" does — but the
      // claim still has to name a unit the kind registered.
      expect(units.has(match.unit)).toBe(true);
      expect(match.meta?.country).toBe(match.unit);
    }
  }

  // Stated as an equality rather than as a skip, because the two sides come
  // from opposite ends: the left is what the trie failed to read back, the
  // right is what the scanner says it could never have offered. Anything that
  // falls out of the trie for some *other* reason lands here as a failure.
  //
  // Two reasons, not one. An alias the scanner could never offer is the first;
  // the length floor is the second, and it is deliberate — the trie refuses
  // anything under `MIN_NAME_LENGTH` so that a three-letter city cannot outrank
  // the unit whose alias the user was halfway through typing. "ufa" is the
  // fixture's example, reachable as a scoped claim and never on its own.
  const aliases = CITIES.flatMap((c) => c.aliases);
  const untokenizable = aliases.filter((a) => !TOKENIZABLE.test(a));
  const belowFloor = aliases.filter(
    (a) => TOKENIZABLE.test(a) && a.length < MIN_NAME_LENGTH,
  );
  expect(unread.sort()).toEqual([...untokenizable, ...belowFloor].sort());
  // Every untokenizable alias is one for the same reason it was in the shipped
  // gazetteer: a transliteration carrying an apostrophe or a hyphen at the edge
  // of a word — "kazan'", "samarra'", "al 'ashir min ramadan". Widening the
  // scanner to take an edge apostrophe would widen it for every kind's input, to
  // spell a handful of names, so the fix belongs in the generator.
  for (const alias of untokenizable) expect(alias).toMatch(/['-]/);
  // And the floor catches only what it is meant to: a short alias, never a long
  // one that fell out of the trie for a reason nobody named.
  for (const alias of belowFloor) expect(alias.length).toBeLessThan(MIN_NAME_LENGTH);
});
