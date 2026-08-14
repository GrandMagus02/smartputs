import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { english } from "@smartput/core/locale/en";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_DE from "@smartput/kinds/locale/de";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeDe from "./de";
import datetimeEn from "./en";

/**
 * `datetime` ships no `de` vocabulary through `BUILTIN_DE`, so the barrel's
 * contract test never sees this table. Same checks, run here.
 */
describe("de: datetime, which the barrel never reaches", () => {
  test("no German word claims two different zones", () => {
    // The check `assertLocaleContract`'s rival test would make, but it only
    // reaches units the barrel installs. A word pointing at two zones has no
    // reading: nothing in the input can separate "Peking" the zone from
    // "Peking" the other zone.
    const claimed = new Map<string, string>();
    const clashes: string[] = [];
    for (const [zone, words] of Object.entries(datetimeDe.units)) {
      for (const alias of words.aliases) {
        const seen = claimed.get(alias.toLowerCase());
        if (seen !== undefined && seen !== zone) {
          clashes.push(`${JSON.stringify(alias)} claimed by both ${seen} and ${zone}`);
        }
        claimed.set(alias.toLowerCase(), zone);
      }
    }
    expect(clashes).toEqual([]);
  });

  test("no forms anywhere — a zone is never counted", () => {
    for (const [zone, words] of Object.entries(datetimeDe.units)) {
      expect(words.forms, zone).toBeUndefined();
    }
  });

  test("every printed symbol is an alias of its own zone", () => {
    // Rule 5, applied to the one string this vocabulary can print per unit.
    // `ZONES` does not guarantee its symbol is also one of its aliases —
    // Pacific/Auckland's "NZ" is not — so a locale that only appends its own
    // words silently loses the ability to read its own `symbols: true` output.
    const bad: string[] = [];
    for (const [zone, words] of Object.entries(datetimeDe.units)) {
      const sym = words.symbol;
      if (sym === undefined || sym.trim() === "") continue;
      // An offset zone ("+03:00") is reached only by `parseOffsetZone`; no alias
      // lookup could ever see it, in any language.
      if (/^[+-]/.test(zone)) continue;
      const aliases = new Set(words.aliases.map((a) => a.toLowerCase()));
      if (!aliases.has(sym.toLowerCase()))
        bad.push(`${zone} prints ${sym}, not an alias`);
    }
    // The zone-table gaps English shares (ET, CT, MT, PT, IST, CST are
    // ambiguous abbreviations `ZONES` deliberately does not index) are the
    // baseline; what must not happen is de carrying one English does not.
    expect(bad).toEqual([
      "America/New_York prints ET, not an alias",
      "America/Chicago prints CT, not an alias",
      "America/Denver prints MT, not an alias",
      "America/Los_Angeles prints PT, not an alias",
      "Asia/Kolkata prints IST, not an alias",
      "Asia/Shanghai prints CST, not an alias",
    ]);
  });

  test("no contract problem de has that en does not", () => {
    // The absolute contract cannot pass for `datetime` in ANY language — the
    // offset zones carry no aliases by construction and six US/Asian symbols
    // are unindexable abbreviations. So the assertion that means something is
    // parity: German must fail in exactly the ways English already does, and
    // in no others. This is the check that caught Pacific/Auckland's "NZ".
    const problems = (locale: ReturnType<typeof composeLocale>, opts: object) => {
      try {
        assertLocaleContract(locale, [...BUILTIN_KINDS, datetime], {
          skip: ["boolean:bool"],
          ...opts,
        });
        return new Set<string>();
      } catch (e) {
        return new Set(
          (e as Error).message
            .split("\n")
            .slice(1)
            .map((s) => s.trim()),
        );
      }
    };
    const en = problems(composeLocale(english, [...BUILTIN_EN, datetimeEn]), {
      skipPrintable: ["length:in"],
    });
    const de = problems(composeLocale(german, [...BUILTIN_DE, datetimeDe]), {});
    expect([...de].filter((p) => !en.has(p))).toEqual([]);
  });

  test("the German zone words actually resolve", () => {
    const engine = createEngine({
      locales: [composeLocale(german, [...BUILTIN_DE, datetimeDe])],
      kinds: [...BUILTIN_KINDS, datetime],
      now: () => TEST_NOW,
      timeZone: TEST_ZONE,
    });
    // One word per shape the doc comment claims: a German city spelling, a
    // country name, the ß/ss pair, and the compound country.
    const cases: Array<[string, string]> = [
      ["tokio", "Asia/Tokyo"],
      ["kiew", "Europe/Kyiv"],
      ["moskau", "Europe/Moscow"],
      ["peking", "Asia/Shanghai"],
      ["singapur", "Asia/Singapore"],
      ["kalkutta", "Asia/Kolkata"],
      ["deutschland", "Europe/Berlin"],
      ["frankreich", "Europe/Paris"],
      ["neuseeland", "Pacific/Auckland"],
      ["großbritannien", "Europe/London"],
      ["grossbritannien", "Europe/London"],
      ["weltzeit", "UTC"],
    ];
    for (const [word, zone] of cases) {
      const r = engine.evaluate(`15:00 in ${word}`);
      expect(r.value.unit, `"15:00 in ${word}"`).toBe(zone);
    }
  });
});
