import { describe, expect, test } from "bun:test";
import { findHoliday } from "./find";
import { holidaysFor } from "./source";
import type { HolidayMatch } from "./types";

/**
 * Every `now` in this file is a literal. Nothing here reads the host clock, and
 * nothing here reads the host time zone either — `start` is UTC-anchored, so the
 * dates below are the same numbers on every machine.
 */
const at = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);
const DAY = 86_400_000;

const dateOf = (match: HolidayMatch | undefined) =>
  match === undefined ? null : new Date(match.start).toISOString().slice(0, 10);
const names = (matches: HolidayMatch[]) => matches.map((m) => m.name);

describe("the scoring ordering property", () => {
  test("a better name beats a nearer date, always", () => {
    // `now` is Boxing Day's substitute day itself, so the worse-named candidate
    // sits at distance zero and the better-named one is two days away. The
    // better name still wins — which is the property the comparator exists for.
    const matches = findHoliday(
      { name: "boxing day", now: at(2026, 12, 28) },
      { country: "GB" },
      { minScore: 0 },
    );
    const exact = matches.findIndex(
      (m) => m.name === "Boxing Day" && m.start === at(2026, 12, 26),
    );
    const substitute = matches.findIndex((m) => m.name === "Boxing Day (substitute day)");
    expect(exact).toBeGreaterThanOrEqual(0);
    expect(substitute).toBeGreaterThan(exact);
    expect(matches[substitute]?.nameScore).toBeLessThan(matches[exact]?.nameScore ?? 0);
    expect(matches[substitute]?.start).toBe(at(2026, 12, 28));
  });

  test("nameScore never rises as the list goes on", () => {
    // The property stated generally, over queries that mix long names, short
    // names, substitute days and three years of repeats.
    const queries = [
      "christmas",
      "christmas day",
      "easter",
      "independence",
      "boxing",
      "new year",
    ];
    const places = ["US", "GB", "UA", "IE"];
    for (const name of queries) {
      for (const country of places) {
        for (const now of [at(2026, 1, 5), at(2026, 6, 15), at(2026, 12, 20)]) {
          const matches = findHoliday(
            { name, now },
            { country },
            { limit: 20, minScore: 0 },
          );
          for (let i = 1; i < matches.length; i += 1) {
            expect(matches[i]?.nameScore).toBeLessThanOrEqual(
              matches[i - 1]?.nameScore ?? 1,
            );
          }
        }
      }
    }
  });
});

describe("proximity as the sole ranking term", () => {
  test("a nameless query comes back sorted by distance", () => {
    // Not strictly increasing, and it should not be: Veterans Day 2025 and
    // Juneteenth 2026 are both 110 days from this `now`, one either side of it.
    // Strict monotonicity is a property of the penalty function and is asserted
    // there; what belongs here is that the ranking uses nothing else.
    const now = at(2026, 3, 1);
    const matches = findHoliday({ name: "", now }, { country: "US" }, { limit: 20 });
    expect(matches.length).toBeGreaterThan(5);
    for (let i = 1; i < matches.length; i += 1) {
      const previous = Math.abs((matches[i - 1] as HolidayMatch).start - now);
      const current = Math.abs((matches[i] as HolidayMatch).start - now);
      expect(current).toBeGreaterThanOrEqual(previous);
    }
  });

  test("candidates 190 and 299 days out order correctly rather than tying", () => {
    // The distant end of the window, where a capped-then-flattened penalty would
    // silently make these two equal.
    const now = at(2026, 3, 1);
    const matches = findHoliday({ name: "", now }, { country: "US" }, { limit: 20 });
    const labour = matches.findIndex((m) => m.start === at(2026, 9, 7));
    const christmas = matches.findIndex((m) => m.start === at(2026, 12, 25));
    expect(Math.round((at(2026, 9, 7) - now) / DAY)).toBe(190);
    expect(Math.round((at(2026, 12, 25) - now) / DAY)).toBe(299);
    expect(labour).toBeGreaterThanOrEqual(0);
    expect(christmas).toBeGreaterThan(labour);
    expect(matches[labour]?.score).toBeGreaterThan(matches[christmas]?.score ?? 1);
  });

  test("nearest means either direction, not next", () => {
    // Two days after Independence Day: the answer is behind `now`.
    const past = findHoliday({ name: "", now: at(2026, 7, 6) }, { country: "US" });
    expect(past[0]?.name).toBe("Independence Day");
    expect(dateOf(past[0])).toBe("2026-07-04");

    const future = findHoliday({ name: "", now: at(2026, 12, 20) }, { country: "US" });
    expect(future[0]?.name).toBe("Christmas Day");
    expect(dateOf(future[0])).toBe("2026-12-25");
  });
});

