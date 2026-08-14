import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateId from "./id";

const locale = () => composeLocale(indonesian, [datarateId]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `indonesian.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        indonesian.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) =>
        indonesian.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ),
    ),
);

describe("datarate id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex and `ja.test.ts`
  // with a three-script one; Indonesian can borrow neither, because it is
  // written in the same Latin alphabet the kind's own unit ids are. German's
  // substitute — every noun carries a capital, so a stray one shows up as one —
  // does not transfer either, since Indonesian capitalises no common noun. So
  // the words themselves are the check: the kind is ratios, unit ids, magnitude
  // bands and four bridge signatures naming their operands by id string, and no
  // Indonesian word may appear anywhere in it.
  test("the kind itself carries no Indonesian word", () => {
    const descriptor = JSON.stringify(datarate);
    for (const word of ["bit", "detik", "mega", "giga", "tera", "per"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`indonesian` can ask for exactly one key, and no unit declares any", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it. Indonesian has no grammatical plural at all — plurality is
    // reduplication or context and neither survives a numeral — so every count
    // and every slot, the fractional 1.5 and the count-free conversion target
    // included, come back "other". This is the floor the three-type split was
    // designed to reach: one row per unit, and the same row for every reader.
    expect([...KEYS]).toEqual(["other"]);
    // And this kind fills even that with nothing, for the reason the
    // vocabulary's doc comment gives: "megabit per detik" is three words and
    // `parse/lex.ts` ends a unit token at the space. Rule 6 is satisfied by an
    // empty key set, never by one row of unreachable Indonesian.
    for (const [unit, words] of Object.entries(datarateId.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives. With no `forms` anywhere
    // the symbol is the only string this vocabulary emits, and it reads back by
    // being an alias of its own unit — case-folded, because `buildRegistry`
    // lowercases before indexing, which is what makes the SI capital in "Mbps"
    // free.
    for (const [unit, words] of Object.entries(datarateId.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
    }
  });

  test("the bare SI prefix is not claimed as a word", () => {
    // The one Indonesian colloquialism this kind has — "paket 50 mega" — and the
    // reason it stays unclaimed. *Mega* is a prefix with no head noun riding
    // along, so it would mean megabytes of quota just as readily; the alias
    // index has no kind in its key, so the two would be one entry rather than a
    // ranked ambiguity. Japanese could take 「メガビット」 because the noun is
    // still in it.
    const claimed = Object.values(datarateId.units).flatMap((w) =>
      w.aliases.map((a) => a.toLowerCase()),
    );
    for (const word of ["mega", "giga", "tera", "kilo"]) {
      expect(claimed, `"${word}" is claimed as a rate`).not.toContain(word);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Indonesian folds every count into `other`, which is the
    // claim worth sampling rather than assuming: the day `selectForm` grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Indonesian datarate", () => {
    // Latin in, Latin out. The whole Indonesian contribution here is the casing
    // and the grouping, which is exactly what the vocabulary's doc comment
    // claims — a file that added nothing to `aliases` should be measurable only
    // in those two columns.
    expect(engine.evaluate("100 mbps").formatted).toBe("100Mbps");
    expect(engine.evaluate("2 bps").formatted).toBe("2bps");
    // Conversions, with both particles the language lists under `in`: "ke" is
    // the directional "to" and "dalam" is "in". The group separator is a full
    // stop — the exact inverse of English — so "2.000" is two thousand.
    expect(engine.evaluate("2 gbps dalam mbps").formatted).toBe("2.000Mbps");
    expect(engine.evaluate("2 gbps ke mbps").formatted).toBe("2.000Mbps");
    // A sum landing on a fraction, which is where the decimal comma shows. Both
    // spellings of addition: the symbol, and the Indonesian word "tambah".
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5Mbps");
    expect(engine.evaluate("1 mbps tambah 500 kbps").formatted).toBe("1,5Mbps");
    // "1,5" is one and a half here and "1.500" is fifteen hundred, so the two
    // separators are pinned against each other rather than one at a time.
    expect(engine.evaluate("1,5 gbps").formatted).toBe("1,5Gbps");
    expect(engine.evaluate("1.500 kbps").formatted).toBe("1.500kbps");
  });

  test("the symbol prints tight, and that is the language's own cost", () => {
    // Recorded as an assertion rather than left in prose. Indonesian follows SI
    // in spacing a symbol from its number, and `defaultRenderQuantity` sets one
    // tight; `@smartput/core/locale/id` declines a `renderQuantity` on the
    // reasoning that every translated Indonesian unit carries a `forms` row and
    // therefore takes the spacing word branch. This kind carries none — it
    // cannot, "megabit per detik" is three words — so it is the counter-example,
    // and the fix belongs in the language file rather than in five vocabularies
    // that would each have to agree about a space.
    expect(engine.evaluate("100 mbps").formatted).not.toContain(" ");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 mbps",
      "2 gbps dalam mbps",
      "1 mbps tambah 500 kbps",
      "1,5 gbps",
      "1.500 kbps",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
