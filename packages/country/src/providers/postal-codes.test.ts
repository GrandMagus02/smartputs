import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/core";
import { PlaceProviderError } from "../provider";
import { postalCodes } from "./postal-codes";

/**
 * Rows lifted verbatim from the zauberware collection's own `US.zip` and
 * `GB.zip` (CC BY 4.0) — same key names, same string-typed coordinates, same
 * empty columns. The fixture is what makes the flat read in `postal-codes.ts`
 * safe: if the export's column names move, it fails here and not in a launcher.
 */
const US = "https://mirror.example/data/{COUNTRY}.json";
const usFile = await Bun.file(
  new URL("./postal-codes-us.fixture.json", import.meta.url),
).text();
const gbFile = await Bun.file(
  new URL("./postal-codes-gb.fixture.json", import.meta.url),
).text();

/** Records every url asked for, so the cache and the template are observable. */
function stub(body: (url: string) => string | undefined) {
  const urls: string[] = [];
  const fetch = (async (url: string) => {
    urls.push(url);
    const text = body(url);
    return text === undefined
      ? new Response("not found", { status: 404 })
      : new Response(text, { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, urls };
}

const both = () =>
  stub((url) => (url.includes("GB") ? gbFile : url.includes("US") ? usFile : undefined));

test("a country-qualified code resolves to the place", async () => {
  const { fetch } = both();
  const [place] = await postalCodes({ url: US, fetch }).lookup("us 90210");
  expect(place?.name).toBe("Beverly Hills");
  expect(place?.country).toBe("us");
  expect(place?.admin1).toBe("CA");
  expect(place?.postal).toBe("90210");
  // Strings in the file, numbers on the way out.
  expect(place?.lat).toBe(34.0901);
  expect(place?.lon).toBe(-118.4065);
});

test("spec §6.2's other form is the same query", async () => {
  const { fetch } = both();
  const provider = postalCodes({ url: US, fetch });
  const [suffixed] = await provider.lookup("90210 us");
  expect(suffixed?.name).toBe("Beverly Hills");
});

test("a configured country answers a bare code", async () => {
  const { fetch } = both();
  const [place] = await postalCodes({ url: US, country: "us", fetch }).lookup("90210");
  expect(place?.name).toBe("Beverly Hills");
});

test("a bare code with no country configured is an error, not a guess", async () => {
  const { fetch } = both();
  const call = postalCodes({ url: US, fetch }).lookup("1000");
  await expect(call).rejects.toThrow("names no country");
  await expect(call).rejects.toBeInstanceOf(PlaceProviderError);
});

test("one code can carry several places", async () => {
  // 96860 is two real rows: Joint Base Pearl Harbor and the fleet post office
  // sharing it. A lookup that returned the first would hide the second.
  const { fetch } = both();
  const places = await postalCodes({ url: US, fetch }).lookup("us 96860");
  expect(places.map((p) => p.name)).toEqual(["Jbphh", "FPO AA"]);
});

test("a code the country does not use is empty, not an error", async () => {
  const { fetch } = both();
  expect(await postalCodes({ url: US, fetch }).lookup("us 00000")).toEqual([]);
});

test("the code is matched case- and whitespace-insensitively", async () => {
  const { fetch } = both();
  const places = await postalCodes({ url: US, fetch }).lookup("  us   90210 ");
  expect(places).toHaveLength(1);
});

test("a two-letter country is stripped from either end and nothing else is", async () => {
  // "SW1A 1AA" is two tokens and neither is two letters, so the code survives
  // whole — which is the whole reason the split is by token length and not by
  // position. That it then finds nothing is the collection's granularity, not a
  // parse failure: GB rows are outward codes, "SW1A", with no inward half.
  const { fetch } = both();
  const provider = postalCodes({ url: US, fetch });
  expect(await provider.lookup("gb SW1A 1AA")).toEqual([]);
  const [outward] = await provider.lookup("gb SW1A");
  expect(outward?.name).toBe("Westminster Abbey");
  expect(outward?.country).toBe("gb");
});

test("the country is substituted into the url, cased as the placeholder is", async () => {
  const upper = both();
  await postalCodes({ url: US, fetch: upper.fetch }).lookup("us 90210");
  expect(upper.urls[0]).toBe("https://mirror.example/data/US.json");

  const lower = stub(() => usFile);
  await postalCodes({
    url: "https://mirror.example/{country}/zipcodes.{country}.json",
    fetch: lower.fetch,
  }).lookup("us 90210");
  expect(lower.urls[0]).toBe("https://mirror.example/us/zipcodes.us.json");
});

test("a url naming no country is fetched as it stands", async () => {
  const single = stub(() => usFile);
  await postalCodes({
    url: "https://mirror.example/zipcodes.json",
    country: "us",
    fetch: single.fetch,
  }).lookup("90210");
  expect(single.urls).toEqual(["https://mirror.example/zipcodes.json"]);
});

test("a country file is downloaded once however many codes are asked for", async () => {
  const { fetch, urls } = both();
  const provider = postalCodes({ url: US, fetch });
  await provider.lookup("us 90210");
  await provider.lookup("us 10001");
  await provider.lookup("gb SW1A");
  expect(urls).toHaveLength(2);
});

test("concurrent lookups on a cold country share one request", async () => {
  const { fetch, urls } = both();
  const provider = postalCodes({ url: US, fetch });
  await Promise.all([
    provider.lookup("us 90210"),
    provider.lookup("us 10001"),
    provider.lookup("us 01001"),
  ]);
  expect(urls).toHaveLength(1);
});

test("a failed download is not cached, so the next call retries", async () => {
  let attempts = 0;
  const flaky = (async () => {
    attempts += 1;
    return attempts === 1 ? new Response("nope", { status: 503 }) : new Response(usFile);
  }) as unknown as typeof globalThis.fetch;

  const provider = postalCodes({ url: US, fetch: flaky });
  await expect(provider.lookup("us 90210")).rejects.toThrow("503");
  const [place] = await provider.lookup("us 90210");
  expect(place?.name).toBe("Beverly Hills");
  expect(attempts).toBe(2);
});

test("a non-200 response is an error naming the status and the country", async () => {
  const { fetch } = both();
  const call = postalCodes({ url: US, fetch }).lookup("fr 75001");
  await expect(call).rejects.toThrow("404");
  await expect(call).rejects.toThrow("fr");
  await expect(call).rejects.toBeInstanceOf(SmartputError);
});

test("a mirror serving something that is not an array of rows is an error", async () => {
  const html = stub(() => "<html>maintenance</html>");
  const call = postalCodes({ url: US, fetch: html.fetch }).lookup("us 90210");
  await expect(call).rejects.toThrow("not JSON");
  await expect(call).rejects.toBeInstanceOf(PlaceProviderError);

  const object = stub(() => '{"places":[]}');
  await expect(
    postalCodes({ url: US, fetch: object.fetch }).lookup("us 90210"),
  ).rejects.toThrow("not an array");
});

test("an empty country file is an error, not a country with no postal codes", async () => {
  const empty = stub(() => "[]");
  await expect(
    postalCodes({ url: US, fetch: empty.fetch }).lookup("us 90210"),
  ).rejects.toThrow("carried no rows");
});

test("a file whose rows lost the zipcode column is an error, not silence", async () => {
  const renamed = stub(
    () => '[{"country_code":"US","postal_code":"90210","place":"Beverly Hills"}]',
  );
  await expect(
    postalCodes({ url: US, fetch: renamed.fetch }).lookup("us 90210"),
  ).rejects.toThrow("carried a zipcode");
});

test("the fixture is the real export, not a hand-written stand-in", () => {
  const rows = JSON.parse(usFile) as Record<string, unknown>[];
  expect(rows).toHaveLength(5);
  // Every column the upstream file has, including the three this file ignores:
  // if a future row drops one, the shape has moved and the parser wants a look.
  expect(Object.keys(rows[0] ?? {})).toEqual([
    "country_code",
    "zipcode",
    "place",
    "state",
    "state_code",
    "province",
    "province_code",
    "community",
    "community_code",
    "latitude",
    "longitude",
  ]);
  expect(typeof rows[0]?.latitude).toBe("string");
});

test("the provider is identified", () => {
  expect(postalCodes({ url: US }).id).toBe("postal-codes");
});
