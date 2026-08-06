import { describe, expect, test } from "bun:test";
import { DEFAULT_COUNTRY, holidayCountries, holidaysFor } from "./source";

const named = (list: readonly { name: string }[]) => list.map((item) => item.name);

describe("holidaysFor", () => {
  test("anchors start to UTC midnight of the calendar date", () => {
    // The whole point of pinning the library's timezone. This assertion is only
    // meaningful because it does not depend on the host zone the suite runs in:
    // under the library's default anchoring it would be the country's own
    // midnight, and this file would pass in one time zone and fail in the next.
    const list = holidaysFor(2026, { country: "US" });
    expect(list[0]?.name).toBe("New Year's Day");
    expect(list[0]?.start).toBe(Date.UTC(2026, 0, 1));
    expect(list[0]?.end).toBe(Date.UTC(2026, 0, 2));

    const ua = holidaysFor(2026, { country: "UA" });
    const christmas = ua.find((item) => item.name === "Christmas Day");
    // Kyiv's own midnight would be 2026-12-24T22:00:00Z, which renders as the
    // wrong day for everyone outside Ukraine.
    expect(christmas?.start).toBe(Date.UTC(2026, 11, 25));
  });

  test("carries the country over from the query", () => {
    // `HolidaysTypes.Holiday` has no country field of its own.
    expect(holidaysFor(2026, { country: "gb" }).every((h) => h.country === "GB")).toBe(
      true,
    );
  });

  test("flags substitute days", () => {
    const gb = holidaysFor(2026, { country: "GB" });
    expect(gb.find((h) => h.name === "Boxing Day (substitute day)")?.substitute).toBe(
      true,
    );
    expect(gb.find((h) => h.name === "Boxing Day")?.substitute).toBe(false);
  });

  test("different places are different sets", () => {
    expect(holidaysFor(2026, { country: "US" })).toHaveLength(23);
    expect(holidaysFor(2026, { country: "GB" })).toHaveLength(11);
    expect(holidaysFor(2026, { country: "UA" })).toHaveLength(17);
  });

  test("a state narrows to that state's set", () => {
    const gb = named(holidaysFor(2026, { country: "GB" }));
    const england = named(holidaysFor(2026, { country: "GB", state: "ENG" }));
    expect(gb).not.toContain("Summer bank holiday");
    expect(england).toContain("Summer bank holiday");
  });

  test("an absent country means the default one", () => {
    expect(DEFAULT_COUNTRY).toBe("US");
    expect(named(holidaysFor(2026))).toContain("Thanksgiving Day");
    expect(holidaysFor(2026).every((h) => h.country === "US")).toBe(true);
  });

  test("an unknown country is empty rather than an error", () => {
    expect(holidaysFor(2026, { country: "ZZ" })).toEqual([]);
  });

  test("caches per place and year, and hands back something frozen", () => {
    const first = holidaysFor(2027, { country: "US" });
    expect(holidaysFor(2027, { country: "US" })).toBe(first);
    // Case-folded to one cache entry, because ISO codes arrive in either case.
    expect(holidaysFor(2027, { country: "us" })).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
  });

  test("reaches years far outside the ones anyone will ask for", () => {
    expect(holidaysFor(1900, { country: "US" }).length).toBeGreaterThan(0);
    expect(holidaysFor(2200, { country: "US" }).length).toBeGreaterThan(0);
  });
});

describe("holidayCountries", () => {
  test("names every country the library knows, in English", () => {
    const countries = holidayCountries();
    expect(Object.keys(countries)).toHaveLength(206);
    expect(countries.US).toBe("United States of America");
    expect(countries.GB).toBe("United Kingdom");
    // Not "Україна" — the no-argument form answers in each country's own
    // language, which is wrong for anything shown to a user.
    expect(countries.UA).toBe("Ukraine");
    expect(countries.ZZ).toBeUndefined();
  });

  test("is the same frozen map every time", () => {
    expect(holidayCountries()).toBe(holidayCountries());
    expect(Object.isFrozen(holidayCountries())).toBe(true);
  });
});