describe("the type filter", () => {
  test("a nameless query defaults to public and nothing else", () => {
    const matches = findHoliday(
      { name: "", now: at(2026, 10, 30) },
      { country: "US" },
      { limit: 20 },
    );
    expect(matches.every((m) => m.type === "public")).toBe(true);
    // Halloween is an observance one day away and still does not appear.
    expect(names(matches)).not.toContain("Halloween");
  });

  test("a named query applies no type filter unless one is given", () => {
    // Easter Sunday is an `observance` in the US, and asking for it by name has
    // to reach it — the user already said which holiday they mean.
    const matches = findHoliday(
      { name: "easter", now: at(2026, 4, 1) },
      { country: "US" },
    );
    expect(matches[0]?.name).toBe("Easter Sunday");
    expect(matches[0]?.type).toBe("observance");

    const halloween = findHoliday(
      { name: "halloween", now: at(2026, 10, 30) },
      { country: "US" },
    );
    expect(halloween[0]?.type).toBe("observance");
  });

  test("bank finds the countries that have one", () => {
    const de = findHoliday(
      { name: "", now: at(2026, 12, 20), type: "bank" },
      { country: "DE" },
    );
    expect(de.every((m) => m.type === "bank")).toBe(true);
    expect(names(de)).toContain("Christmas Eve");

    const ie = findHoliday(
      { name: "", now: at(2026, 4, 1), type: "bank" },
      { country: "IE" },
    );
    expect(ie.every((m) => m.type === "bank")).toBe(true);
    expect(names(ie)).toContain("Good Friday");
  });

  test("school finds the countries that have one", () => {
    const pl = findHoliday(
      { name: "", now: at(2026, 4, 1), type: "school" },
      { country: "PL" },
    );
    expect(pl.every((m) => m.type === "school")).toBe(true);
    expect(names(pl)).toContain("Maundy Thursday");
  });

  test("the filter excludes rather than widens", () => {
    // The US has no `bank` and no `school` holiday at all, and Britain's "Early
    // May bank holiday" is `public` with the words in its name. An empty answer
    // is the honest one: silently dropping the filter would answer a different
    // question than the one asked.
    expect(
      findHoliday({ name: "", now: at(2026, 7, 6), type: "bank" }, { country: "US" }),
    ).toEqual([]);
    expect(
      findHoliday({ name: "", now: at(2026, 7, 6), type: "school" }, { country: "US" }),
    ).toEqual([]);
    expect(
      findHoliday({ name: "", now: at(2026, 5, 4), type: "bank" }, { country: "GB" }),
    ).toEqual([]);
    // And a named query with a type it does not have is refused the same way.
    expect(
      findHoliday(
        { name: "christmas", now: at(2026, 12, 20), type: "school" },
        { country: "US" },
      ),
    ).toEqual([]);
  });
});

describe("reading a name", () => {
  test("typos reach Christmas", () => {
    for (const typed of ["chrismas", "cristmas", "xmas day", "christmas day"]) {
      const matches = findHoliday(
        { name: typed, now: at(2026, 12, 26) },
        { country: "US" },
      );
      expect(matches[0]?.name).toBe("Christmas Day");
      expect(dateOf(matches[0])).toBe("2026-12-25");
    }
  });

  test("word order and partial phrases reach the right holiday", () => {
    const reversed = findHoliday(
      { name: "day christmas", now: at(2026, 12, 26) },
      { country: "US" },
    );
    expect(reversed[0]?.name).toBe("Christmas Day");

    const partial = findHoliday(
      { name: "independence", now: at(2026, 7, 6) },
      { country: "US" },
    );
    expect(partial[0]?.name).toBe("Independence Day");
    expect(dateOf(partial[0])).toBe("2026-07-04");

    const apostrophe = findHoliday(
      { name: "new years day", now: at(2026, 1, 5) },
      { country: "US" },
    );
    expect(apostrophe[0]?.name).toBe("New Year's Day");
    expect(dateOf(apostrophe[0])).toBe("2026-01-01");
  });

  test("an unrelated phrase is refused rather than guessed at", () => {
    expect(
      findHoliday({ name: "qwertyuiop", now: at(2026, 12, 26) }, { country: "US" }),
    ).toEqual([]);
    expect(findHoliday({ name: "quarterly report", now: at(2026, 12, 26) })).toEqual([]);
  });

  test("minScore is the line between a match and a guess", () => {
    const strict = findHoliday({ name: "chrismas", now: at(2026, 12, 26) }, undefined, {
      minScore: 0.9,
    });
    expect(strict).toEqual([]);
    const loose = findHoliday({ name: "chrismas", now: at(2026, 12, 26) }, undefined, {
      minScore: 0.6,
    });
    expect(loose[0]?.name).toBe("Christmas Day");
  });

  test("limit takes the best, and defaults to five", () => {
    const now = at(2026, 12, 26);
    expect(findHoliday({ name: "christmas", now }).length).toBe(5);
    const one = findHoliday({ name: "christmas", now }, undefined, { limit: 1 });
    expect(one).toHaveLength(1);
    expect(dateOf(one[0])).toBe("2026-12-25");
  });
});

