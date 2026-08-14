import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeZh from "./zh";

const locale = composeLocale(chinese, [datetimeZh]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/**
 * Han, the only script this language writes its words in. A Han character is
 * shared with Japanese and Korean, so what this catches is "a CJK word leaked
 * into the language-free half" rather than "a *Chinese* word did" — the only
 * claim a script test can honestly make. It is also what separates this file's
 * own layer from the generated one, since every alias `@smartput/timezone` ships
 * is ASCII.
 */
const CHINESE = /\p{Script=Han}/u;

/** Every word this vocabulary adds on top of the generated table, by zone. */
const added: Array<[string, string]> = Object.entries(datetimeZh.units).flatMap(
  ([zone, words]) =>
    words.aliases.filter((a) => CHINESE.test(a)).map((a): [string, string] => [zone, a]),
);

/**
 * The two waivers `assertLocaleContract` needs to run against this kind *at all*,
 * both derived from the data rather than written out, and both facts about
 * `@smartput/timezone` rather than about Chinese — which is exactly why they are
 * computed here and then pinned below: a hand-written list would quietly absorb a
 * translation bug the day someone added an eighth zone to it.
 *
 * `skip` is the offset zones. They carry no aliases in any language, on purpose:
 * "gmt+3" lexes as three tokens, so no alias lookup could ever reach one, and
 * `parseOffsetZone` is their only door.
 *
 * `skipPrintable` is the named zones whose *symbol* is not one of their aliases.
 * The contract's sharpest check is "every string the printer can emit is readable
 * back", and `datetime`'s format hook prints `zoneSymbol(zone)` — "ET", "PT", "NZ"
 * — none of which the zone table lists as a word. `Asia/Shanghai` is the one that
 * would be a genuine bug elsewhere: its symbol "CST" *is* an alias, of
 * `America/Chicago`.
 */
const OFFSETS = Object.keys(OFFSET_ZONES).map((zone) => `datetime:${zone}`);
const SYMBOL_IS_NOT_A_WORD = Object.keys(ZONES)
  .filter((zone) => {
    const words = datetimeZh.units[zone];
    const symbol = words?.symbol?.toLowerCase();
    return symbol !== undefined && !words?.aliases.includes(symbol);
  })
  .map((zone) => `datetime:${zone}`);

describe("datetime zh vocabulary", () => {
  test("it targets Chinese and names its kind by id", () => {
    expect(datetimeZh.locale).toBe("zh");
    expect(datetimeZh.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeZh.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeZh.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is unit ids and signatures, so no script but ASCII may reach it. A Han
  // character anywhere in the descriptor would mean a translation had leaked into
  // the half of the package that is supposed to be language-free. The zone *ids*
  // are ASCII by IANA's own rules, which is what makes this assertion cheap here.
  test("the kind itself carries no Chinese word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(CHINESE);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk` and `ja`: this file adds a layer, it does not replace one. A
    // Chinese engine still reads 「15:00到tokyo」, because recognition is
    // many-to-one.
    expect(datetimeZh.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeZh.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeZh.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeZh.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Chinese words come through beside them, deduped", () => {
    expect(datetimeZh.units["Asia/Tokyo"]?.aliases).toContain("东京");
    expect(datetimeZh.units["Europe/Kyiv"]?.aliases).toContain("基辅");
    for (const [zone, words] of Object.entries(datetimeZh.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Chinese words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and
    // leaves the rest to the table, which is affordable only because that table is
    // already English. A Chinese keyboard produces Han characters, so a gap here
    // is a zone a Chinese speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeZh.units[zone]?.aliases.some((a) => CHINESE.test(a)),
        `${zone} has no Chinese word`,
      ).toBe(true);
    }
  });

  test("no Chinese word is claimed by two zones", () => {
    // A word claimed by two units of one kind has no reading, because no context
    // the engine has can separate them. Checked over the added layer only: the
    // generated half is `@smartput/timezone`'s business and is already asserted by
    // its own tests. The near-miss this guards is real — 德里 and 新德里 sit in one
    // row, and 北京 and 上海 in another.
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("satisfies the locale contract, with the two waivers the kind forces", () => {
    // Pinned before the call, so the waivers cannot quietly widen. Both lists are
    // properties of `@smartput/timezone` and hold identically under `en`; nothing
    // in either is a Chinese decision.
    expect(SYMBOL_IS_NOT_A_WORD).toEqual([
      "datetime:America/New_York",
      "datetime:America/Chicago",
      "datetime:America/Denver",
      "datetime:America/Los_Angeles",
      "datetime:Asia/Kolkata",
      "datetime:Asia/Shanghai",
      "datetime:Pacific/Auckland",
    ]);
    expect(OFFSETS.length).toBe(Object.keys(OFFSET_ZONES).length);
    const opts = { skip: OFFSETS, skipPrintable: SYMBOL_IS_NOT_A_WORD };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers and never reach a fractional reading.
    // Under `zh` a fraction cannot select a different key — `selectForm` has one
    // answer — so this call confirms the shape rather than a new row, and running
    // the same call shape every sibling vocabulary runs keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // No `forms` on any of a hundred and twenty-two units, and that is a decision
  // rather than a gap: a `forms` table exists so a *count* can pick a word, and
  // there is no such thing as two Tokyos. `chinese.selectForm` still answers — it
  // is a function of the count and the slot and knows nothing about which units
  // have tables — so this pins that the reason nothing is indexed is the missing
  // table and not a missing key.
  test("declares no forms, and selectForm has one key it would need", () => {
    for (const [zone, words] of Object.entries(datetimeZh.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      chinese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(["other"]);
    // The claim behind the one-key table, measured rather than asserted.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route
    // a user takes — and under `zh` the route is unspaced: 到 is one of the four
    // conversion keywords, an ordinary infix particle, and `chinese.segment` is
    // what separates it from the zone name that follows.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00到${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Chinese zone words", () => {
    // The same sums `en.test.ts` pins, said in Chinese and written without a space
    // anywhere. The clock is 24-hour because "3pm" is an English spelling of a
    // time and this engine has no English in it at all.
    expect(engine.evaluate("15:00到东京").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00到日本").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00到格林威治").formatted).toBe("2026-01-15 15:00 UTC");
    // 为 and 换算 are two more of the four `in` words this language lists — a
    // particle and a verb — and a zone has to be reachable through each of them.
    expect(engine.evaluate("15:00为东京").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00换算东京").value?.unit).toBe("Asia/Tokyo");
    // A second city in a one-zone country, and the country name beside it: Japan
    // is one zone in this table, so 日本 and 大阪 are not competing readings of
    // 东京.
    expect(engine.evaluate("15:00到大阪").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00到上海").formatted).toBe("2026-01-15 23:00 CST");
    // 中国 is the one country name in this table that is a fact about the country
    // rather than about the table: the mainland keeps a single zone across five
    // geographic hours.
    expect(engine.evaluate("15:00到中国").value?.unit).toBe("Asia/Shanghai");
  });

  test("the Latin aliases still read in a Chinese engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00到tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00到utc").formatted).toBe("2026-01-15 15:00 UTC");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeZh.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00到gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });

  // The names a Chinese reader would certainly type and this vocabulary cannot
  // list, recorded as live assertions rather than prose. The cause is the
  // segmenter, not the language: the alias index is keyed by one *segmented* word,
  // so a name ICU's dictionary does not hold can never be produced as a lookup
  // key. If ICU learns one of these, the assertion fails and the omission gets
  // revisited instead of ageing quietly in a comment.
  test("records the zone names ICU will not keep whole", () => {
    expect(chinese.segment?.("迪拜")).toEqual(["迪", "拜"]);
    expect(chinese.segment?.("阿联酋")).toEqual(["阿", "联", "酋"]);
    expect(chinese.segment?.("悉尼")).toEqual(["悉", "尼"]);
    expect(chinese.segment?.("奥克兰")).toEqual(["奥", "克", "兰"]);
    // 格林尼治 and 格林威治 are both standard transcriptions of Greenwich, and only
    // the second survives — ICU's dictionary rather than a preference of this
    // file's. 协定世界时's Simplified counterpart goes the same way as `ja`'s.
    expect(chinese.segment?.("格林尼治")).toEqual(["格林", "尼", "治"]);
    expect(chinese.segment?.("协调世界时")).toEqual(["协调", "世界", "时"]);
    expect(datetimeZh.units["Asia/Dubai"]?.aliases).not.toContain("迪拜");
    expect(datetimeZh.units["Australia/Sydney"]?.aliases).not.toContain("悉尼");
    expect(datetimeZh.units["Pacific/Auckland"]?.aliases).not.toContain("奥克兰");
    expect(() => engine.evaluate("15:00到迪拜")).toThrow();
    // And the substitutes that carry those zones instead, each on the identical
    // clock: Abu Dhabi is the UAE's capital, Melbourne has never differed from
    // Sydney in offset or DST rule, and New Zealand has one zone.
    expect(engine.evaluate("15:00到阿布扎比").value?.unit).toBe("Asia/Dubai");
    expect(engine.evaluate("15:00到墨尔本").value?.unit).toBe("Australia/Sydney");
    expect(engine.evaluate("15:00到惠灵顿").value?.unit).toBe("Pacific/Auckland");
    expect(engine.evaluate("15:00到格林威治").value?.unit).toBe("UTC");
    // And the contrast with `ja` that makes the list above a measurement rather
    // than a rule about CJK: New York is unreachable in Japanese and whole in
    // Chinese, so this zone needed no substitute at all.
    expect(chinese.segment?.("纽约")).toEqual(["纽约"]);
    expect(chinese.segment?.("曼哈顿")).toEqual(["曼哈顿"]);
    expect(engine.evaluate("15:00到纽约").value?.unit).toBe("America/New_York");
  });

  test("round-trips its own output, by the only route this kind has", () => {
    // What this kind prints is a formatted instant with a zone *symbol* on the
    // end, and that string is not input in any language: "2026-01-16 00:00 JST"
    // fails to parse under `en` exactly as it does under `zh`. Asserted against an
    // English engine beside the Chinese one, so the gap is attributed where it
    // belongs — to the kind's format hook, not to this translation.
    const englishEngine = createEngine({
      locales: [composeLocale(english, [datetimeEn])],
      kinds: [datetime],
      now: () => TEST_NOW,
      timeZone: TEST_ZONE,
    });
    const printed = engine.evaluate("15:00到东京").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    expect(() => englishEngine.evaluate(printed)).toThrow();
    // The round trip that *is* available, and the one that matters: a conversion
    // out and back is a fixed point on the instant and on the printed clock
    // reading alike. Both hops are Chinese words, chained through two 到 particles
    // with no space in the whole expression.
    const there = engine.evaluate("2026-01-15 15:00到东京");
    const back = engine.evaluate("15:00到东京到格林威治");
    expect(back.formatted).toBe("2026-01-15 15:00 UTC");
    expect(back.value?.canonical.toString()).toBe(there.value?.canonical.toString());
    // And the same instant reached through the Latin half, which must agree to the
    // nanosecond or one of the two layers is naming a different zone.
    expect(engine.evaluate("15:00到tokyo").value?.canonical.toString()).toBe(
      engine.evaluate("15:00到东京").value?.canonical.toString(),
    );
  });
});
