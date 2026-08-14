import { expect, test } from "bun:test";
import { add, as, format, scale, sub } from "./ops";
import { parse } from "./parse";
import type { Ok, Parsed, UnitTable } from "./types";

/**
 * The corpus for `@smartput/shared`: the micro path, read the way a form field
 * reads it — a `UnitTable`, a parser, the free operations and the formatter,
 * with no engine, no `Decimal` and no kind package anywhere underneath.
 *
 * The tables are declared here rather than imported. This package's whole claim
 * is zero runtime dependencies, and `@smartput/length` would be the first edge
 * even as a devDependency; a length table is thirty lines, and writing it out
 * is also the closest thing to the documentation a consumer needs — this is
 * what a `UnitTable` looks like. It is also why this file loads its corpora
 * itself instead of using `@smartput/core/testing`'s `Corpora`: the harness
 * would be that first edge, for a loop this package can afford to keep.
 *
 * Seven columns, because a micro parse has more than one way to be wrong and
 * the difference between the ways is the feature: `missing-unit`, `nan` and
 * `unknown-unit` are three different things to say to somebody filling in a
 * form, and a corpus that only checked `ok === false` would let them collapse.
 */
const LENGTH: UnitTable<"mm" | "cm" | "m" | "km" | "in" | "ft"> = {
  canonical: "m",
  ratio: { mm: "0.001", cm: "0.01", m: "1", km: "1000", in: "0.0254", ft: "0.3048" },
  alias: {
    mm: "mm",
    millimetre: "mm",
    millimetres: "mm",
    cm: "cm",
    centimetre: "cm",
    centimetres: "cm",
    m: "m",
    metre: "m",
    metres: "m",
    km: "km",
    kilometre: "km",
    kilometres: "km",
    in: "in",
    inch: "in",
    inches: "in",
    ft: "ft",
    foot: "ft",
    feet: "ft",
  },
};

/**
 * The same length table in Ukrainian, and the point of `corpus/uk.tsv`.
 *
 * Everything above the engine has a language somewhere in it — a vocabulary, a
 * plural selector, a number format. This path has none of those, so the only
 * place a language can live is the table itself, and this one is the proof: the
 * unit *keys* are Cyrillic, because `format` writes `${raw}${unit}` and the key
 * is what a form field will show. A consumer localising this path does not
 * install anything; they write thirty lines like these.
 *
 * What that costs is visible in `uk.tsv`. The parser reads `.` as the decimal
 * mark and nothing else, so a Ukrainian user typing `1,5 км` gets `nan` rather
 * than one and a half kilometres — recorded there as a row, because it is the
 * boundary of what a dependency-free parser can do and a consumer needs to
 * know where it is before they ship it behind a keyboard that types commas.
 */
const UK_LENGTH: UnitTable<"мм" | "см" | "м" | "км" | "дюйм" | "фут"> = {
  canonical: "м",
  ratio: {
    мм: "0.001",
    см: "0.01",
    м: "1",
    км: "1000",
    дюйм: "0.0254",
    фут: "0.3048",
  },
  alias: {
    мм: "мм",
    міліметр: "мм",
    міліметри: "мм",
    міліметрів: "мм",
    см: "см",
    сантиметр: "см",
    сантиметри: "см",
    сантиметрів: "см",
    м: "м",
    метр: "м",
    метри: "м",
    метрів: "м",
    км: "км",
    кілометр: "км",
    кілометри: "км",
    кілометрів: "км",
    дюйм: "дюйм",
    дюйми: "дюйм",
    дюймів: "дюйм",
    фут: "фут",
    фути: "фут",
    футів: "фут",
  },
};

type EnUnit = "mm" | "cm" | "m" | "km" | "in" | "ft";
type UkUnit = "мм" | "см" | "м" | "км" | "дюйм" | "фут";
type Unit = EnUnit | UkUnit;