describe("the three-year candidate window", () => {
  test("in December, next year's Easter is a candidate", () => {
    // What this test is for is the reach of the window: asked in December, the
    // answer is in March of the following year.
    //
    // Which Easter it names changed with the type key, and deliberately. "easter"
    // scores 0.83333 against both "Easter Sunday" and "Easter Monday", and in
    // Britain the Monday is `public` while the Sunday is `observance` — so the
    // Monday now wins here all year instead of winning for part of it and losing
    // for the rest. That is not obviously the better of the two answers; it is
    // the same answer in June as in December, which is the property being
    // bought. The US line below is the case the plan's table pins, and it is
    // untouched, because no US public holiday competes with Easter Sunday.
    const british = findHoliday(
      { name: "easter", now: at(2026, 12, 20) },
      { country: "GB" },
    );
    expect(dateOf(british[0])).toBe("2027-03-29");
    expect(british[0]?.name).toBe("Easter Monday");
    expect(names(british)).toContain("Easter Sunday");

    const american = findHoliday(
      { name: "easter", now: at(2026, 12, 20) },
      { country: "US" },
    );
    expect(dateOf(american[0])).toBe("2027-03-28");
    expect(american[0]?.name).toBe("Easter Sunday");
  });

  test("in January, last year's Christmas is a candidate", () => {
    const matches = findHoliday(
      { name: "christmas day", now: at(2026, 1, 5) },
      { country: "US" },
    );
    expect(dateOf(matches[0])).toBe("2025-12-25");
  });

  test("reaches both edges of the window from either end of the year", () => {
    const fromJanuary = findHoliday(
      { name: "christmas day", now: at(2026, 1, 5) },
      undefined,
      {
        limit: 10,
      },
    );
    const years = new Set(fromJanuary.map((m) => new Date(m.start).getUTCFullYear()));
    expect([...years].sort()).toEqual([2025, 2026, 2027]);
  });
});

describe("place", () => {
  test("US, GB and UA are three different answers to one question", () => {
    const now = at(2026, 4, 1);
    expect(names(findHoliday({ name: "easter", now }, { country: "US" }))).toEqual([
      "Easter Sunday",
      "Easter Sunday",
      "Easter Sunday",
    ]);
    expect(names(findHoliday({ name: "easter", now }, { country: "GB" }))).toContain(
      "Easter Monday",
    );
    expect(findHoliday({ name: "easter", now }, { country: "UA" })[0]?.name).toBe(
      "Orthodox Easter",
    );
  });

  test("an absent country falls back to the documented default", () => {
    const matches = findHoliday({ name: "thanksgiving", now: at(2026, 11, 20) });
    expect(matches[0]?.name).toBe("Thanksgiving Day");
    expect(matches[0]?.country).toBe("US");
    expect(dateOf(matches[0])).toBe("2026-11-26");
  });

  test("the default is one argument away from being something else", () => {
    const british = findHoliday(
      { name: "thanksgiving", now: at(2026, 11, 20) },
      undefined,
      {
        defaultCountry: "GB",
      },
    );
    expect(british).toEqual([]);
    const boxing = findHoliday({ name: "boxing day", now: at(2026, 12, 20) }, undefined, {
      defaultCountry: "GB",
    });
    expect(boxing[0]?.country).toBe("GB");
    expect(dateOf(boxing[0])).toBe("2026-12-26");
  });

  test("a country the library does not know answers nothing", () => {
    expect(
      findHoliday({ name: "christmas", now: at(2026, 12, 20) }, { country: "ZZ" }),
    ).toEqual([]);
    expect(findHoliday({ name: "", now: at(2026, 12, 20) }, { country: "ZZ" })).toEqual(
      [],
    );
  });
});

