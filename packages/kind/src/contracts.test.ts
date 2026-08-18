import { expect, test } from "bun:test";
import type {
  InstantMeta,
  KindContext,
  MoneyContext,
  PlaceMeta,
  RangeMeta,
} from "./contracts";
import type { EvalCtx, Kind, UnitWords } from "./types";

test("contracts is types-only: importing it adds no runtime export", async () => {
  const mod = await import("./contracts");
  expect(Object.keys(mod)).toEqual([]);
});

test("PlaceMeta stays reachable from types.ts for one release", () => {
  const place: PlaceMeta = {
    geonameId: 1,
    name: "Athens",
    zone: "Europe/Athens",
    currency: "EUR",
    lat: 37.98,
    lon: 23.72,
    population: 664_046,
    country: "gr",
  };
  const alias: import("./types").PlaceMeta = place;
  expect(alias.zone).toBe("Europe/Athens");
});

test("RangeMeta and InstantMeta name the shapes range-core and datetime already write", () => {
  const range: RangeMeta = {
    start: "2026-08-18T00:00:00+03:00[Europe/Athens]",
    end: "2026-08-19T00:00:00+03:00[Europe/Athens]",
    zone: "Europe/Athens",
  };
  const instant: InstantMeta = { iso: "2026-08-18T00:00:00+03:00[Europe/Athens]" };
  expect(range.zone).toBe("Europe/Athens");
  expect(instant.iso.startsWith("2026-08-18")).toBe(true);
});

test("MoneyContext names the slot rates and rounding move into", () => {
  const money: MoneyContext = { rounding: 4 };
  const context: KindContext = { money };
  expect((context.money as MoneyContext).rounding).toBe(4);
});

test("the three opt-in fields default to absent", () => {
  const kind = { id: "mass" } as Partial<Kind>;
  const words: UnitWords = { aliases: ["kg"] };
  const ctx = { locale: "en" } as unknown as EvalCtx;
  expect(kind.compound).toBeUndefined();
  expect(words.tight).toBeUndefined();
  expect(ctx.context).toBeUndefined();
});
