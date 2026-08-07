import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as en } from "@smartput/locale-en";
import { createEngine } from "./engine";
import { composeLocale } from "./locale/compose";
import { INPUTS, snapshot } from "./parity";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

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
    expect(snapshot(engine, input)).toEqual(expected[input]);
  });
}
