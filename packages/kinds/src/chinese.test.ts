import { describe, expect, test } from "bun:test";
import {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  composeLocale,
  createEngine,
  Decimal,
} from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_UK from "./locale/uk";
import BUILTIN_ZH from "./locale/zh";

/**
 * The `zh` barrel, checked as a barrel.
 *
 * Every vocabulary in it already has its own suite next to its own `units.ts`,
 * and those suites are where a wrong word or a missing symbol is caught. What no
 * per-package suite can see is the shape of the *list*: a vocabulary that was
 * never written, or written and never imported here, is invisible to every check
 * that only visits the kinds a locale claims — `assertLocaleContract` included,
 * which will pass cheerfully over fourteen kinds when it was handed fourteen. So
 * the first test counts, and the rest exercise the composed whole the way a
 * consumer wires it. `german.test.ts` and `italian.test.ts` next door are the
 * same file for their own languages, and this one is deliberately diffable
 * against them.
 *
 * Two tests here have no counterpart in those files, and both exist because
 * **Chinese is unspaced**. In a spaced language `assertLocaleContract` is very
 * nearly the whole story: it reads the alias index and the analyzer chain, and a
 * word the writer separated with a space arrives at the index as the word that
 * was written. Chinese has no such separator, so `chinese.segment` — ICU's
 * dictionary, scoped to Han — stands between every letter run and the index, and
 * it is the one link in the chain the contract structurally cannot see. A name
 * ICU cuts in two reaches `lex` as two word tokens and can never be read back
 * however well it is spelled, and the contract will still report the locale
 * green. That failure has two shapes and gets one test each below: a *printed
 * form* that cannot be read back at all, and an *alias* whose pieces happen to
 * mean something else, which is the worse of the two because it answers instead
 * of throwing.
 */
const zh = composeLocale(chinese, BUILTIN_ZH);

/**
 * `boolean`'s single unit is a sentinel with no word in any language: every value
 * of the kind prints through its own `format` hook ("true"/"false"), so
 * `@smartput/boolean` ships no vocabulary and no language can supply one. The
 * same skip, spelled the same way `contract.test.ts`, `german.test.ts` and
 * `ukrainian.test.ts` spell it, so a second convention does not appear beside the
 * first.
 */
