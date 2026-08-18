import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { buildRegistry } from "../kind/registry";
import { Tokenizer } from "../parse/tokenizer";
import type { Slot } from "../types";
import { composeLocale } from "./compose";
import { numberSymbols } from "./number";
import { defineVocabulary } from "./vocabulary";
import { chinese } from "./zh";
import { CARDINALS } from "./zh-cardinals";

const form = (n: number, slot: Slot = "bare") =>
  chinese.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

const segment = (run: string) => chinese.segment?.(run) ?? [];
const read = (...words: string[]) => chinese.numerals?.(words);
/**
 * A numeral written the way a reader writes it — one unbroken string — and then
 * cut the way this language's own segmenter cuts it before the numeral fold
 * ever sees it. Every round-trip assertion below goes through this rather than
 * through `read` directly, because "the parser reads 一百零五" is a claim about
 * a word list nobody types, while this is a claim about the input.
 */
const readWritten = (text: string) => read(...segment(text));
const spell = (n: number) => chinese.spell?.(new Decimal(n));

describe("chinese", () => {
  test("the key set is exactly one key, and that is the whole grammar", () => {
    expect(chinese.id).toBe("zh");
    // Measured, not asserted from memory: CLDR gives Chinese one plural
    // category, because the language marks number nowhere on a noun.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);

    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      for (const n of [0, 1, 1.5, 2, 5, 21, 100, 10_000, 1_000_000])
        keys.add(form(n, slot));
      keys.add(chinese.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    // The contract three later agents key their `forms` tables off: one row per
    // unit, named "other". A one-key table is the correct answer for Chinese and
    // not a stub — there is no second form to come back and fill in.
    expect([...keys]).toEqual(["other"]);
  });

  test("a count-free conversion target names the same key", () => {
    // Ruling R5's fallback and the ordinary answer are one string here, which is
    // why `selectForm` needs no branch for either.
    expect(
      chinese.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("takes its number symbols from CLDR, and they are English's exactly", () => {
    // Both visible characters, and the same pair `en` uses — which is the fact a
    // reader expecting a CJK surprise most needs pinned. Chinese groups by
    // thousands when it writes digits, even though it *speaks* its numbers in
    // myriads (see 十万 below), so the separator says nothing about the numeral
    // system behind it.
    expect(numberSymbols(chinese)).toEqual({ group: ",", decimal: "." });
  });

  test("claims the conversion and arithmetic keywords", () => {
    // Two verbs and two particles, all four able to begin a conversion alone.
    expect(chinese.keywords.in).toEqual(["换算", "转换", "到", "为"]);
    expect(chinese.keywords.plus).toEqual(["加"]);
    expect(chinese.keywords.minus).toEqual(["减"]);
    expect(chinese.keywords.times).toEqual(["乘"]);
    // 除以 is "divided by" as one word: the particle that would be `by` is
    // already inside it, so there is nothing for `foldWordOps` to swallow and
    // `by` stays undeclared rather than becoming an entry that matches nothing.
    expect(chinese.keywords.over).toEqual(["除以"]);
    expect(chinese.keywords.by).toBeUndefined();
    // Both left out on purpose: 的 is the most frequent character in the
    // language, and 折 states the price that *remains* (八折 is 80 %, not 20 %
    // off), so claiming either would read a correct sentence into the wrong
    // arithmetic.
    expect(chinese.keywords.of).toBeUndefined();
    expect(chinese.keywords.off).toBeUndefined();
  });

  test("no surface word is claimed for two different keywords", () => {
    // The check `buildKeywords` would make at boot, made here on one language
    // alone so a conflict inside this table is a Chinese test failure rather
    // than an engine one.
    const seen = new Map<string, string>();
    for (const [keyword, words] of Object.entries(chinese.keywords)) {
      for (const word of words ?? []) {
        expect(seen.get(word) ?? keyword).toBe(keyword);
        seen.set(word, keyword);
      }
    }
  });
});

/**
 * Segmentation, which is the seam Chinese needs and no Latin-script language in
 * this repo did: the writer put no spaces in, so somebody has to.
 *
 * Pinned as *what ICU says*, not as what a Chinese reader would say, because
 * `scriptSegmenter` is explicit that it reports its dictionary's answer and
 * does not second-guess it. The rows that disagree with a reader are the last
 * three, and they are here so that the day the dictionary changes this file
 * says so out loud.
 */
describe("segmentation", () => {
  test.each([
    // The numeral a reader writes as one string, cut in two.
    ["二十二", ["二十", "二"]],
    // Cut in three, with the placeholder zero standing alone in the middle.
    ["一百零五", ["一百", "零", "五"]],
    // And not cut at all, which is the third of three answers for one shape.
    ["十万", ["十万"]],
    // A numeral and the unit after it, which is the ordinary case and the one
    // the whole hook exists for.
    ["二十二千克", ["二十", "二", "千克"]],
    ["一百公里", ["一百", "公里"]],
    // Verb and particle, the two-token conversion phrase.
    ["千克换算为克", ["千克", "换算", "为", "克"]],
  ])("%s segments as %p", (run, words) => {
    expect(segment(run)).toEqual(words);
  });

  test("a run with no Han character comes back whole", () => {
    // `scriptSegmenter`'s scoping, which is the reason to use it rather than
    // `Intl.Segmenter` directly: the hook is offered *every* letter run of every
    // input, Latin ones included, and a Chinese language has no business
    // re-breaking those.
    expect(segment("kg")).toEqual(["kg"]);
    expect(segment("kilograms")).toEqual(["kilograms"]);
  });

  test("the dictionary cuts one shape three different ways", () => {
    // 一千克, 五千克 and 十克 are the same construction — a numeral followed by
    // a unit — and ICU breaks each of them differently. Recorded rather than
    // corrected: the correction a language could make is "split the numeral
    // characters off the front of every word", and that shreds 千克 (kilogram)
    // and 千米 (kilometre) themselves, since both *begin with* the numeral
    // character 千.
    expect(segment("一千克")).toEqual(["一", "千克"]);
    // 5000 grams rather than 5 kilograms: the same magnitude, read into the
    // other unit. See the engine section at the bottom, where this is measured
    // end to end.
    expect(segment("五千克")).toEqual(["五千", "克"]);
    // The one that does not read at all — glued into a single word that is
    // neither a numeral nor a unit.
    expect(segment("十克")).toEqual(["十克"]);
  });
});

/**
 * The numerals, which are the second thing Chinese needs that neither built-in
 * did: a numeral here is a string of *characters* composed positionally, and
 * the scale ladder above 千 climbs in ten-thousands.
 */
describe("chinese numerals read a string of characters", () => {
  test("the tables are a myriad ladder, and tens is empty", () => {
    // The single likeliest error in a Chinese numeral table, pinned as data:
    // 万 is 10^4 and 亿 is 10^8, so the groups are four digits wide and not
    // three. A table built by renaming the columns of a European one reads
    // 十万 as 10 followed by a stray character.
    expect(CARDINALS.scales).toEqual({
      十: 10,
      百: 100,
      千: 1_000,
      万: 10_000,
      亿: 100_000_000,
    });
    // Empty because Chinese composes every ten: 二十 is 二 × 十, exactly as 二百
    // is 二 × 百. Neither direction reads this field.
    expect(CARDINALS.tens).toEqual({});
  });

  test.each([
    ["零", 0],
    ["一", 1],
    // The counting two, which is what stands in front of a measure word. Reading
    // only — the speller writes 二.
    ["两", 2],
    // A bare ten is 10, and a ten with nothing in front of it opens 15. This is
    // the implied multiplier of one, and it is why 十五 is not five.
    ["十", 10],
    ["十五", 15],
    ["二十", 20],
    ["二十二", 22],
    ["九十九", 99],
    ["一百", 100],
    // The placeholder zero: "one hundred, nothing, five". It contributes no
    // value and marks the skipped decimal place.
    ["一百零五", 105],
    // And the same hundred with the tens place *filled*, which is where the 一
    // in front of 十 comes back.
    ["一百一十五", 115],
    ["三千五百", 3_500],
    ["一千零三十二", 1_032],
    // The myriad ladder. Ten myriads is a hundred thousand, and there is no
    // separate word for a million: 一百万 is "one hundred myriads".
    ["十万", 100_000],
    ["一百万", 1_000_000],
    ["一亿", 100_000_000],
    // A larger scale arriving after a smaller one multiplies everything read so
    // far; a smaller one after a larger one only multiplies its own group.
    ["一万亿", 1_000_000_000_000],
    ["一亿二千万", 120_000_000],
    ["一亿二千三百四十五万六千七百八十九", 123_456_789],
    // 〇 is the other zero — the one a written-out year is set with — and in the
    // placeholder position it reads exactly as 零 does.
    ["一百〇五", 105],
  ])("%s is %d", (text, value) => {
    const match = readWritten(text);
    expect(match?.value.toString()).toBe(String(value));
    // Whatever the segmenter did to it, the claim covers every word it made.
    expect(match?.consumed).toBe(segment(text).length);
  });

  test("a unit word that begins with a numeral character is not a numeral", () => {
    // 千克 (kilogram) and 千米 (kilometre) both open with 千, and both have a
    // second character the tables do not declare. The gate is the whole word, so
    // neither is claimed even in part — which is what keeps the numeral fold
    // from eating the front of a unit.
    expect(read("千克")).toBeNull();
    expect(read("千米")).toBeNull();
    expect(read("公斤")).toBeNull();
  });

  test("an ill-formed string is refused rather than approximated", () => {
    // Two digits in a row is a digit *string* — the way a phone number or a
    // written-out year (二〇二六) is set down, one character per decimal place —
    // and not a composed numeral. This parser composes positionally, 二十二 and
    // 一百零五, so it refuses the other convention rather than guessing which of
    // the two was meant and reading 2026 out of a year nobody was counting.
    expect(read("二二")).toBeNull();
    expect(read("二〇二六")).toBeNull();
    // Within a group the scales run strictly downward, which is what makes
    // 三千五百 unambiguous. 十百 is not a number in any reading.
    expect(read("十百")).toBeNull();
    // A digit after the placeholder is fine; the placeholder after a digit is
    // not.
    expect(read("五零")).toBeNull();
    expect(read("米")).toBeNull();
  });

  test("the claim stops at the first word that will not join", () => {
    // Two 两 in a row are two digits in a row, so the second is refused and the
    // claim keeps the first — rather than the pair being swallowed whole as one
    // ill-formed numeral.
    expect(read("两", "两")).toEqual({ value: new Decimal(2), consumed: 1 });
    // And a numeral followed by an ordinary word claims the numeral alone.
    expect(read("二十", "二", "千克")).toEqual({ value: new Decimal(22), consumed: 2 });
  });

  test("declaring 两 costs the tael, and the cost was checked before it was paid", () => {
    // 两 is the counting two — 两公斤 is how anyone says two kilograms, and 二公斤
    // is stilted — and it is also the tael, a traditional unit of mass. Only one
    // of the two can win, because `foldNumerals` turns a standalone numeral word
    // into a *number token* before any vocabulary is consulted: "5两" lexes as
    // two numbers side by side, and a `Vocabulary` claiming 两 as a unit would
    // never be reached at all.
    //
    // The numeral wins, and the cost was measured rather than assumed: `mass`
    // ships six units (mg, g, kg, t, oz, lb) and the tael is not among them, so
    // nothing in this repo is losing a word it has. A kind that adds one is the
    // trigger to revisit this line, not to discover it.
    const zh = composeLocale(chinese);
    const tokenizer = new Tokenizer({
      locale: zh,
      registry: buildRegistry(BUILTIN_KINDS, [zh]),
    });
    const kinds = (input: string) => tokenizer.run(input).tokens.map((t) => t.type);
    expect(kinds("5两")).toEqual(["number", "number"]);
    // The one place a numeral word does *not* become a token of its own: a scale
    // word worth 100 or more attaches to the digits in front of it instead,
    // which is what makes "5万" one number rather than two.
    expect(kinds("5万")).toEqual(["number"]);
  });
});

describe("chinese spells back through the same tables", () => {
  test.each([
    [0, "零"],
    [1, "一"],
    // 二, not the 两 the tables also read: one value, one spelling, and the
    // first key declared is the one written.
    [2, "二"],
    // The 一 in front of a ten is dropped when the ten opens the number …
    [15, "十五"],
    [100_000, "十万"],
    // … and written when anything precedes it.
    [110, "一百一十"],
    [115, "一百一十五"],
    [22, "二十二"],
    [99, "九十九"],
    [100, "一百"],
    // One zero marks any run of skipped places, and a trailing zero is not
    // marked at all.
    [105, "一百零五"],
    [1_005, "一千零五"],
    [1_000, "一千"],
    [1_032, "一千零三十二"],
    // The group boundary. 100,005 needs the zero because the five sits three
    // empty places below the myriad; 105,000 does not, because the low group
    // fills its thousands place.
    [100_005, "十万零五"],
    [105_000, "十万五千"],
    [10_015, "一万零一十五"],
    [123_456, "十二万三千四百五十六"],
    [1_000_000, "一百万"],
    [100_000_000, "一亿"],
    [123_456_789, "一亿二千三百四十五万六千七百八十九"],
  ])("%d spells as %s", (value, expected) => {
    expect(spell(value)).toBe(expected);
  });

  test("declines where the tables stop being unambiguous", () => {
    // The three refusals `NumeralSpeller` documents — no fractional grammar in
    // the tables, no sign in the numeral fold — plus the ceiling, which is 10^12
    // rather than 1000 × the largest scale: above 亿 the next step is written
    // 万亿 in the mainland standard and 兆 elsewhere, and 兆 has meant 10^6 often
    // enough that there is no single right answer to give.
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(spell(1e12)).toBeNull();
    expect(spell(999_999_999_999)).toBe("九千九百九十九亿九千九百九十九万九千九百九十九");
  });

  test("every spelling round-trips through the segmenter and the parser", () => {
    // The property the one-table-two-directions layout exists to guarantee, run
    // through the real segmenter rather than around it — because what the
    // parser is handed is never the string the speller wrote, it is however many
    // pieces ICU cut that string into.
    const sample = [
      0, 1, 2, 5, 9, 10, 11, 15, 20, 22, 99, 100, 101, 105, 110, 115, 999, 1_000, 1_005,
      1_032, 9_999, 10_000, 10_015, 100_000, 100_005, 105_000, 123_456, 999_999,
      1_000_000, 12_000_000, 100_000_000, 123_456_789, 999_999_999_999,
    ];
    const problems: string[] = [];
    for (const n of sample) {
      const written = spell(n);
      if (written === null || written === undefined) {
        problems.push(`${n} does not spell`);
        continue;
      }
      const back = readWritten(written);
      if (back === null || back === undefined || !back.value.equals(n)) {
        problems.push(`${n} spelled "${written}" and read back as ${back?.value}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("renderQuantity sets no space", () => {
  const render = (parts: Parameters<NonNullable<typeof chinese.renderQuantity>>[0]) =>
    chinese.renderQuantity?.(parts);
  const base = { number: "5", kind: "mass", unit: "kg", slot: "bare" as Slot };

  test("a word is set tight, which the default does not do", () => {
    // `defaultRenderQuantity` would write "5 千克". The space is not a
    // typographic preference here the way it is in French: it is a character
    // Chinese does not write, and one `normalize()` would fold back out on the
    // way in, so printing it would make the engine's own output differ from what
    // it accepts.
    expect(render({ ...base, form: "千克", symbol: "千克" })).toBe("5千克");
    expect(render({ ...base, alias: "公斤" })).toBe("5公斤");
  });

  test("a symbol is set tight exactly as the default already does", () => {
    expect(render({ ...base, symbol: "kg" })).toBe("5kg");
  });

  test("a caller's own gap still wins", () => {
    // `Printer.spacing` is a typographic choice of the caller's, so it has to
    // reach a language that assembles its own quantities.
    expect(render({ ...base, form: "千克", gap: " " })).toBe("5 千克");
  });

  test("with nothing to print it degrades to the unit key", () => {
    // I10's graceful degradation, unchanged apart from the space: a
    // half-translated engine renders awkwardly rather than throwing.
    expect(render(base)).toBe("5kg");
  });
});

/**
 * Chinese through a real engine.
 *
 * `MASS_FIXTURE` and `LENGTH_FIXTURE` are fixtures, not shipped vocabularies:
 * the real words belong to `@smartput/mass/locale/zh` and
 * `@smartput/length/locale/zh`, and a `Language` may not contain one. Two units
 * apiece is enough to write a sentence in, which is all this needs — and each
 * `forms` table has exactly one row, which is what the contract at the top of
 * this file looks like once a vocabulary keys off it.
 */
describe("through a real engine", () => {
  const MASS_FIXTURE = defineVocabulary({
    locale: "zh",
    kind: "mass",
    units: {
      kg: { aliases: ["千克", "公斤", "kg"], symbol: "千克", forms: { other: "千克" } },
      g: { aliases: ["克", "g"], symbol: "克", forms: { other: "克" } },
      t: { aliases: ["吨", "t"], symbol: "吨", forms: { other: "吨" } },
    },
  });
  const LENGTH_FIXTURE = defineVocabulary({
    locale: "zh",
    kind: "length",
    units: {
      km: { aliases: ["千米", "公里", "km"], symbol: "千米", forms: { other: "千米" } },
      m: { aliases: ["米", "m"], symbol: "米", forms: { other: "米" } },
    },
  });
  const engine = createEngine({
    locales: [composeLocale(chinese, [MASS_FIXTURE, LENGTH_FIXTURE])],
    kinds: BUILTIN_KINDS,
    format: "zh",
  });
  const evaluate = (input: string) => engine.evaluate(input).formatted;

  test.each([
    // A whole quantity with no space anywhere in it, in and out.
    ["5千克", "5千克"],
    ["1.5千克", "1.5千克"],
    // The group separator is the ASCII comma, by thousands, even though the
    // language speaks its numbers by myriads.
    ["10000千克到吨", "10吨"],
    ["1千米到米", "1,000米"],
    // Both conversion particles and both conversion verbs, each alone.
    ["5千克到克", "5,000克"],
    ["5千克为克", "5,000克"],
    ["5千克换算克", "5,000克"],
    ["5千克转换克", "5,000克"],
    // A written numeral in front of a unit — the reason `numerals` is here.
    ["二十二千克", "22千克"],
    ["三千五百米", "3,500米"],
    ["一百公里到米", "100,000米"],
    ["十万克到千克", "100千克"],
    // The counting two, in the position it is actually written in.
    ["两公斤", "2千克"],
    ["五公斤", "5千克"],
    // A Latin symbol reads and prints beside the Chinese words, which is what
    // makes the scoped segmenter worth having.
    ["5kg", "5千克"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test.each([
    // Arithmetic written entirely in Chinese, which works because the operands
    // are spelled numerals and never touch a digit. See the two findings below
    // for what happens when they are digits.
    ["一千克加一千克", "2千克"],
    ["五千克减三千克", "2,000克"],
    ["十千克乘二", "20千克"],
    ["10千克除以二", "5千克"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });
});

/**
 * Three things Chinese asks for that the engine's seams deliberately do not
 * give it, written as tests so that the day a seam grows to cover one the test
 * fails and is rewritten, rather than quietly staying true and telling a reader
 * the limit is still there. This is the shape
 * `third-language.test.ts` established for German.
 */
describe("what an unspaced language exposes that the seams do not cover", () => {
  const FIXTURE = defineVocabulary({
    locale: "zh",
    kind: "mass",
    units: {
      kg: { aliases: ["千克", "公斤", "kg"], symbol: "千克", forms: { other: "千克" } },
      g: { aliases: ["克", "g"], symbol: "克", forms: { other: "克" } },
    },
  });
  const engine = createEngine({
    locales: [composeLocale(chinese, [FIXTURE])],
    kinds: BUILTIN_KINDS,
    format: "zh",
  });
  const evaluate = (input: string) => engine.evaluate(input).formatted;

  test("a verb and its particle together are two keywords, and two is one too many", () => {
    // 换算成 / 换算为 / 转换为 are how the phrase is actually written, and the
    // segmenter hands over the verb and the particle as two adjacent tokens.
    // Both are `in`, so the parser is offered a conversion keyword twice in a
    // row and refuses — and no keyword table can fix that, because the fix is
    // one token where the input has two.
    //
    // The alternative was declaring only one half. Declaring only the verbs
    // loses "5千克到克", the shortest and commonest form there is; declaring only
    // the particles leaves 换算 stranded as an unreadable word. Either way the
    // two-token phrase fails, so both halves are declared and each works alone.
    expect(() => engine.evaluate("5千克换算为克")).toThrow();
    expect(evaluate("5千克到克")).toBe("5,000克");
    expect(evaluate("5千克换算克")).toBe("5,000克");
  });

  test("a digit written tight against an operator is no longer absorbed into it", () => {
    // This row used to record a limitation, and the digit-inside-run split in
    // `lex` is what removed it. `lex`
    // appends a letter run's trailing digits to the last word it segmented —
    // the rule that makes the unit alias "m2" reachable at all — and in a
    // language that writes no spaces the word before the digits is frequently
    // the operator, so "5千克加3千克" lexed 加3 as one word and the sum never
    // parsed. Now a digit run *followed by a letter* ends the word unless some
    // vocabulary spells a unit that way, so 加3 splits while "cm2を" stays
    // whole, and the unspaced sum reads.
    //
    // The workarounds this row was written to document keep working, and that
    // is the point of leaving all three here: the fix is additive, not a
    // different grammar. Chinese gets it for free from a rule added for
    // "1h30m", which is the argument for putting it in `lex` rather than in a
    // language.
    expect(evaluate("5千克加3千克")).toBe("8千克");
    expect(evaluate("5千克加 3千克")).toBe("8千克");
    expect(evaluate("5千克加三千克")).toBe("8千克");
  });

  test("a particle that follows a unit can be glued to it, and 到 is the one that is", () => {
    // The mirror of the finding below: there ICU cut a word a reader wrote as
    // one, here it joins two a reader wrote as two. 升到 is "rise to" and 周到
    // is "thorough" — both ordinary words — so the dictionary keeps them whole
    // and the conversion particle never reaches the parser as a keyword.
    expect(segment("升到毫升")).toEqual(["升到", "毫升"]);
    expect(segment("周到")).toEqual(["周到"]);
    // Nothing a language can do about it: the fix would be a hook that splits a
    // trailing 到 off every word, and 到 is only a particle when a quantity
    // precedes it — which `segment` is not told. What saves the input is that
    // the other three `in` keywords cut cleanly after the same units, so every
    // phrasing that fails has a working synonym.
    expect(segment("升为")).toEqual(["升", "为"]);
    expect(segment("升换算")).toEqual(["升", "换算"]);
    expect(segment("周为")).toEqual(["周", "为"]);
    // Two words out of every printed form the built-in vocabularies ship, and
    // both are single characters: a two-character unit is never swallowed,
    // because the glued word would have to be three characters ICU knows.
    for (const unit of ["克", "米", "度", "秒", "天", "吨", "磅", "码", "节", "圈"]) {
      expect(segment(`${unit}到`), unit).toEqual([unit, "到"]);
    }
  });

  test("ICU's dictionary decides where a unit begins, and it is not always right", () => {
    // The three-way split pinned in the segmentation section, measured end to
    // end. 十克 glues into one word that is neither numeral nor unit and does
    // not read at all; 五千克 breaks as 五千 | 克 and reads as five thousand
    // grams — the same magnitude a reader meant, printed in the other unit, so
    // it is a wrong *unit* rather than a wrong answer; and 一千克 breaks the way
    // a reader would and is right.
    expect(() => engine.evaluate("十克")).toThrow();
    expect(evaluate("五千克")).toBe("5,000克");
    expect(evaluate("一千克")).toBe("1千克");
  });
});