/**
 * One language's half of the corpus: its table, its file, and the word its rows
 * write a conversion with.
 *
 * `conversion` is the corpus file's own notation and not this package's — `as`
 * takes the target unit as an argument and knows no keyword at all — but a
 * Ukrainian table written with an English "in" between its two halves would
 * read as though the micro path had a keyword and it happened to be English.
 */
const LANGUAGES = [
  { id: "en", table: LENGTH as UnitTable<Unit>, conversion: " in " },
  { id: "uk", table: UK_LENGTH as UnitTable<Unit>, conversion: " в " },
] as const;

/** The row's `op` column, applied to the expression its `input` column holds. */
function run(
  language: (typeof LANGUAGES)[number],
  op: string,
  input: string,
  mode: "strict" | "loose",
): Parsed<Unit> {
  const table = language.table;
  const opts = { mode };
  if (op === "parse") return parse(table, input, opts);
  if (op === "add") {
    const [l, r] = input.split(" + ");
    return add(table, l as string, r as string, opts);
  }
  if (op === "sub") {
    const [l, r] = input.split(" - ");
    return sub(table, l as string, r as string, opts);
  }
  if (op === "scale") {
    const [l, r] = input.split(" * ");
    return scale(table, l as string, Number(r), opts);
  }
  if (op === "as") {
    const [l, r] = input.split(language.conversion);
    return as(table, l as string, r as Unit, opts);
  }
  throw new Error(`the corpus names an operation this file does not run: ${op}`);
}

for (const language of LANGUAGES) {
  const raw = await Bun.file(
    new URL(`../corpus/${language.id}.tsv`, import.meta.url),
  ).text();

  /**
   * Deliberately not trimmed, unlike every other corpus reader in the repo.
   * Three rows are *about* the whitespace around a value — loose trims it,
   * strict reports `trailing` — and trimming the line would erase the input
   * those rows are asserting on. Blank lines are dropped by length, comments by
   * their `#`.
   */
  const rows = raw
    .split("\n")
    .filter((line) => line.trim().length > 0 && !line.startsWith("#"))
    .map((line) => line.split("\t"));

  test(`${language.id}: the corpus has rows`, () => {
    expect(rows.length).toBeGreaterThan(10);
  });

  for (const [input, op, mode, outcome, unit, value, formatted] of rows) {
    test(`corpus ${language.id}: ${op} ${JSON.stringify(input)} (${mode})`, () => {
      const result = run(
        language,
        op as string,
        input as string,
        mode as "strict" | "loose",
      );

      if (outcome !== "ok") {
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.code).toBe(outcome as never);
        return;
      }

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.unit).toBe(unit as Unit);
      expect(result.value).toBe(Number(value));
      expect(format(language.table, result as Ok<Unit>)).toBe(formatted as string);
    });
  }

  /**
   * Strict mode accepts what `format` emits and nothing else, so every
   * successful row's own rendering has to survive a strict re-read. Asserted
   * over the whole corpus rather than as one hand-picked example, because the
   * property is what makes the pair usable as a serialization format at all —
   * and it is the property a Cyrillic table could break on its own, since the
   * unit it renders is the key it has to find again.
   */
  test(`${language.id}: every formatted answer parses back in strict mode`, () => {
    for (const [input, op, mode, outcome, , , formatted] of rows) {
      if (outcome !== "ok") continue;
      const again = parse(language.table, formatted as string, { mode: "strict" });
      expect({ input, op, mode, ok: again.ok }).toEqual({ input, op, mode, ok: true });
    }
  });

  /**
   * The refusals are not decoration. A corpus of successes would pass just as
   * happily against a parser that accepted everything, so both languages are
   * held to recording some — and the Ukrainian ones are the interesting half,
   * since `1,5 км` failing is a fact about this path rather than about the row.
   */
  test(`${language.id}: the corpus records refusals as well as answers`, () => {
    expect(rows.filter((r) => r[3] !== "ok").length).toBeGreaterThan(4);
  });
}
