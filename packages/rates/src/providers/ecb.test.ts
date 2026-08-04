import { expect, test } from "bun:test";
import { ecb } from "./ecb";

const xml = await Bun.file(new URL("./ecb-daily.fixture.xml", import.meta.url)).text();

const stubFetch = (async () =>
  new Response(xml, { status: 200 })) as unknown as typeof globalThis.fetch;

test("the provider parses the daily file into a snapshot", async () => {
  const rates = await ecb({ fetch: stubFetch }).fetch();
  expect(rates.base).toBe("EUR");
  expect(rates.asOf).toBe("2026-08-04");
  expect(rates.get("EUR", "USD")?.toString()).toBe("1.1");
  expect(rates.get("USD", "EUR")?.toString()).toBe("0.9090909090909090909090909091");
});

test("every currency in the file is present", () => {
  expect(xml.match(/currency='/g)).toHaveLength(6);
});

test("cross rates work off the parsed table", async () => {
  const rates = await ecb({ fetch: stubFetch }).fetch();
  expect(rates.get("USD", "UAH")?.toString()).toBe("41.36363636363636363636363636");
});

test("a currency absent from the file is null", async () => {
  const rates = await ecb({ fetch: stubFetch }).fetch();
  expect(rates.get("EUR", "NZD")).toBeNull();
});

test("a non-200 response is an error naming the status", async () => {
  const failing = (async () =>
    new Response("nope", { status: 503 })) as unknown as typeof globalThis.fetch;
  await expect(ecb({ fetch: failing }).fetch()).rejects.toThrow("503");
});

test("a response missing the date is an error, not a silent empty table", async () => {
  const garbage = (async () =>
    new Response("<html>maintenance</html>", {
      status: 200,
    })) as unknown as typeof globalThis.fetch;
  await expect(ecb({ fetch: garbage }).fetch()).rejects.toThrow();
});

test("the provider is identified", () => {
  expect(ecb().id).toBe("ecb");
});
