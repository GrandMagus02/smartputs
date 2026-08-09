import { expect, test } from "bun:test";
import { zoneSymbol } from "./symbol";

test("a named zone prints its symbol", () => {
  expect(zoneSymbol("Asia/Tokyo")).toBe("JST");
  expect(zoneSymbol("UTC")).toBe("UTC");
});

test("an offset zone prints as UTC plus the offset", () => {
  expect(zoneSymbol("+03:00")).toBe("UTC+03:00");
  expect(zoneSymbol("-05:30")).toBe("UTC-05:30");
});

test("the two spellings of zero agree", () => {
  expect(zoneSymbol("+00:00")).toBe(zoneSymbol("UTC"));
});

test("an unknown zone falls back to its id", () => {
  // A consumer's `extendsKind` patch may register a zone this package never
  // shipped. Conversion still works; only the label is unadorned.
  expect(zoneSymbol("Africa/Lagos")).toBe("Africa/Lagos");
});
