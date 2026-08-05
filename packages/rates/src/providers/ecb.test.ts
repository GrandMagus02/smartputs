import { expect, test } from "bun:test";
import { RateProviderError, SmartputError } from "@smartput/core";
import { snapshot } from "../snapshot";
import { custom, ecb } from "./ecb";

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
  // Spec §7: every error in this codebase extends SmartputError, which is what
  // engine.ts branches on. A bare Error here is invisible to a consumer that
  // follows that convention.
  await expect(ecb({ fetch: failing }).fetch()).rejects.toBeInstanceOf(RateProviderError);
});

test("a response missing the date is an error, not a silent empty table", async () => {
  const garbage = (async () =>
    new Response("<html>maintenance</html>", {
      status: 200,
    })) as unknown as typeof globalThis.fetch;
  await expect(ecb({ fetch: garbage }).fetch()).rejects.toThrow();
  await expect(ecb({ fetch: garbage }).fetch()).rejects.toBeInstanceOf(SmartputError);
});

test("a response with a valid date but no currency quotes is an error, not a silent empty snapshot", async () => {
  const dateOnly = (async () =>
    new Response(
      "<gesmes:Envelope xmlns:gesmes='http://www.gesmes.org/xml/2002-08-01' xmlns='http://www.ecb.int/vocabulary/2002-08-01/eurofxref'><Cube><Cube time='2026-08-04'></Cube></Cube></gesmes:Envelope>",
      { status: 200 },
    )) as unknown as typeof globalThis.fetch;
  await expect(ecb({ fetch: dateOnly }).fetch()).rejects.toThrow("no currency quotes");
  await expect(ecb({ fetch: dateOnly }).fetch()).rejects.toBeInstanceOf(SmartputError);
});

test("the provider is identified", () => {
  expect(ecb().id).toBe("ecb");
});

test("custom wraps any async source in the provider shape", async () => {
  const rates = snapshot("EUR", "2026-08-04", { USD: 1.1 });
  const provider = custom(async () => rates);
  expect(provider.id).toBe("custom");
  expect(await provider.fetch()).toBe(rates);
});
