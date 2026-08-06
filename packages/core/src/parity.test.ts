import { expect, test } from "bun:test";
import { INPUTS, snapshot } from "./parity";

const expected = (
  (await Bun.file(new URL("../parity/en.json", import.meta.url)).exists())
    ? await Bun.file(new URL("../parity/en.json", import.meta.url)).json()
    : {}
) as Record<string, unknown>;

test("the parity fixture covers every corpus input", () => {
  expect(Object.keys(expected).sort()).toEqual([...INPUTS].sort());
});

for (const input of INPUTS) {
  test(`parity: ${input}`, () => {
    expect(snapshot(input)).toEqual(expected[input]);
  });
}
