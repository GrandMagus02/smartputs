import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/core";
import { PlaceProviderError } from "../provider";
import { geonames } from "./geonames";

/**
 * Three real bodies from `api.geonames.org`.
 *
 * `geonames-search` is `searchJSON?name_startsWith=Dar&featureClass=P&style=full
 * &maxRows=5`, `geonames-postal` is `postalCodeLookupJSON?postalcode=44657
 * &country=US`. Both were served to a real client and are byte-for-byte what
 * came back, less two edits: the JSONP wrapper their callers asked for, which
 * this provider never requests, and whitespace, since Biome formats a checked-in
 * `.json`. `geonames-status` was captured live by calling the service with the
 * `demo` account until it refused.
 *
 * The fixtures are what make the flat reads in `geonames.ts` safe, which is the
 * same argument the ECB provider's regexes rest on: if the payload's shape
 * moves, it fails here rather than in a launcher. They earn it twice over here,
 * because this service's two endpoints do not agree with each other — `lat` is a
 * string in one and a number in the other, and a postal code is `postalcode`
 * under `postalcodes` where the search endpoint beside it writes `postalCode`
 * under `postalCodes`.
 */
const search = await Bun.file(
  new URL("./geonames-search.fixture.json", import.meta.url),
).text();
const postal = await Bun.file(
  new URL("./geonames-postal.fixture.json", import.meta.url),
).text();
const limit = await Bun.file(
  new URL("./geonames-status.fixture.json", import.meta.url),
).text();

