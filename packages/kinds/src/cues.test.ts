import { expect, test } from "bun:test";
import { buildRegistry, composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { CUE_CEILING } from "@smartput/core/scan";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("every shipped cue weight is on the authored scale", () => {
  // The scale is enforceable because CUE_CEILING clamps it, but a table that
  // needs clamping is a table nobody calibrated. Assert the tables themselves.
  let counted = 0;
  for (const vocabulary of BUILTIN_EN) {
    for (const [word, weight] of Object.entries(vocabulary.cues ?? {})) {
      expect(Number.isInteger(weight), `${vocabulary.kind}:${word}`).toBe(true);
      expect(Math.abs(weight), `${vocabulary.kind}:${word}`).toBeLessThanOrEqual(
        CUE_CEILING,
      );
      expect(Math.abs(weight), `${vocabulary.kind}:${word}`).toBeGreaterThan(0);
      counted += 1;
    }
  }
  // Guards against the loop finding nothing and passing vacuously.
  expect(counted).toBeGreaterThan(40);
});

test("no shipped cue word is also a unit alias of the kind that claims it", () => {
  // A word that is both would be read as the unit inside the mark and as a cue
  // outside it, which is confusing rather than wrong — but it is always a
  // mistake in the table, because a unit alias next to a quantity is a second
  // quantity, not context.
  for (const vocabulary of BUILTIN_EN) {
    const aliases = new Set(
      Object.values(vocabulary.units).flatMap((u) =>
        u.aliases.map((a) => a.toLowerCase()),
      ),
    );
    for (const word of Object.keys(vocabulary.cues ?? {})) {
      expect(aliases.has(word.toLowerCase()), `${vocabulary.kind}:${word}`).toBe(false);
    }
  }
});

test("a cue flips the one ambiguity the built-in kinds contain", () => {
  // `m` (duration:min vs length:m) is the ONLY surface ambiguous across kinds in
  // BUILTIN_KINDS — measured against the alias index, not assumed. So it is the
  // only place a shipped cue table can be observed changing a winner, and both
  // directions are asserted because one direction rides the alphabetical
  // tie-break for free.
  const temporal = engine.scan("Will be in time in 5m");
  expect(temporal[0]?.readings[0]?.kind).toBe("duration");
  expect(temporal[0]?.readings[0]?.confidence).toBeGreaterThan(0.9);

  const spatial = engine.scan("my house is 5 m away");
  expect(spatial[0]?.readings[0]?.kind).toBe("length");
  expect(spatial[0]?.readings[0]?.confidence).toBeGreaterThan(0.9);
});

test("every shipped table reaches the cue index", () => {
  // What the nine unambiguous kinds CAN be held to. Their cues cannot change a
  // ranking in BUILTIN_KINDS because nothing they name is ambiguous — "5 kg" is
  // mass at confidence 1.000 with or without "weighs" beside it. Asserting the
  // index is wired is honest; asserting a ranking that no cue produced would not
  // be. These tables go live when a kind with an overlapping alias is installed.
  const registry = buildRegistry(BUILTIN_KINDS, [composeLocale(en, BUILTIN_EN)]);
  for (const [word, kind] of [
    ["weighs", "mass"],
    ["oven", "temperature"],
    ["disk", "datasize"],
    ["pace", "speed"],
    ["bottle", "volume"],
    ["garden", "area"],
    ["motor", "power"],
    ["battery", "energy"],
    ["discount", "percent"],
    ["away", "length"],
    ["wait", "duration"],
  ] as const) {
    const entries = registry.cueIndex.get(word) ?? [];
    expect(
      entries.map((e) => e.kind),
      `${word} -> ${kind}`,
    ).toContain(kind);
  }
});
