import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberPt from "./pt";

const locale = composeLocale(portuguese, [numberPt]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Anything only Portuguese would write. The tilde is the giveaway — no other
 * language in this project puts one on a vowel — and the acute, grave, circumflex
 * and cedilla round out the orthography.
 */
const PORTUGUESE = /[ãõáéíóúàâêôç]/i;

/** The closed key set `portuguese.selectForm` can produce — no more, no fewer. */
const TWO_KEYS = ["one", "other"];

describe("number pt vocabulary", () => {
  test("it targets Portuguese and names its kind by id", () => {
    expect(numberPt.locale).toBe("pt");
    expect(numberPt.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the id
  // was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // Portuguese half: neither a tilde nor either of the two words this file argues
  // about may reach the language-free side.
  test("the kind itself carries no Portuguese word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(PORTUGUESE);
    expect(source).not.toMatch(/unidade|\buma\b/i);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Portuguese word
  // was smuggled in as an alias either. `portuguese.numerals` claims "um"/"uma"
  // before any index is consulted, so an entry for them would be unreachable
  // machinery; "unidade" is the mathematical unit and not a thing anyone counts.
  test("declares no forms and no Portuguese alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test above
    // owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberPt.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const word of ["um", "uma", "unidade", "unidades"]) {
        expect(words.aliases, `${unit} claims ${word}`).not.toContain(word);
      }
    }
  });

  // "um" would be unreachable as an alias because the numeral parser answers
  // first, and this is the measurement behind that claim rather than the assertion
  // that it was left out. The second row is the Portuguese-only half: the feminine
  // "uma" is a read-only key on the same value, so it reads as 1 and is never what
  // gets written back.
  test("the cardinal is read by the numeral parser, not by this table", () => {
    expect(engine.evaluate("um").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("uma").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("um mais um").formatted).toBe("2");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `portuguese.selectForm`'s `other`
    // category is never reached through a fraction at all — and in Portuguese that
    // matters more than the same sentence does elsewhere, because a fraction lands
    // on `one` here ("1,5 quilograma") rather than on `other`. A fractional count
    // is added for the same reason every other `pt` vocabulary adds one, except
    // that here it can only confirm the absence of a `forms` table, since a unit
    // with none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Portuguese numbers", () => {
    // Brazilian defaults, read out of CLDR by `numberFormat: "intl"`: "," marks
    // the decimal and "." groups the thousands — the exact inverse of English.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    // And this is the trap that inverse sets, pinned rather than avoided: "." is
    // the *group* separator here, so "1.5" is not rejected the way it is under
    // Ukrainian (whose NBSP group mark NFKC folds away) — it is read as the
    // grouped integer 15. A user typing an English decimal gets a wrong number
    // rather than an error, and no vocabulary can change that: both symbols come
    // from CLDR and the digits are grouped by `formatNumber` itself.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    // Grouped output, and — unlike Ukrainian's — output this engine can read back:
    // `normalize()`'s NFKC pass leaves "." alone where it folds U+00A0 to a plain
    // space, so the group mark survives to reach `lex`.
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("2.000").value?.canonical.toString()).toBe("2000");
    // Portuguese cardinals in, Portuguese digits out. The "e" is not decoration
    // the way English's "and" is — it is grammatically required inside the group,
    // and `CARDINALS` declares it as the one connector.
    expect(engine.evaluate("cento e cinco").formatted).toBe("105");
    expect(engine.evaluate("duzentos e vinte e cinco").formatted).toBe("225");
    // The hundreds are addends and not multipliers: 200 is "duzentos", never
    // "dois cem", which is why this is 202 and not 20 000.
    expect(engine.evaluate("duzentos e dois").formatted).toBe("202");
    // The Brazilian short scale, and the plural agreement on the scale word.
    expect(engine.evaluate("dois milhões").formatted).toBe("2.000.000");
    // The arithmetic connectives `pt.ts` argues for: "mais"/"menos" are the two
    // uncontested ones, "vezes" and "por" are both `times`, and "sobre" divides.
    expect(engine.evaluate("10 mais 4").formatted).toBe("14");
    expect(engine.evaluate("10 menos 4").formatted).toBe("6");
    expect(engine.evaluate("3 vezes 4").formatted).toBe("12");
    expect(engine.evaluate("3 por 4").formatted).toBe("12");
    expect(engine.evaluate("5 sobre 2").formatted).toBe("2,5");
    expect(engine.evaluate("12 dividido 4").formatted).toBe("3");
  });

  // The cost `pt.ts` states out loud rather than hides, asserted here because this
  // is the package where a bare arithmetic expression is the whole input. "por" is
  // `times` — Spanish claims the same surface for the same operation, and
  // `buildKeywords` throws on boot if two installed languages disagree about one
  // word — so the fully spelled "dividido por" is two operator tokens in a row and
  // does not parse. "dividido" alone divides, and that is the replacement offered.
  test("a spelled-out dividido por does not divide, and that is the stated trade", () => {
    expect(() => engine.evaluate("12 dividido por 4")).toThrow();
    expect(engine.evaluate("12 dividido 4").formatted).toBe("3");
    expect(engine.evaluate("12 sobre 4").formatted).toBe("3");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Portuguese claims the
  // Latin word — and, unlike under any earlier language, that has to survive the
  // widest analyzer chain in the project: `suffixStripper` over ["s","es"] and
  // `pluralReplacer` over ten rewriting classes. "one" ends in "e", which is not a
  // plural ending, so every row of both misses it and the self-alias is live —
  // which is the alias earning its keep, since `formatNumber` emits exactly this
  // string.
  test("the Latin self-alias is live under pt, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      portuguese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The three rows a translator coming from English gets wrong. Portuguese's
    // CLDR rule is `i = 0..1`, so **0 is singular** and so is **1,5** — the exact
    // opposite of English's "1.5 kilograms". A million is CLDR's third category,
    // `many`, folded into `other` by the language itself so no table owes a third
    // row. A conversion target with no count at all lands on `other` (ruling R5).
    expect(key(0, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("one");
    expect(key(1_000_000, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    // The closed set, so a language that grew a third key — the folded `many`
    // escaping, most likely — would have to come back through this file.
    expect(
      [
        ...new Set(
          [0, 1, 1.5, 2, 21, 1_000_000].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
        ),
      ].sort(),
    ).toEqual(TWO_KEYS);
    expect(numberPt.units.one?.forms).toBeUndefined();
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to the
  // Portuguese phase: nothing is appended after the numeral, so 1 and 2 are
  // byte-identical to their own digits, in either slot.
  test("the 1/2 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word — "em gramas" next
    // door. Here the word vanishes and the numeral is all that prints, through
    // both of Portuguese's `in` keywords.
    expect(engine.evaluate("1 one em one").formatted).toBe("1");
    expect(engine.evaluate("2 one para one").formatted).toBe("2");
  });

  test("round-trips its own output", () => {
    // A fractional (the "," decimal), a grouped integer (the "." the Ukrainian row
    // could not round-trip), a spelled cardinal with its required "e", a sum that
    // lands on a fraction, and the facade's own `${raw}one` string.
    for (const input of [
      "1,5",
      "2000",
      "cento e cinco",
      "1 mais 0,5",
      "dois milhões",
      "999one",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
