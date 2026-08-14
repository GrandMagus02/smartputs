import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/core";
import { PlaceProviderError } from "../place";
import { GeoNames, geonames, toCountry, toPlace } from "./geonames";

/**
 * Six bodies, and the header says plainly which are which, because a fixture
 * that is trusted more than it deserves is worse than no fixture at all.
 *
 * **Captured live**, byte-for-byte less the JSONP wrapper their callers asked
 * for and whitespace Biome reformats: `geonames-search`
 * (`searchJSON?name_startsWith=Dar&featureClass=P&style=full&maxRows=5`),
 * `geonames-postal` (`postalCodeLookupJSON?postalcode=44657&country=US`), and
 * `geonames-status`, taken by calling the service with the `demo` account until
 * it refused.
 *
 * **Transcribed from the documented payloads** rather than captured, because the
 * `demo` account's daily credits were exhausted when they were written:
 * `geonames-country`, `geonames-children` and `geonames-timezone`. They pin the
 * field names and the string-or-number split this parser turns on, which is what
 * a fixture is for here, but they are not evidence about a live response and a
 * reader should not treat them as such.
 *
 * What all six earn is the argument the ECB provider's two regexes rest on: if
 * a payload's shape moves, it fails here rather than in a launcher. They earn it
 * twice over, because this service's endpoints do not agree with each other —
 * `lat` is a string in the search index and a number in the postal one, and a
 * code is `postalcode` under `postalcodes` where the endpoint beside it writes
 * `postalCode` under `postalCodes`.
 */
const load = (name: string): Promise<string> =>
  Bun.file(new URL(`./geonames-${name}.fixture.json`, import.meta.url)).text();

const search = await load("search");
const postal = await load("postal");
const status = await load("status");
const country = await load("country");
const children = await load("children");
const timezone = await load("timezone");

function stub(body: (url: string) => string, httpStatus = 200) {
  const urls: string[] = [];
  const fetch = (async (url: string) => {
    urls.push(url);
    return new Response(body(url), { status: httpStatus });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, urls };
}

/** Routed on the path, so one stub serves every endpoint a test touches. */
function router(): ReturnType<typeof stub> {
  return stub((url) => {
    if (url.includes("postalCodeLookupJSON")) return postal;
    if (url.includes("countryInfoJSON")) return country;
    if (url.includes("childrenJSON")) return children;
    if (url.includes("timezoneJSON")) return timezone;
    return search;
  });
}

test("search returns hits carrying the matched name and the source", async () => {
  const { fetch, urls } = router();
  const hits = await geonames({ username: "u", fetch }).search("Dar");

  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0]?.source).toBe("geonames");
  expect(hits[0]?.matched).not.toBe("");
  expect(hits[0]?.place.country).toBe(hits[0]?.place.country.toLowerCase());
  // The score is the ranker's to assign, never the provider's — the header of
  // `rank.ts` says why a provider's own number cannot be one.
  expect(hits[0]?.score).toBe(0);
  expect(urls[0]).toContain("style=FULL");
  expect(urls[0]).toContain("username=u");
});

test("the default host is secure.geonames.org, not the api. one the docs print", async () => {
  const { fetch, urls } = router();
  await geonames({ username: "u", fetch }).search("Dar");
  // `api.geonames.org` resolves, but its certificate names only `secure`, so
  // every https request to it fails the hostname check.
  expect(urls[0]).toStartWith("https://secure.geonames.org/");
});

test("a kind filter becomes a featureClass upstream and a sieve on the way back", async () => {
  const { fetch, urls } = router();
  const hits = await geonames({ username: "u", fetch }).search({
    text: "Dar",
    kinds: ["water"],
  });

  expect(urls[0]).toContain("featureClass=H");
  // The fixture is class P throughout, so asking for rivers must return none of
  // it — the upstream filter is a request, not a guarantee.
  expect(hits).toEqual([]);
});

test("countries reads the alpha-3, the currency and the postal mask", async () => {
  const { fetch } = router();
  const rows = await geonames({ username: "u", fetch }).countries();

  const ua = rows.find((r) => r.a2 === "ua");
  expect(ua?.a3).toBe("ukr");
  expect(ua?.name).toBe("Ukraine");
  expect(ua?.capital).toBe("Kyiv");
  expect(ua?.currency).toBe("UAH");
  expect(ua?.postalFormat).toBe("#####");
  // Strings upstream, numbers here.
  expect(ua?.population).toBe(44622516);
  expect(ua?.area).toBe(603700);
  expect(ua?.bbox).toEqual([22.128889, 44.3865852, 40.2275280956001, 52.3797]);
});