describe("choosing between two different holidays", () => {
  /**
   * The order `find.ts` ranks types in, restated here rather than imported, so
   * the test asserts the intended order instead of agreeing with whatever the
   * implementation happens to hold.
   */
  const TYPE_ORDER = ["public", "bank", "school", "optional", "observance"];
  const rankOf = (type: string) => TYPE_ORDER.indexOf(type);

  /** One `now` per month, which is what "the day it is asked" means here. */
  const everyMonth = Array.from({ length: 12 }, (_, i) => at(2026, i + 1, 15));

  test("christmas in December answers Christmas Day, not Christmas Eve", () => {
    // The reported defect verbatim. Both names score 0.83333 against
    // "christmas" — they share the typed token and differ only in a trailing
    // word of equal weight — so before the type key the tie fell through to
    // `score`, which at equal nameScore *is* the proximity penalty. On the 20th
    // the 24th is nearer than the 25th, so Christmas Eve won.
    const now = at(2026, 12, 20);
    const matches = findHoliday({ name: "christmas", now }, undefined, { limit: 20 });
    expect(matches[0]?.name).toBe("Christmas Day");
    expect(dateOf(matches[0])).toBe("2026-12-25");

    // Every Christmas Day outranks every Christmas Eve, so the assertion is on
    // the two groups rather than on adjacent rows — the three years of Christmas
    // Day now come first as a block.
    const eve = matches.findIndex((m) => m.name === "Christmas Eve");
    const lastDay = matches.map((m) => m.name).lastIndexOf("Christmas Day");
    expect(eve).toBeGreaterThan(lastDay);
    // The tie the type key had to break is real: the two names score the same.
    expect(matches[eve]?.nameScore).toBe(matches[0]?.nameScore as number);
    // And the loser is genuinely the nearer date, so this does not pass by
    // accident on a year where the dates happen to fall the other way.
    expect(Math.abs((matches[eve] as HolidayMatch).start - now)).toBeLessThan(
      Math.abs((matches[0] as HolidayMatch).start - now),
    );
  });

  test("which holiday a name picks does not depend on the day it is asked", () => {
    // Four more pairs from the 206-country sweep, on both sides of the fix: the
    // first four are separated by type, the last by name because both sides
    // carry the same type.
    const cases = [
      { country: "US", query: "christmas", answer: "Christmas Day" }, // public / optional
      { country: "DE", query: "christmas", answer: "Christmas Day" }, // public / bank
      { country: "NL", query: "new years", answer: "New Year's Day" }, // public / bank
      { country: "SE", query: "midsummer", answer: "Midsummer Day" }, // public / bank
      { country: "GB", query: "easter", answer: "Easter Monday" }, // public / observance
      { country: "DE", query: "shrove", answer: "Shrove Monday" }, // observance / observance
    ];
    for (const { country, query, answer } of cases) {
      for (const now of everyMonth) {
        const top = findHoliday({ name: query, now }, { country }, { limit: 1 })[0];
        // The month is in the message so a failure names the date that broke it.
        expect(
          `${country} ${query} @${new Date(now).toISOString().slice(0, 7)} ${top?.name}`,
        ).toBe(
          `${country} ${query} @${new Date(now).toISOString().slice(0, 7)} ${answer}`,
        );
      }
    }
  });

  test("equal nameScore and a different name orders by type, never by date", () => {
    // The invariant stated directly, over the whole result list rather than its
    // head, and over enough places to catch a pair the worked examples miss.
    const queries = [
      "christmas",
      "new years",
      "easter",
      "midsummer",
      "shrove",
      "carnival",
    ];
    const places = ["US", "GB", "DE", "NL", "SE", "UA", "PL", "IE", "FI", "NO"];
    let compared = 0;
    for (const name of queries) {
      for (const country of places) {
        for (const now of everyMonth) {
          const matches = findHoliday(
            { name, now },
            { country },
            { limit: 30, minScore: 0 },
          );
          for (let i = 1; i < matches.length; i += 1) {
            const previous = matches[i - 1] as HolidayMatch;
            const current = matches[i] as HolidayMatch;
            if (previous.nameScore !== current.nameScore) continue;
            if (previous.name === current.name) continue;
            compared += 1;
            const where = `${country} "${name}" ${previous.name} before ${current.name}`;
            // Type decides, and where type ties the canonical name decides —
            // both of which are facts about the holiday, not about `now`.
            if (rankOf(previous.type) === rankOf(current.type)) {
              expect(`${where}: ${previous.name < current.name}`).toBe(`${where}: true`);
            } else {
              expect(`${where}: ${rankOf(previous.type) < rankOf(current.type)}`).toBe(
                `${where}: true`,
              );
            }
          }
        }
      }
    }
    // Guards the loop against silently comparing nothing.
    expect(compared).toBeGreaterThan(100);
  });

  test("proximity still separates the occurrences of one holiday", () => {
    // The term the type key must not displace: within a single canonical name
    // the three years of the window still come back nearest-first.
    for (const now of [at(2026, 1, 5), at(2026, 6, 15), at(2026, 12, 20)]) {
      const matches = findHoliday(
        { name: "christmas day", now },
        { country: "US" },
        { limit: 10 },
      ).filter((m) => m.name === "Christmas Day");
      expect(matches.length).toBeGreaterThan(1);
      for (let i = 1; i < matches.length; i += 1) {
        const previous = Math.abs((matches[i - 1] as HolidayMatch).start - now);
        const current = Math.abs((matches[i] as HolidayMatch).start - now);
        expect(current).toBeGreaterThanOrEqual(previous);
      }
    }
  });

  test("a worse-typed holiday does not win on type", () => {
    // The type key sits *below* nameScore, so a `public` holiday whose name is a
    // poorer match still loses to an `observance` whose name is a better one.
    // Halloween is an observance and is what "halloween" means, even though
    // every US public holiday outranks it by type.
    const matches = findHoliday(
      { name: "halloween", now: at(2026, 10, 30) },
      { country: "US" },
      { minScore: 0 },
    );
    expect(matches[0]?.name).toBe("Halloween");
    expect(matches[0]?.type).toBe("observance");
  });
});