function stub(body: (url: string) => string, status = 200) {
  const urls: string[] = [];
  const fetch = (async (url: string) => {
    urls.push(url);
    return new Response(body(url), { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, urls };
}

const ok = () => stub((url) => (url.includes("postalCode") ? postal : search));

test("a search parses into places", async () => {
  const { fetch } = ok();
  const places = await geonames({ username: "smartput", fetch }).lookup("dar");
  expect(places).toHaveLength(5);

  const first = places[0];
  expect(first?.geonameId).toBe(160263);
  expect(first?.name).toBe("Dar es Salaam");
  expect(first?.country).toBe("tz");
  expect(first?.admin1).toBe("23");
  expect(first?.population).toBe(5383728);
  // Nested one level down, and only present because style=FULL was asked for.
  expect(first?.zone).toBe("Africa/Dar_es_Salaam");
  // Strings in the payload, numbers on the way out.
  expect(first?.lat).toBe(-6.82349);
  expect(first?.lon).toBe(39.26951);
});

test("the name a search matched wins over the canonical toponym", async () => {
  // Row four really is `{"toponymName":"Njeru","name":"Daru"}`: GeoNames answers
  // with the alternate name the query hit, and that is what the user typed and
  // what they should be shown back. Whichever one this file preferred would
  // have looked arbitrary without a row where they differ — there are two here.
  const { fetch } = ok();
  const places = await geonames({ username: "smartput", fetch }).lookup("dar");
  expect(places.map((p) => p.name)).toEqual([
    "Dar es Salaam",
    "Dara",
    "Daru",
    "Daru",
    "Dara",
  ]);
});

test("currency is left empty rather than guessed", async () => {
  // GeoNames has no currency field. `COUNTRIES` does, and a caller holding a
  // `country` can join it; a currency table in this entry point would be the
  // data spec §3 says it does not carry.
  const { fetch } = ok();
  const [first] = await geonames({ username: "smartput", fetch }).lookup("dar");
  expect(first?.currency).toBe("");
});

test("the username and style travel in the query string", async () => {
  const { fetch, urls } = ok();
  await geonames({ username: "smartput", fetch }).lookup("dar es salaam");
  const url = new URL(urls[0] ?? "");
  expect(url.origin).toBe("https://secure.geonames.org");
  expect(url.pathname).toBe("/searchJSON");
  expect(url.searchParams.get("username")).toBe("smartput");
  expect(url.searchParams.get("q")).toBe("dar es salaam");
  // style=FULL is not a knob: MEDIUM omits `timezone`, and a place with no zone
  // cannot serve the datetime bridge.
  expect(url.searchParams.get("style")).toBe("FULL");
  expect(url.searchParams.get("maxRows")).toBe("10");
});

test("the host is overridable and its trailing slash is not doubled", async () => {
  const { fetch, urls } = ok();
  await geonames({
    username: "u",
    url: "https://proxy.example/geo/",
    maxRows: 3,
    fetch,
  }).lookup("kyoto");
  const url = new URL(urls[0] ?? "");
  expect(url.pathname).toBe("/geo/searchJSON");
  expect(url.searchParams.get("maxRows")).toBe("3");
});

test("the postal index is a second method, not a guess about the query", async () => {
  const { fetch, urls } = ok();
  const places = await geonames({ username: "smartput", fetch }).postal("44657", "us");
  const first = places[0];
  expect(first?.postal).toBe("44657");
  expect(first?.name).toBe("Minerva");
  expect(first?.country).toBe("us");
  expect(first?.admin1).toBe("OH");
  // Numbers already, where the search endpoint sends strings.
  expect(first?.lat).toBe(40.742049);
  expect(first?.lon).toBe(-81.103076);
  // The postal index carries none of these three, and none is invented.
  expect(first?.geonameId).toBe(0);
  expect(first?.zone).toBe("");
  expect(first?.population).toBe(0);

  const url = new URL(urls[0] ?? "");
  expect(url.pathname).toBe("/postalCodeLookupJSON");
  expect(url.searchParams.get("postalcode")).toBe("44657");
  expect(url.searchParams.get("country")).toBe("US");
});

test("a postal lookup with no country is worldwide, not an error", async () => {
  const { fetch, urls } = ok();
  await geonames({ username: "smartput", fetch }).postal("44657");
  expect(new URL(urls[0] ?? "").searchParams.has("country")).toBe(false);
});

test("an exhausted quota is an error, not an empty result", async () => {
  const { fetch } = stub(() => limit);
  const call = geonames({ username: "demo", fetch }).lookup("dar");
  await expect(call).rejects.toThrow("hourly limit");
  // The service's own numeric code, carried through so a caller can branch on
  // "slow down" without matching on English.
  await expect(call).rejects.toThrow("19");
  await expect(call).rejects.toBeInstanceOf(PlaceProviderError);
});

test("the quota fixture really did arrive with a 200", () => {
  // The assertion the status branch rests on: an exhausted account, a username
  // that was never enabled and a malformed query all come back as HTTP 200 with
  // an error envelope, so `res.ok` alone reports them as no results — and a
  // caller retrying on empty spins on that forever.
  const body = JSON.parse(limit) as { status?: { value?: number } };
  expect(Object.keys(body)).toEqual(["status"]);
  expect(body.status?.value).toBe(19);
});

test("a non-200 response is an error naming the status", async () => {
  const { fetch } = stub(() => "nope", 502);
  const call = geonames({ username: "smartput", fetch }).lookup("kyoto");
  await expect(call).rejects.toThrow("502");
  await expect(call).rejects.toBeInstanceOf(SmartputError);
});

test("a response that is not JSON is an error", async () => {
  const { fetch } = stub(() => "<html>maintenance</html>");
  await expect(geonames({ username: "smartput", fetch }).lookup("kyoto")).rejects.toThrow(
    "not JSON",
  );
});

test("a payload without the expected array is an error", async () => {
  const { fetch } = stub(() => '{"totalResultsCount":0}');
  await expect(geonames({ username: "smartput", fetch }).lookup("kyoto")).rejects.toThrow(
    "no geonames array",
  );
});

test("no hits is an answer, not a failure", async () => {
  // The opposite of the ECB provider's rule, where an empty table can only mean
  // the format moved. A search for a place that does not exist has to be able
  // to say so.
  const { fetch } = stub(() => '{"totalResultsCount":0,"geonames":[]}');
  expect(await geonames({ username: "smartput", fetch }).lookup("zzzzz")).toEqual([]);
});

test("rows that all fail to parse are an error, not silence", async () => {
  // A non-empty payload yielding nothing means the field names moved under the
  // fixture, which is exactly what the fixture is here to catch.
  const { fetch } = stub(() => '{"geonames":[{"id":123,"cc":"US"}]}');
  await expect(geonames({ username: "smartput", fetch }).lookup("kyoto")).rejects.toThrow(
    "the fields this parses",
  );
});

test("the search fixture is the real response, not a hand-written stand-in", () => {
  const body = JSON.parse(search) as {
    totalResultsCount?: number;
    geonames?: Record<string, unknown>[];
  };
  expect(body.totalResultsCount).toBe(12094);
  const first = body.geonames?.[0] ?? {};
  // The types the service really sends: coordinates as strings, population as a
  // number, the zone one level down.
  expect(typeof first.lat).toBe("string");
  expect(typeof first.lng).toBe("string");
  expect(typeof first.geonameId).toBe("number");
  expect(first.timezone).toHaveProperty("timeZoneId");
  // Fields this file deliberately ignores, kept so a shape change shows in a
  // diff rather than only where it breaks something.
  expect(first).toHaveProperty("toponymName");
  expect(first).toHaveProperty("fcode");
  expect(first).toHaveProperty("adminName1");
  expect(first).toHaveProperty("alternateNames");
});

test("style=FULL is most of what a search costs, and is bought for one field", () => {
  // Recorded because it is the price of the zone: FULL is the only style that
  // carries `timezone`, and it drags every alternate name of every row along
  // with it — 88 of them here, against five places. The alternative is a
  // `timezoneJSON` call per row, which spends a credit each on an account that
  // is metered by the hour.
  const rows = (JSON.parse(search) as { geonames: { alternateNames?: unknown[] }[] })
    .geonames;
  const names = rows.reduce((n, r) => n + (r.alternateNames?.length ?? 0), 0);
  expect(names).toBe(88);
  expect(search.length).toBeGreaterThan(10_000);
});

test("the provider is identified", () => {
  expect(geonames({ username: "smartput" }).id).toBe("geonames");
});
