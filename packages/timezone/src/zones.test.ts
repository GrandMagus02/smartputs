import { expect, test } from "bun:test";
import { ZONES } from "./zones";

test("every key is an id Intl accepts as a time zone", () => {
  for (const zone of Object.keys(ZONES)) {
    expect(() => new Intl.DateTimeFormat("en", { timeZone: zone })).not.toThrow();
  }
});

test("aliases are single words, because the alias index is keyed by one", () => {
  for (const [zone, def] of Object.entries(ZONES)) {
    expect(def.aliases.length, zone).toBeGreaterThan(0);
    for (const alias of def.aliases) expect(alias).toMatch(/^\p{L}+$/u);
  }
});

test("no alias is claimed by two zones", () => {
  const seen = new Map<string, string>();
  for (const [zone, def] of Object.entries(ZONES)) {
    for (const alias of def.aliases) {
      expect(seen.get(alias) ?? zone).toBe(zone);
      seen.set(alias, zone);
    }
  }
});
