import { describe, expect, test } from "bun:test";
import { nameScore, PROXIMITY_MAX, proximityPenalty, tokenScore, tokens } from "./score";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 15);

describe("tokens", () => {
  test("closes apostrophes up rather than splitting on them", () => {
    expect(tokens("New Year's Day")).toEqual(["new", "years", "day"]);
    expect(tokens("Christmas Day (substitute day)")).toEqual([
      "christmas",
      "day",
      "substitute",
      "day",
    ]);
  });
});

describe("tokenScore", () => {
  test("exact beats prefix beats a typo, in that order", () => {
    const exact = tokenScore("christmas", "christmas");
    const prefix = tokenScore("chris", "christmas");
    const typo = tokenScore("chrismas", "christmas");
    expect(exact).toBe(1);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(typo);
    expect(typo).toBeGreaterThan(0);
  });

  test("a dropped letter costs less than a wrong one", () => {
    // Core's weights, carried over: "chrismas" drops a letter, "chrostmas"
    // types one wrong, and the commoner slip has to score higher.
    expect(tokenScore("chrismas", "christmas")).toBeGreaterThan(
      tokenScore("chrostmas", "christmas"),
    );
  });

  test("two slips score less than one but still count", () => {
    expect(tokenScore("crismas", "christmas")).toBeGreaterThan(0);
    expect(tokenScore("crismas", "christmas")).toBeLessThan(
      tokenScore("chrismas", "christmas"),
    );
  });

  test("a typo still clears the default minScore on its own", () => {
    // Otherwise "chrismas" would be refused as a guess, which is the one thing
    // the typo tolerance exists to prevent.
    expect(tokenScore("chrismas", "christmas")).toBeGreaterThan(0.6);
    expect(tokenScore("cristmas", "christmas")).toBeGreaterThan(0.6);
  });

  test("refuses words that are simply different", () => {
    expect(tokenScore("qwertyuiop", "christmas")).toBe(0);
    expect(tokenScore("eve", "day")).toBe(0);
    // A single letter is a symbol, not a word with a typo in it.
    expect(tokenScore("a", "b")).toBe(0);
  });
});

describe("nameScore", () => {
  test("the full name, in any order, scores 1", () => {
    expect(nameScore("christmas day", "Christmas Day")).toBe(1);
    expect(nameScore("day christmas", "Christmas Day")).toBe(1);
    expect(nameScore("CHRISTMAS   day", "Christmas Day")).toBe(1);
    expect(nameScore("new years day", "New Year's Day")).toBe(1);
  });

  test("a written contraction reaches the word it stands for", () => {
    expect(nameScore("xmas day", "Christmas Day")).toBe(1);
    expect(nameScore("xmas", "Christmas Day")).toBe(
      nameScore("christmas", "Christmas Day"),
    );
  });

  test("a partial phrase is strong but not perfect", () => {
    const partial = nameScore("christmas", "Christmas Day");
    expect(partial).toBeGreaterThan(0.6);
    expect(partial).toBeLessThan(1);
  });

  test("the extra words of a substitute day demote it, with no rule about substitutes", () => {
    expect(nameScore("christmas", "Christmas Day (substitute day)")).toBeLessThan(
      nameScore("christmas", "Christmas Day"),
    );
    expect(
      nameScore("independence day", "Independence Day (substitute day)"),
    ).toBeLessThan(nameScore("independence day", "Independence Day"));
  });

  test("an unrelated phrase scores nothing at all", () => {
    expect(nameScore("qwertyuiop", "Christmas Day")).toBe(0);
    expect(nameScore("", "Christmas Day")).toBe(0);
    expect(nameScore("christmas", "")).toBe(0);
  });
});

describe("proximityPenalty", () => {
  test("nothing at all when the date is now", () => {
    expect(proximityPenalty(NOW, NOW)).toBe(0);
  });

  test("strictly monotonic across the whole three-year window", () => {
    // Half-day steps out to the far edge of the window: no clamp, no bucket, no
    // flat region for distant dates. A nameless query ranks on this term alone,
    // so any plateau would silently tie two different dates.
    let previous = -1;
    for (let halfDays = 0; halfDays <= 733 * 2; halfDays += 1) {
      const penalty = proximityPenalty(NOW + (halfDays * DAY) / 2, NOW);
      expect(penalty).toBeGreaterThan(previous);
      previous = penalty;
    }
  });

  test("200 days out ranks ahead of 300, in either direction", () => {
    expect(proximityPenalty(NOW + 200 * DAY, NOW)).toBeLessThan(
      proximityPenalty(NOW + 300 * DAY, NOW),
    );
    expect(proximityPenalty(NOW - 200 * DAY, NOW)).toBeLessThan(
      proximityPenalty(NOW - 300 * DAY, NOW),
    );
    expect(proximityPenalty(NOW - 200 * DAY, NOW)).toBeLessThan(
      proximityPenalty(NOW + 300 * DAY, NOW),
    );
  });

  test("symmetric: past and future of the same distance cost the same", () => {
    expect(proximityPenalty(NOW - 90 * DAY, NOW)).toBe(
      proximityPenalty(NOW + 90 * DAY, NOW),
    );
  });

  test("reaches the cap only at the edge of the window", () => {
    expect(proximityPenalty(NOW + 733 * DAY, NOW)).toBeCloseTo(PROXIMITY_MAX, 12);
    expect(proximityPenalty(NOW + 732 * DAY, NOW)).toBeLessThan(PROXIMITY_MAX);
  });
});
