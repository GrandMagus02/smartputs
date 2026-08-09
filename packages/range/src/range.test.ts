import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, type Kind } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createIndex, INDEX_UNIT, index } from "./index-kind";
import { createRange, range } from "./range";
import { BackwardsRangeError, RANGE_UNIT, ZeroIndexError } from "./slice";

const engineWith = (...kinds: Kind[]) =>
  createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS, ...kinds],
    now: () => 0,
    timeZone: "UTC",
  });

const engine = engineWith(index, range);
const evaluate = (input: string) => engine.evaluate(input);

describe("the written forms", () => {
  test.each([
    ["first three", "[0, 2]"],
    ["last three", "[-3, -1]"],
    ["from 6 to 9", "[5, 8]"],
    ["6 to 9", "[5, 8]"],
    ["(1;5]", "[1, 4]"],
    ["[1,5]", "[0, 4]"],
  ])("%p is %p", (input, formatted) => {
    const result = evaluate(input);
    expect(result.kind).toBe("range");
    expect(result.formatted).toBe(formatted);
  });

  test("the value carries both ends and orders by the first", () => {
    const { value } = evaluate("from 6 to 9");
    expect(value.unit).toBe(RANGE_UNIT);
    expect(value.canonical.toString()).toBe("5");
    expect(value.meta).toEqual({ start: 5, end: 8 });
  });
});

describe("the dash", () => {
  /**
   * The contest the package turns on. `- | number | number` answers -1 and is
   * registered by core's ratio ops for every kind; the range path pays -20 per
   * operand, collects the +30 `contextBonus` core withholds from `number`, and
   * takes the +20 refund on top — 10 against -1.
   */
  test("beats subtraction by exactly the margin the design claims", () => {
    expect(evaluate("4-5").formatted).toBe("[3, 4]");
    const { assignments } = engine.explain("4-5");
    expect(assignments[0]?.kind).toBe("range");
    expect(assignments[0]?.score).toBe(10);
    expect(assignments.find((a) => a.kind === "number")?.score).toBe(-1);
  });

  // Core's token stream carries no adjacency, so no weight can prefer the
  // tight spelling. Stated as a test because it is a cost, not an accident.
  test("the spaced form goes the same way", () => {
    expect(evaluate("4 - 5").formatted).toBe("[3, 4]");
  });

  test("dashWeight 0 hands both spellings back to subtraction", () => {
    const plain = engineWith(index, createRange({ dashWeight: 0 }));
    expect(plain.evaluate("4-5").kind).toBe("number");
    expect(plain.evaluate("4-5").formatted).toBe("-1");
    // Every written form is untouched: only the dash was ever in contest.
    expect(plain.evaluate("first three").formatted).toBe("[0, 2]");
    expect(plain.evaluate("[1,5]").formatted).toBe("[0, 4]");
  });

  // There is no `in | number | number` for a pair of bare integers, so the
  // selection is the only reading of "6 to 9" at any weight. The refund exists
  // for the binary node and nothing else.
  test("`to` is uncontested and survives dashWeight 0", () => {
    const plain = engineWith(index, createRange({ dashWeight: 0 }));
    expect(plain.evaluate("6 to 9").formatted).toBe("[5, 8]");
    expect(plain.evaluate("from 6 to 9").formatted).toBe("[5, 8]");
  });
});

describe("what the index reading must not disturb", () => {
  const bare = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    now: () => 0,
    timeZone: "UTC",
  });

  // Core's ruling R4, the one that keeps "10 m" from becoming a date: a digit
  // run followed by a unit alias is not a position.
  test.each([
    "2 + 3",
    "2 * 3",
    "3 km",
    "3 km in m",
    "10 kg + 5 kg",
    "5 min",
    "50%",
    "20% of 50",
    "100 m / 10 s",
    "12",
  ])("%p reads the same with the kinds registered", (input) => {
    expect(evaluate(input).formatted).toBe(bare.evaluate(input).formatted);
    expect(evaluate(input).kind).toBe(bare.evaluate(input).kind);
  });

  test("a decimal is one number, not a position and a remainder", () => {
    expect(evaluate("4.5").kind).toBe("number");
    expect(evaluate("4.5 - 1.5").formatted).toBe("3");
  });
});

describe("errors", () => {
  test("a backwards selection names both ends", () => {
    expect(() => evaluate("9 to 6")).toThrow(BackwardsRangeError);
    expect(() => evaluate("9-6")).toThrow(BackwardsRangeError);
  });

  test("there is no position zero", () => {
    expect(() => evaluate("0 to 5")).toThrow(ZeroIndexError);
  });
});

describe("the dials", () => {
  test("origin 0 takes written positions as indices already", () => {
    const zero = engineWith(index, createRange({ origin: 0 }));
    expect(zero.evaluate("from 6 to 9").formatted).toBe("[6, 9]");
    expect(zero.evaluate("4-5").formatted).toBe("[4, 5]");
    expect(zero.evaluate("0 to 5").formatted).toBe("[0, 5]");
    // A count is a count either way — "first three" names no position.
    expect(zero.evaluate("first three").formatted).toBe("[0, 2]");
  });

  test("the phrase table can be replaced outright", () => {
    const custom = engineWith(
      index,
      createRange({ phrases: { head: (n) => ({ start: 0, end: n - 1 }) } }),
    );
    expect(custom.evaluate("head 3").formatted).toBe("[0, 2]");
    expect(() => custom.evaluate("first three")).toThrow();
  });

  test("the reading penalty is a dial too", () => {
    const loud = engineWith(createIndex({ weight: 0 }), range);
    expect(loud.evaluate("4-5").formatted).toBe("[3, 4]");
  });
});

/**
 * A `range` registered without an `index` beside it is not an error — registry
 * pass 4 does not check that a signature's operand kinds exist — it is a kind
 * that silently claims written phrases and loses the dash. `RANGE_KINDS` is the
 * export that makes forgetting impossible, and this is the failure it prevents.
 */
test("range without index keeps the phrases and loses the dash", () => {
  const lonely = engineWith(range);
  expect(lonely.evaluate("first three").formatted).toBe("[0, 2]");
  expect(lonely.evaluate("4-5").kind).toBe("number");
});

test("the sentinel unit ids are not words the lexer can produce", () => {
  // Ruling R2 makes the id the registry key for a kind no language speaks for,
  // so a sentinel id made only of letters would be typeable — "slice" and
  // "position" both are ordinary English words. `lex` only builds a word token
  // out of `\p{L}` runs, so one non-letter closes it off.
  expect(RANGE_UNIT).toMatch(/[^\p{L}]/u);
  expect(INDEX_UNIT).toMatch(/[^\p{L}]/u);
});
