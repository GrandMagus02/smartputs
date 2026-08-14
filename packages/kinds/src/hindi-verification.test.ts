import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract, OPERATOR_CHARS } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_HI from "./locale/hi";

/**
 * Hindi, verified against the engine rather than against the translation's own
 * intent — the check `zz-de-verify.test.ts` and `zz-pl-verify.test.ts` are the
 * German and Polish instances of.
 *
 * It lives in `@smartput/kinds` and not in any one package because the two
 * things a per-package test structurally cannot see are both here: a compound
 * symbol carrying a slash is arithmetic over *two* kinds ("मी/सेकंड" is length ÷
 * duration), so an engine of one kind can never read one back, and a word
 * claimed by two kinds at once is invisible until both are installed. Each
 * `locale/hi.test.ts` deferred the first of those to "the barrel's own locale
 * test"; this is that test, and it found the bug — see `speed`'s row below.
 */
const locale = composeLocale(hindi, BUILTIN_HI);

/** Exactly what `hindi.selectForm` can return. CLDR's two categories, closed. */
const KEYS = ["one", "other"];

/**
 * `boolean`'s single unit is a sentinel with no word in ANY language — `en` and
 * `uk` skip it identically. Not a Hindi gap.
 */
const SKIP = { skip: ["boolean:bool"] };

/**
 * One engine per kind, built once and shared by the two isolation tests below.
 * A round trip that only passed because a sibling kind's aliases happened to be
 * installed proves nothing about the vocabulary under test, so the isolation is
 * the point; building seventeen registries twice over was only the cost.
 */
const soloEngines = BUILTIN_HI.map((v) => {
  const kind = BUILTIN_KINDS.find((k) => k.id === v.kind);
  return kind === undefined
    ? null
    : {
        v,
        engine: createEngine({ locales: [composeLocale(hindi, [v])], kinds: [kind] }),
      };
}).filter((x) => x !== null);