describe("ties", () => {
  test("a total tie is broken the same way every time", () => {
    // Ukraine's 2027 data carries two entries named "Christmas Day", same type,
    // same rule, neither flagged as a substitute — on the 25th and the 27th. With
    // `now` on the 26th they tie on proximity as well, so nothing but the final
    // sort key separates them.
    const query = { name: "christmas day", now: at(2027, 12, 26) };
    const first = findHoliday(query, { country: "UA" });
    const second = findHoliday(query, { country: "UA" });
    expect(first.map((m) => m.start)).toEqual(second.map((m) => m.start));
    expect(first[0]?.nameScore).toBe(first[1]?.nameScore as number);
    expect(first[0]?.score).toBe(first[1]?.score as number);
    expect(dateOf(first[0])).toBe("2027-12-25");
    expect(dateOf(first[1])).toBe("2027-12-27");
  });
});

describe("what a match carries", () => {
  test("every field, filled in", () => {
    const match = findHoliday(
      { name: "christmas day", now: at(2026, 12, 20) },
      { country: "GB" },
    )[0];
    expect(match).toBeDefined();
    expect(match?.name).toBe("Christmas Day");
    expect(match?.type).toBe("public");
    expect(match?.start).toBe(at(2026, 12, 25));
    expect(match?.end).toBe(at(2026, 12, 26));
    expect(match?.country).toBe("GB");
    expect(match?.substitute).toBe(false);
    expect(match?.rule).toContain("12-25");
    expect(match?.nameScore).toBe(1);
    expect(match?.score).toBeLessThan(1);
    expect(match?.score).toBeGreaterThan(0.9);
  });

  test("matches are new objects, not the cached occurrences", () => {
    // The year cache hands out a frozen list; a match has to be safe to mutate.
    const match = findHoliday({
      name: "christmas day",
      now: at(2026, 12, 20),
    })[0] as HolidayMatch;
    const cached = holidaysFor(2026).find((h) => h.name === "Christmas Day");
    expect(match).not.toBe(cached);
    expect(Object.isFrozen(match)).toBe(false);
  });
});