test("a country with no legal tender keeps an empty currency rather than a guess", async () => {
  const { fetch } = router();
  const rows = await geonames({ username: "u", fetch }).countries();
  expect(rows.find((r) => r.a2 === "aq")?.currency).toBe("");
});

test("children is how the divisions of a country are enumerated", async () => {
  const { fetch, urls } = router();
  const nodes = await geonames({ username: "u", fetch }).children(690791);

  expect(nodes.map((n) => n.place.name)).toEqual(["Vinnytsia Oblast", "Kyiv City"]);
  expect(nodes.every((n) => n.kind === "admin")).toBe(true);
  expect(nodes[0]?.featureCode).toBe("ADM1");
  expect(nodes[0]?.place.admin1).toBe("05");
  // Coordinates arrive as strings on this endpoint.
  expect(nodes[1]?.place.lat).toBeCloseTo(50.45466, 4);
  expect(urls[0]).toContain("geonameId=690791");
});

test("timezone answers the bridge's question and lowercases the country", async () => {
  const { fetch } = router();
  const zone = await geonames({ username: "u", fetch }).timezone({
    lat: 50.45,
    lon: 30.52,
  });

  expect(zone).toEqual({
    zone: "Europe/Kyiv",
    country: "ua",
    rawOffset: 2,
    dstOffset: 3,
  });
});

test("a postal row carries the code and invents no id, population or zone", async () => {
  const { fetch } = router();
  const places = await geonames({ username: "u", fetch }).postal("44657", "us");

  expect(places[0]?.postal).toBe("44657");
  expect(places[0]?.name).toBe("Minerva");
  expect(places[0]?.country).toBe("us");
  expect(places[0]?.geonameId).toBe(0);
  expect(places[0]?.population).toBe(0);
  expect(places[0]?.zone).toBe("");
});

test("an error envelope arrives with HTTP 200 and is still an error", async () => {
  const { fetch } = stub(() => status);
  const provider = geonames({ username: "u", fetch });

  // The whole point: `res.ok` is true here. An exhausted quota, a username that
  // was never enabled and a malformed query all look like a successful request.
  await expect(provider.search("Dar")).rejects.toThrow(PlaceProviderError);
  await expect(provider.search("Dar")).rejects.toThrow(/19/);
});

test("provider errors are SmartputErrors, which is what consumers branch on", async () => {
  const { fetch } = stub(() => "not json at all");
  await expect(geonames({ username: "u", fetch }).search("Dar")).rejects.toThrow(
    SmartputError,
  );
});

test("an HTTP failure names the status", async () => {
  const { fetch } = stub(() => "", 503);
  await expect(geonames({ username: "u", fetch }).search("Dar")).rejects.toThrow(/503/);
});

test("an empty result set is an answer, not a failure", async () => {
  const { fetch } = stub(() => JSON.stringify({ geonames: [] }));
  expect(await geonames({ username: "u", fetch }).search("nowhere")).toEqual([]);
});

test("rows that arrive but do not parse are a failure, not silence", async () => {
  // A non-empty payload none of whose rows carry an id: the shape moved under
  // the fixture, and returning [] would report it as "no such place".
  const { fetch } = stub(() => JSON.stringify({ geonames: [{ nope: 1 }] }));
  await expect(geonames({ username: "u", fetch }).search("Dar")).rejects.toThrow(
    /carried the fields/,
  );
});

test("lang travels from the constructor and a query overrides it", async () => {
  const { fetch, urls } = router();
  const provider = geonames({ username: "u", fetch, lang: "en" });
  await provider.search("Dar");
  await provider.search({ text: "Dar", lang: "uk" });

  expect(urls[0]).toContain("lang=en");
  expect(urls[1]).toContain("lang=uk");
});

test("toPlace and toCountry are pure and testable without a client", () => {
  expect(toPlace({ geonameId: 1, name: "X", lat: "1.5", lng: 2 })).toMatchObject({
    geonameId: 1,
    name: "X",
    lat: 1.5,
    lon: 2,
    // A country-level fact, and this is not a country row.
    currency: "",
  });
  expect(toPlace({ name: "no id" })).toBeNull();
  expect(toCountry({ countryCode: "FR" })).toBeNull();
});

test("lookup is the narrow interface the split shipped, over the same request", async () => {
  const { fetch } = router();
  const places = await new GeoNames({ username: "u", fetch }).lookup("Dar");
  expect(places.length).toBeGreaterThan(0);
  expect(places[0]).toHaveProperty("geonameId");
});
