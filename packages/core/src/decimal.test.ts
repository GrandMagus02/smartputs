import { expect, test } from "bun:test";
import { Decimal } from "./decimal";

test("Decimal is configured to 28 significant digits", () => {
  expect(Decimal.precision).toBe(28);
});

test("Decimal does not lose precision where float would", () => {
  expect(new Decimal("0.1").plus("0.2").toString()).toBe("0.3");
});