const SKIP_BOOLEAN = { skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`] } as const;

/** Any CJK ideograph — the one script `chinese.segment` declares. */
const HAN = /[㐀-䶿一-鿿]/u;

/**
 * The one accepted overlap, and it is not Chinese's.
 *
 * `temperature` and `tempdelta` claim the same three labels in every language
 * this repo ships — `en` has both claim "°C", "°F" and "K", and the Chinese
 * aliases 摄氏 / 华氏 / 开 sit on the same three units — and the solver settles it
 * by weight in favour of `temperature`. So a `tempdelta` row cannot come back as
 * itself, in Chinese or in English. Listing the three by name rather than
 * widening the checks below is what keeps a *new* collision from arriving
 * unnoticed under cover of this one.
 */
const TEMP_OVERLAP: ReadonlySet<string> = new Set([
  "tempdelta:c",
  "tempdelta:f",
  "tempdelta:k",
]);

describe("the Chinese barrel", () => {
  test("BUILTIN_ZH covers exactly what BUILTIN_EN and BUILTIN_UK cover", () => {
    const kinds = (vs: readonly { kind: string }[]) => vs.map((v) => v.kind).sort();
    expect(kinds(BUILTIN_ZH)).toEqual(kinds(BUILTIN_EN));
    expect(kinds(BUILTIN_ZH)).toEqual(kinds(BUILTIN_UK));
    // And every one of them is Chinese: a file copied from `en` that kept
    // `locale: "en"` composes without complaint and then never matches at all,
    // because the registry is keyed by locale id before it is keyed by word.
    expect([...new Set(BUILTIN_ZH.map((v) => v.locale))]).toEqual(["zh"]);
  });

  test("composes into a locale whose id is the language's", () => {
    expect(zh.id).toBe("zh");
    expect(zh.vocabularies.length).toBe(BUILTIN_ZH.length);
  });

  /**
   * The contract over the composed whole, run twice.
   *
   * The second run is the one that matters and the reason it is spelled out
   * rather than left to the default: `assertLocaleContract`'s default counts are
   * all integers, so the fractional row of every `forms` table in this barrel is
   * never sampled. English and German both *move* on 1.5 (it is `other` where 1
   * is `one`), which is what makes the case worth reaching; Chinese does not
   * move, and a table that had been written as though it did — a stray `"one"`
   * row, say — is invisible until something asks for the key 1.5 produces.
   */
  test("satisfies the locale contract over every built-in kind", () => {
    assertLocaleContract(zh, BUILTIN_KINDS, SKIP_BOOLEAN);
    assertLocaleContract(zh, BUILTIN_KINDS, { ...SKIP_BOOLEAN, counts: [1.5] });
    assertLocaleContract(zh, BUILTIN_KINDS, {
      ...SKIP_BOOLEAN,
      counts: [0, 0.5, 1, 1.5, 2, 2.5, 11, 21, 100, 1000, 1e9],
    });
  });

  /**
   * One key, and every table holding exactly it.
   *
   * `selectForm` is a function and not a table, so `composeLocale` cannot check
   * that a `forms` key is one the language could ask for, and `assertLocaleContract`
   * only checks the direction that throws — that every key it *asks* for exists.
   * The other direction is silent: an extra row is dead weight that hides a typo
   * in the real one, which is exactly what a `"one"` row copied from `en.ts` and
   * never deleted would be. So the produced key set is derived first, over more
   * slots and counts than the language will ever see (including a slot it does
   * not know), and then every table in the barrel is matched against it exactly.
   */
  test("every forms table holds exactly the key set selectForm can produce", () => {
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target", "made-up"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000, -3, 0.001]) {
        produced.add(
          chinese.selectForm({
            // Spread rather than `count: undefined`: `exactOptionalPropertyTypes`
            // makes "absent" and "present but undefined" different types, and
            // ruling R5's count-free row is the absent one.
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced]).toEqual(["other"]);
    // CLDR's own answer beside it, so "one row is the whole table" is measured
    // rather than asserted: the key set is closed at one because the language has
    // one category, not because a translator stopped halfway.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);

    for (const vocab of BUILTIN_ZH) {
      for (const [unit, words] of Object.entries(vocab.units)) {
        // A unit with no table at all is a different thing from a table with the
        // wrong keys, and a legitimate one: `formatValue` falls back to the
        // symbol, which is what the whole watt family and every `datasize` unit
        // do here because ICU cuts their Chinese names.
        if (words.forms === undefined) continue;
        expect(Object.keys(words.forms), `${vocab.kind}:${unit}`).toEqual(["other"]);
      }
    }
  });

  /**
   * The check `assertLocaleContract` structurally cannot make — see this file's
   * own doc comment. Every string the barrel prints has to survive the segmenter
   * whole, because a cut name reaches `lex` as two tokens and no alias index can
   * ever be handed the string that was printed.
   *
   * It is not ceremonial. ICU cuts 字节 into 字 + 节, which is why `datasize`
   * prints Latin symbols throughout; it cuts 千焦 into 千 + 焦, which would strand
   * `zh-cardinals.ts`'s scale word for a thousand and lex 「5千焦」 as 5, then the
   * number 1000, then a stray 焦. Every word in this barrel was swept through the
   * segmenter before it was written down, and this is the sweep, kept so a
   * dictionary change surfaces as a failing test rather than as a silent gap.
   */
  test("every printed Chinese word survives the segmenter whole", () => {
    const problems: string[] = [];
    for (const vocab of BUILTIN_ZH) {
      for (const [unit, words] of Object.entries(vocab.units)) {
        for (const form of Object.values(words.forms ?? {})) {
          const segmented = chinese.segment?.(form);
          if (segmented?.length !== 1 || segmented[0] !== form) {
            problems.push(
              `${vocab.kind}:${unit} prints ${form}, segmenter returns ${JSON.stringify(segmented)}`,
            );
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  /**
   * The second shape of the same failure, and the worse one.
   *
   * A printed form that ICU cuts throws, which is at least loud. An *alias* that
   * ICU cuts is silent twice over: usually it is merely unreachable, but where
   * the pieces are themselves words of some other unit it answers — 兆瓦 cut into
   * 兆 + 瓦 hands `@smartput/datasize`'s colloquial megabyte to the resolver, and
   * a reader who wrote megawatts gets an answer about bytes. So every Han alias
   * in the barrel is typed into a fully composed engine and made to come back as
   * the unit that declared it.
   *
   * The three tempdelta rows are the one accepted overlap, and it is not
   * Chinese's: `temperature` and `tempdelta` both claim 摄氏 / 华氏 / 开 exactly as
   * `en` has both claim "°C" / "°F" / "K", and the solver settles it by weight in
   * favour of `temperature`. Listing them by name rather than widening the check
   * is what keeps a *new* collision from arriving unnoticed.
   */
  test("every Han alias resolves back to its own unit through a real engine", () => {
    const e = createEngine({ locales: [zh], kinds: BUILTIN_KINDS });
    const problems: string[] = [];
    for (const vocab of BUILTIN_ZH) {
      for (const [unit, words] of Object.entries(vocab.units)) {
        for (const alias of words.aliases) {
          if (!HAN.test(alias)) continue;
          const key = `${vocab.kind}:${unit}`;
          try {
            const read = e.evaluate(`5${alias}`).value;
            const hit = read.kind === vocab.kind && read.unit === unit;
            if (hit === TEMP_OVERLAP.has(key)) {
              problems.push(
                `${key} alias ${alias} read as ${read.kind}:${read.unit} — ${
                  hit ? "expected the documented overlap" : "wrong unit"
                }`,
              );
            }
          } catch (error) {
            problems.push(
              `${key} alias ${alias} (segments ${JSON.stringify(
                chinese.segment?.(alias),
              )}) is unreachable: ${String(error).split("\n")[0]}`,
            );
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  /**
   * Round trip over the whole barrel: type the label a unit prints, then feed the
   * engine's own answer straight back in.
   *
   * The magnitudes are chosen for the separators. 1234567 exercises grouping,
   * which is where a language that groups with U+00A0 or U+202F breaks — those
   * fold to a plain space in `parse/normalize.ts` before `lex` sees them, and
   * Ukrainian needed an accommodation for exactly that. Chinese needs none:
   * CLDR gives the bare tag the ASCII comma and the ASCII point, the same pair as
   * `en`, which is asserted below so the claim is measured rather than assumed.
   *
   * A label carrying an operator ("m/s", "km/h") is exempt from the unit half and
   * not from the value half. It is read as arithmetic rather than by lookup —
   * core's own documented carve-out, which `assertLocaleContract` takes too — so
   * 「100km/h」 lands on `speed:mps` with the magnitude intact. `en`'s own "m/s"
   * takes the identical route, and so does every one of the other new languages'
   * kph symbol.
   */
  test("every printed label round-trips through the engine", () => {
    expect(new Intl.NumberFormat("zh").format(1234567)).toBe("1,234,567");
    expect(new Intl.NumberFormat("zh").format(1.5)).toBe("1.5");

    const e = createEngine({ locales: [zh], kinds: BUILTIN_KINDS });
    const problems: string[] = [];
    for (const vocab of BUILTIN_ZH) {
      if (vocab.kind === BOOLEAN_KIND) continue;
      for (const [unit, words] of Object.entries(vocab.units)) {
        const label = words.forms?.other ?? words.symbol;
        if (label === undefined || label.trim() === "") continue;
        const key = `${vocab.kind}:${unit}`;
        // Two exemptions from the unit half, never from the value half. A
        // compound label is read as arithmetic rather than by lookup, and a
        // `tempdelta` label is outranked by `temperature` — see TEMP_OVERLAP.
        const relabels =
          [...label].some((c) => "+-*/^%()".includes(c)) || TEMP_OVERLAP.has(key);
        for (const magnitude of ["1", "1.5", "1234567"]) {
          const input = `${magnitude}${label}`;
          try {
            const first = e.evaluate(input);
            if (
              !relabels &&
              (first.value.kind !== vocab.kind || first.value.unit !== unit)
            ) {
              problems.push(
                `${key} ${input} read as ${first.value.kind}:${first.value.unit}`,
              );
              continue;
            }
            const again = e.evaluate(first.formatted);
            if (!relabels && again.value.unit !== first.value.unit) {
              problems.push(
                `${key} printed ${JSON.stringify(first.formatted)}, which re-reads as ${again.value.unit}`,
              );
              continue;
            }
            // Compared at display precision rather than exactly. `formatted`
            // prints 26 significant digits, so a canonical that repeats — 1 km/h
            // is 0.2777…78 m/s — loses its guard digits on the way out in every
            // language; `en` round-trips "1 km/h" to the identical mismatch.
            if (
              !again.value.canonical
                .toSignificantDigits(26)
                .equals(first.value.canonical.toSignificantDigits(26))
            ) {
              problems.push(
                `${key} printed ${JSON.stringify(first.formatted)}, which re-reads as ${again.value.canonical}, not ${first.value.canonical}`,
              );
            }
          } catch (error) {
            problems.push(`${key} ${input}: ${String(error).split("\n")[0]}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  /**
   * End to end, the way a consumer wires it. The point is not the arithmetic (the
   * kinds own that) but that the words in this barrel are reachable from
   * `evaluate` once composed, in both directions, and that the three things
   * Chinese does which no Latin-script language here does all survive the barrel:
   * the unspaced quantity, the written-out numeral, and the Han connective.
   */
  test("reads and prints Chinese through the engine", () => {
    const e = createEngine({ locales: [zh], kinds: BUILTIN_KINDS });
    // No space anywhere — `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 5克 where an English one answers
    // "5 grams".
    expect(e.evaluate("5克").formatted).toBe("5克");
    // A conversion through one of the four `in` words, and the grouped output
    // that comes back through the ASCII comma.
    expect(e.evaluate("2千克到克").formatted).toBe("2,000克");
    // Latin input still reads and still answers in Chinese: the two registers of
    // one language, which is why `aliasesFor` is reused rather than retyped.
    expect(e.evaluate("2kg").formatted).toBe("2千克");
    // A written-out numeral, which is prose rather than an archaism.
    expect(e.evaluate("一百克").formatted).toBe("100克");
    // The counting two in front of a measure word, which is the trade
    // `zh-cardinals.ts` takes when it claims 两 as a numeral rather than leaving
    // it to a tael no kind here declares.
    expect(e.evaluate("两公斤").formatted).toBe("2千克");
    // Across two packages, so the barrel is doing work no single vocabulary can.
    expect(e.evaluate("5千米").value.kind).toBe("length");
    expect(e.evaluate("150马力").formatted).toBe("150马力");
  });
});