describe("hi: independent verification", () => {
  test("1. contract, including fractional counts", () => {
    assertLocaleContract(locale, BUILTIN_KINDS, SKIP);
    // The default counts are all integers, and Hindi is a language where that
    // genuinely leaves a row unsampled: CLDR's `hi` rule is `i = 0 or n = 1`, so
    // every fraction below 1 is `one` and every fraction above it is `other`,
    // and an integer sweep reaches neither by that route.
    assertLocaleContract(locale, BUILTIN_KINDS, {
      ...SKIP,
      counts: [0.5, 1.5, 2.5, new Decimal("0.1"), new Decimal("1.0001")],
    });
  });

  test("2. every forms key set is exactly what selectForm produces", () => {
    const bad: string[] = [];
    for (const v of BUILTIN_HI) {
      for (const [unit, words] of Object.entries(v.units)) {
        if (words.forms === undefined) continue;
        const got = Object.keys(words.forms).sort();
        if (JSON.stringify(got) !== JSON.stringify(KEYS)) {
          bad.push(`${v.kind}:${unit} keys ${JSON.stringify(got)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("2b. selectForm answers nothing but those two keys, ever", () => {
    // The other half of rule 6. Test 2 says the tables hold exactly `one` and
    // `other`; this says the language cannot ask for a third, which is what
    // makes "exactly" mean something rather than "the tables agree with a list
    // written beside them".
    const seen = new Set<string>();
    for (let n = -50; n <= 2000; n += 1) {
      seen.add(
        hindi.selectForm({ count: new Decimal(n), kind: "k", unit: "u", slot: "bare" }),
      );
    }
    for (const f of ["0.1", "0.5", "0.9", "1.5", "2.5", "1e21", "0.0001"]) {
      for (const slot of ["bare", "after-number", "conversion-target"]) {
        seen.add(hindi.selectForm({ count: new Decimal(f), kind: "k", unit: "u", slot }));
      }
    }
    seen.add(hindi.selectForm({ kind: "k", unit: "u", slot: "conversion-target" }));
    expect([...seen].sort()).toEqual(KEYS);
  });

  test("2c. and the boundary is CLDR's, not English's", () => {
    // `i = 0 or n = 1`: zero and every fraction below one are singular in Hindi
    // and plural in English. A table ported from `en` by translating two strings
    // in place reads correctly and prints the wrong row for zero.
    const f = (n: string) =>
      hindi.selectForm({ count: new Decimal(n), kind: "k", unit: "u", slot: "bare" });
    expect([f("0"), f("0.5"), f("1"), f("1.5"), f("2")]).toEqual([
      "one",
      "one",
      "one",
      "other",
      "other",
    ]);
  });

  test("3. every printed form is literally an alias, not a stripper rescue", () => {
    const bad: string[] = [];
    for (const v of BUILTIN_HI) {
      for (const [unit, words] of Object.entries(v.units)) {
        const aliases = new Set(words.aliases.map((a) => a.toLowerCase()));
        for (const [key, form] of Object.entries(words.forms ?? {})) {
          if (!aliases.has(form.toLowerCase())) {
            bad.push(`${v.kind}:${unit} form ${key}=${JSON.stringify(form)}`);
          }
        }
        const sym = words.symbol;
        // A symbol carrying an operator ("मी/सेकंड") is read as arithmetic and
        // never by alias lookup — `assertLocaleContract` documents and skips
        // exactly this, and `en` writes "m/s" the same way. Test 5b evaluates
        // them instead.
        if (
          sym !== undefined &&
          sym.trim() !== "" &&
          ![...sym].some((c) => OPERATOR_CHARS.has(c)) &&
          !aliases.has(sym.toLowerCase())
        ) {
          bad.push(`${v.kind}:${unit} symbol ${JSON.stringify(sym)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("3b. no Devanagari string carries a precomposed nukta", () => {
    // `buildRegistry` keys the alias index by the raw alias, lowercased and
    // never normalized, while the reading path NFKC-folds the input before
    // `lex` sees it. Devanagari has a trap in that gap: ऩ ऱ ऴ and क़–य़ (U+0929,
    // U+0931, U+0934, U+0958..U+095F) are Unicode composition *exclusions*, so
    // NFKC decomposes each into a bare consonant plus the nukta U+093C. An alias
    // written with a precomposed one indexes under a key no reader can produce,
    // and every direct assertion on the vocabulary object still passes.
    //
    // Scoped to the nukta rather than asserting NFKC-stability outright, because
    // the superscripts are a deliberate house exception: `area:m2` carries "m²"
    // and "मी²", `volume:m3` carries "मी³", and NFKC folds each to a digit — but
    // `en` ships the same "m²" out of the same `AREA_UNITS` alias map, reads it
    // and prints it, so the behaviour is the kinds' and not this translation's.
    // Test 5 evaluates them end to end, which is the check that settles them.
    //
    // Escapes and not the characters themselves, and the reason is the bug: this
    // file was first written with the literals in the class, and they arrived
    // decomposed — क़ became क + ़, which turned the range into a `-` between
    // two unrelated codepoints and threw `range out of order in character
    // class` at parse time. A test for precomposed characters cannot be written
    // with precomposed ones, because nothing between a keyboard and a file
    // guarantees they survive the trip.
    const PRECOMPOSED = /[\u0929\u0931\u0934\u0958-\u095f]/u;
    const bad: string[] = [];
    for (const v of BUILTIN_HI) {
      for (const [unit, words] of Object.entries(v.units)) {
        for (const s of [
          ...words.aliases,
          words.symbol ?? "",
          ...Object.values(words.forms ?? {}),
        ]) {
          if (PRECOMPOSED.test(s)) {
            bad.push(`${v.kind}:${unit} ${JSON.stringify(s)} has a precomposed nukta`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("4. per-kind round-trip: each vocabulary reads its own formatted output", () => {
    const bad: string[] = [];
    // Counted and asserted, so a loop that quietly stopped iterating — every
    // `continue` above is a way for one to — cannot pass as green.
    let checked = 0;
    for (const { v, engine } of soloEngines) {
      for (const [unit, words] of Object.entries(v.units)) {
        const read = words.aliases[0];
        if (read === undefined) continue;
        for (const c of ["1", "2", "1500", "0.5", "2500.25", "1234567.5"]) {
          let first: ReturnType<typeof engine.evaluate>;
          try {
            first = engine.evaluate(`${c} ${read}`);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} cannot read "${c} ${read}" — ${(e as Error).message}`,
            );
            continue;
          }
          // An operator in the printed label means the label is arithmetic over
          // two kinds, which a one-kind engine cannot resolve by construction.
          // Test 5b takes those on the full engine.
          const text = first.formatted;
          if ([...text].some((ch) => OPERATOR_CHARS.has(ch))) continue;
          let back: ReturnType<typeof engine.evaluate>;
          try {
            back = engine.evaluate(text);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} "${c} ${read}" printed ${JSON.stringify(text)} — will not parse: ${(e as Error).message}`,
            );
            continue;
          }
          if (back.value.unit !== first.value.unit) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — unit ${first.value.unit} came back as ${back.value.unit}`,
            );
          } else if (!back.value.canonical.eq(first.value.canonical)) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — canonical ${first.value.canonical} came back as ${back.value.canonical}`,
            );
          }
          checked += 1;
        }
      }
    }
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThan(400);
  }, 60_000);

  test("4b. and through every alias, not only the first one listed", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const { v, engine } of soloEngines) {
      for (const [unit, words] of Object.entries(v.units)) {
        for (const read of words.aliases) {
          if ([...read].some((ch) => OPERATOR_CHARS.has(ch))) continue;
          let first: ReturnType<typeof engine.evaluate>;
          try {
            first = engine.evaluate(`2 ${read}`);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} alias ${JSON.stringify(read)} — ${(e as Error).message}`,
            );
            continue;
          }
          if (first.value.unit !== unit) {
            bad.push(
              `${v.kind}:${unit} alias ${JSON.stringify(read)} resolved to ${first.value.unit}`,
            );
          }
          checked += 1;
        }
      }
    }
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThan(300);
  }, 60_000);

  test("5. full-engine round-trip, the config a consumer actually wires", () => {
    const engine = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
    const bad: string[] = [];
    let checked = 0;
    for (const v of BUILTIN_HI) {
      for (const [unit, words] of Object.entries(v.units)) {
        const read = words.aliases[0];
        if (read === undefined) continue;
        for (const c of ["1", "2", "1500", "0.5", "2500.25"]) {
          let first: ReturnType<typeof engine.evaluate>;
          try {
            first = engine.evaluate(`${c} ${read}`);
          } catch {
            // Cross-kind ambiguity on a short alias ("m" is a metre and a
            // minute, in `units.ts`, in every language) is a property of the
            // kinds and not of this translation. Test 4 covers the unit in
            // isolation; here only what the full engine resolves is judged.
            continue;
          }
          if (first.value.unit !== unit || first.kind !== v.kind) continue;
          const text = first.formatted;
          let back: ReturnType<typeof engine.evaluate>;
          try {
            back = engine.evaluate(text);
          } catch (e) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — will not parse: ${(e as Error).message}`,
            );
            continue;
          }
          // A symbol that is an *expression* ("किमी/घंटा" = length ÷ duration)
          // is computed rather than looked up, so it comes back in the kind's
          // canonical unit and not the authored one. The magnitude is what is
          // guaranteed for those; the label is not.
          const computed = [...text].some((ch) => OPERATOR_CHARS.has(ch));
          if (!computed && (back.value.unit !== unit || back.kind !== v.kind)) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — came back as ${back.kind}:${back.value.unit}`,
            );
          } else if (!back.value.canonical.eq(first.value.canonical)) {
            bad.push(
              `${v.kind}:${unit} printed ${JSON.stringify(text)} — canonical ${first.value.canonical} came back as ${back.value.canonical}`,
            );
          }
          checked += 1;
        }
      }
    }
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThan(200);
  }, 60_000);

  test("5b. every compound symbol computes back, and none is a keyword", () => {
    // The test the whole file exists for, and the one that caught the bug.
    //
    // `speed:mps` shipped with the symbol "मी/से" — how a Hindi physics text
    // abbreviates the metre per second, and unreadable in this engine, because
    // से is one of `hindi.keywords.in`. The slash does not shelter it: `lex`
    // ends the word token at the operator and then claims से as a *keyword*, so
    // "5 मी/से" reached the parser as number, word, op, keyword and threw
    // `Cannot parse "5 मी/से" as a quantity`. mps is this kind's canonical unit,
    // so every Hindi speed the engine printed was unreadable — its own output
    // included — while `@smartput/speed`'s own `hi.test.ts` was green, because
    // an engine of one kind cannot resolve either half of a compound and the
    // file said so and deferred the check here.
    //
    // Both halves are asserted: that no half is a keyword (the cause), and that
    // the whole symbol evaluates to the right magnitude (the consequence).
    const engine = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
    const keywords = new Set(Object.values(hindi.keywords).flat());
    const bad: string[] = [];
    let checked = 0;
    for (const v of BUILTIN_HI) {
      for (const [unit, words] of Object.entries(v.units)) {
        const sym = words.symbol;
        if (sym === undefined || ![...sym].some((c) => OPERATOR_CHARS.has(c))) continue;
        for (const half of sym.split(/[^\p{L}\p{M}\p{N}]+/u).filter((h) => h !== "")) {
          if (keywords.has(half)) {
            bad.push(
              `${v.kind}:${unit} symbol ${JSON.stringify(sym)} splits to the keyword ${JSON.stringify(half)}`,
            );
          }
        }
        let expected: ReturnType<typeof engine.evaluate>;
        try {
          expected = engine.evaluate(`5 ${words.aliases[0]}`);
        } catch {
          continue;
        }
        try {
          const back = engine.evaluate(`5 ${sym}`);
          if (!back.value.canonical.eq(expected.value.canonical)) {
            bad.push(
              `${v.kind}:${unit} symbol ${JSON.stringify(sym)} computes to ${back.value.canonical}, not ${expected.value.canonical}`,
            );
          }
        } catch (e) {
          bad.push(
            `${v.kind}:${unit} symbol ${JSON.stringify(sym)} will not evaluate: ${(e as Error).message}`,
          );
        }
        checked += 1;
      }
    }
    expect(bad).toEqual([]);
    // Three speeds and three watt-hours: the six compound symbols in the barrel.
    expect(checked).toBe(6);
  });

  test("6. the group separator needs no Ukrainian-style accommodation", () => {
    // Ukrainian groups with U+00A0 and French ICU with U+202F, and
    // `parse/normalize.ts` folds every \s to a plain space before `lex` runs —
    // which is why `uk` needed a specific accommodation. Hindi does not: CLDR
    // gives the bare `hi` tag an ordinary comma and an ordinary point, the same
    // pair `en` uses, so nothing invisible survives a print.
    //
    // What Hindi has instead is a grouping *rule* core cannot express — the
    // first group from the right is three digits and every group after it is two
    // — so the writer prints 1,234,567 where a Hindi page writes 12,34,567. That
    // is a gap in `NumberFormatSpec` and not in this translation, and it does not
    // touch the round trip: `parseNumber` removes every occurrence of the group
    // character wherever it falls, so the reader takes either form.
    const parts = new Intl.NumberFormat("hi").formatToParts(1234567.5);
    const sep = (t: string) => parts.find((p) => p.type === t)?.value;
    expect(sep("group")).toBe(",");
    expect(sep("decimal")).toBe(".");
    const engine = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
    const out = engine.evaluate("1234567.5 किलोग्राम");
    expect(out.formatted).toBe("1,234,567.5 किलोग्राम");
    expect(new Intl.NumberFormat("hi").format(1234567.5)).toBe("12,34,567.5");
    expect(/[  ]/.test(out.formatted)).toBe(false);
    expect(engine.evaluate(out.formatted).value.canonical.eq(out.value.canonical)).toBe(
      true,
    );
    // And the Indian-grouped form the writer cannot yet produce reads the same,
    // so the day core learns about grouping periods this is already its
    // regression test.
    expect(engine.evaluate("12,34,567.5 किलोग्राम").value.canonical.toString()).toBe(
      out.value.canonical.toString(),
    );
  });

  test("7. no Devanagari leaked into any kind", () => {
    expect(JSON.stringify(BUILTIN_KINDS)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("8. the keywords and the numeral fold reach the parser", () => {
    const engine = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
    for (const kw of ["में", "को", "से"]) {
      const r = engine.evaluate(`1 किलोग्राम ${kw} ग्राम`);
      expect(r.value.unit).toBe("g");
      // `mass`'s canonical is the gram, so a kilogram is a thousand of them.
      expect(r.value.canonical.toString()).toBe("1000");
    }
    expect(engine.evaluate("पाँच किलोग्राम").value.canonical.toString()).toBe("5000");
    // लाख, the scale English has no word for.
    expect(engine.evaluate("पच्चीस लाख ग्राम").value.canonical.toString()).toBe("2500000");
    // The oblique plural the suffix stripper exists for — the form a plural noun
    // takes in front of exactly these postpositions.
    expect(engine.evaluate("2 किलोग्रामों में ग्राम").value.unit).toBe("g");
    // The four arithmetic nouns, read infix.
    expect(engine.evaluate("10 ग्राम जोड़ 5 ग्राम").value.canonical.toString()).toBe("15");
    expect(engine.evaluate("10 ग्राम घटा 5 ग्राम").value.canonical.toString()).toBe("5");
  });

  test("9. spell round-trips through numerals, over one table read both ways", () => {
    const bad: string[] = [];
    const { spell, numerals } = hindi;
    if (spell === undefined || numerals === undefined) {
      throw new Error("hindi declares no spell/numerals");
    }
    for (const n of [
      0, 1, 5, 11, 19, 21, 29, 39, 45, 50, 67, 99, 100, 101, 205, 999, 1000, 1001, 12345,
      100000, 250000, 1234567, 10000000, 123456789,
    ]) {
      const words = spell(new Decimal(n));
      if (words === null) {
        bad.push(`spell(${n}) is null`);
        continue;
      }
      const back = numerals(words.split(" "));
      if (back === null || !back.value.eq(new Decimal(n))) {
        bad.push(`spell(${n}) = ${JSON.stringify(words)} reads back as ${back?.value}`);
      }
    }
    expect(bad).toEqual([]);
    // The nukta survives the writing direction: `SPELLING` filters the synonyms
    // out precisely so a sort tie cannot emit हजार from a table whose first word
    // is हज़ार.
    expect(spell(new Decimal(1000))).toBe("एक हज़ार");
  });
});
