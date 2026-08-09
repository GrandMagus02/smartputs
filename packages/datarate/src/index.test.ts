import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datarate } from "./index";

// Not BUILTIN_KINDS alone: datarate bridges datasize and duration, so the only
// engine that can exercise its ops is one that has all three registered.
//
// `datarate` is spliced in from source and filtered back out of the barrel, so
// this file reads the same before and after the aggregator learns the kind:
// pass 1 of `buildRegistry` rejects an id registered twice, and a test that
// breaks the moment the barrel gains the kind is a test nobody trusts.
const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS.filter((k) => k.id !== "datarate"), datarate],
});

test("a datasize over a duration is a datarate", () => {
  const r = engine.evaluate("1 gb / 1 s");
  expect(r.kind).toBe("datarate");
  // A gigabyte is 8e9 bits, and the bridge owes the factor of 8 because
  // datasize counts bytes while this kind counts bits.
  expect(r.value.canonical.toString()).toBe("8000000000");
});

test("a download time is a duration in seconds", () => {
  const r = engine.evaluate("500 gb / 100 mbps");
  expect(r.kind).toBe("duration");
  expect(r.value.canonical.toString()).toBe("40000");
});

test("a rate times a duration is a datasize", () => {
  const r = engine.evaluate("100 mbps * 1 min");
  expect(r.kind).toBe("datasize");
  expect(r.value.canonical.toString()).toBe("750000000");
  expect(engine.evaluate("100 mbps * 1 min in mb").formatted).toBe("750 megabytes");
});

test("the swapped product is declared, not inferred from commutativity", () => {
  expect(engine.evaluate("1 min * 100 mbps").value.canonical.toString()).toBe(
    engine.evaluate("100 mbps * 1 min").value.canonical.toString(),
  );
});

test("a datarate converts to another datarate unit", () => {
  // No space before the unit: these lexemes have a `symbol` and no `display`,
  // which is the same shape `speed` formats "100kph" through.
  expect(engine.evaluate("2 gbps in mbps").formatted).toBe("2,000mbps");
});
