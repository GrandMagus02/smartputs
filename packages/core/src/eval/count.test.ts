import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { CountQueryError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { defineVocabulary } from "../locale/vocabulary";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { parse } from "../parse/pratt";
import { buildProgram } from "../parse/program";
import { solve } from "../solve/solver";
import { evaluateNode } from "./evaluate";

/**
 * "minutes in hour" is a count query and "hour in minutes" is a conversion,
 * and the only thing telling them apart is which of the two words was written
 * plural. So the fixture language has to actually mark number — the one in
 * `evaluate.test.ts` answers `"other"` to everything, which is exactly the
 * shape this feature has to stay silent on.
 */
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { s: 1, min: 60, h: 3600 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});

const en = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in"] },
    selectForm: ({ count }) => (count?.eq(1) === true ? "one" : "other"),
  }),
  [
    defineVocabulary({
      locale: "en",
      kind: "duration",
      units: {
        s: {
          aliases: ["s", "second", "seconds"],
          forms: { one: "second", other: "seconds" },
        },
        min: {
          aliases: ["min", "minute", "minutes"],
          forms: { one: "minute", other: "minutes" },
        },
        h: { aliases: ["h", "hour", "hours"], forms: { one: "hour", other: "hours" } },
      },
    }),
    defineVocabulary({
      locale: "en",
      kind: "length",
      units: {
        m: {
          aliases: ["m", "metre", "metres"],
          forms: { one: "metre", other: "metres" },
        },
        km: {
          aliases: ["km", "kilometre", "kilometres"],
          forms: { one: "kilometre", other: "kilometres" },
        },
      },
    }),
  ],
);
const registry = buildRegistry([duration, length], [en]);

function evaluate(input: string) {
  const resolver = createResolver({ registry, locales: [en], format: en, layers: [] });
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const [best] = solve(program, registry, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");
  return evaluateNode({ program, resolution: best, registry, locale: "en", input }).value;
}

test("a plural unit in a singular one counts, and answers in the plural unit", () => {
  const v = evaluate("minutes in hour");
  expect(v.unit).toBe("min");
  expect(v.canonical.toString()).toBe("3600");
});

test("the mirrored spelling is still a conversion of one", () => {
  const v = evaluate("hour in minutes");
  expect(v.unit).toBe("min");
  expect(v.canonical.toString()).toBe("3600");
});

test("a singular left operand converts rather than counts", () => {
  const v = evaluate("minute in hours");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("60");
});

test("a plural right operand names no single container, so it converts", () => {
  const v = evaluate("minutes in hours");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("60");
});

test("a count somebody typed is never a count query, even when it is one", () => {
  const v = evaluate("1 minute in hours");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("60");
});

test("an explicit count converts, plural or not", () => {
  const v = evaluate("10 minutes in hours");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("600");
});

test("counting the larger unit inside the smaller one is refused", () => {
  expect(() => evaluate("hours in minute")).toThrow(CountQueryError);
});

test("the refusal names the units and the spelling that would have worked", () => {
  try {
    evaluate("kilometres in metre");
    throw new Error("expected a CountQueryError");
  } catch (e) {
    expect(e).toBeInstanceOf(CountQueryError);
    const err = e as CountQueryError;
    expect(err.kind).toBe("length");
    expect(err.unit).toBe("km");
    expect(err.per).toBe("m");
    expect(err.message).toContain('"metre in kilometres"');
  }
});

test("a symbol carries no number, so it converts as it always did", () => {
  // "min" is neither the singular nor the plural word — it is an alias, and
  // an alias that stood for a count query would make "min in h" mean the
  // opposite of "1 min in h".
  const v = evaluate("min in h");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("60");
});

test("a count query rounds nothing away", () => {
  const v = evaluate("seconds in hour");
  expect(v.unit).toBe("s");
  expect(v.canonical.toString()).toBe("3600");
  expect(v.canonical.div(new Decimal(1)).toString()).toBe("3600");
});
