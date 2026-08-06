import { expect, test } from "bun:test";
import type { GeocodeHit } from "../query";
import { custom } from "./custom";

const HIT: GeocodeHit = {
  place: {
    geonameId: 1,
    name: "Nowhere",
    zone: "",
    currency: "",
    lat: 0,
    lon: 0,
    population: 0,
    country: "xx",
    admin1: "",
    postal: "",
  },
  kind: "city",
  score: 0,
  matched: "nowhere",
  source: "custom",
};

test("it wraps a function and defaults to interactive", async () => {
  const p = custom(async () => [HIT]);
  expect(p.id).toBe("custom");
  expect(p.interactive).toBe(true);
  expect(await p.search({ text: "nowhere" })).toEqual([HIT]);
});

test("the id, attribution and interactivity are the caller's to declare", async () => {
  const p = custom(async () => [], {
    id: "mine",
    attribution: "© me",
    interactive: false,
  });
  expect(p.id).toBe("mine");
  expect(p.attribution).toBe("© me");
  expect(p.interactive).toBe(false);
  expect(await p.search({ text: "x" })).toEqual([]);
});

test("a reverse function is exposed only when one is given", async () => {
  expect(custom(async () => []).reverse).toBeUndefined();
  const p = custom(async () => [], { reverse: async () => [HIT] });
  expect(await p.reverse?.(0, 0)).toEqual([HIT]);
});

test("hits are stamped with the provider id, so a merge can name its source", async () => {
  const p = custom(async () => [{ ...HIT, source: "wrong" }], { id: "mine" });
  const hits = await p.search({ text: "x" });
  expect(hits[0]?.source).toBe("mine");
});
