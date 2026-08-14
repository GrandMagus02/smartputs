import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeJa from "./ja";

const locale = composeLocale(japanese, [datetimeJa]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/**
 * Anything only Japanese would write: hiragana, katakana and the two CJK
 * ideograph blocks a modern Japanese text draws on. A kanji is shared with
 * Chinese, so what this catches is "a CJK word leaked into the language-free
 * half" rather than "a *Japanese* word did" — the only claim a script test can
 * honestly make. It is also what separates this file's own layer from the
 * generated one, since every alias `@smartput/timezone` ships is ASCII.
 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/u;

/** Every word this vocabulary adds on top of the generated table, by zone. */
const added: Array<[string, string]> = Object.entries(datetimeJa.units).flatMap(
  ([zone, words]) =>
    words.aliases.filter((a) => JAPANESE.test(a)).map((a): [string, string] => [zone, a]),
);

/**
 * The two waivers `assertLocaleContract` needs to run against this kind *at
 * all*, both derived from the data rather than written out, and both facts about
 * `@smartput/timezone` rather than about Japanese — which is exactly why they are
 * computed here and then pinned below: a hand-written list would quietly absorb a
 * translation bug the day someone added an eighth zone to it.
 *
 * `skip` is the offset zones. They carry no aliases in any language, on purpose:
 * "gmt+3" lexes as three tokens, so no alias lookup could ever reach one, and
 * `parseOffsetZone` is their only door.
 *
 * `skipPrintable` is the named zones whose *symbol* is not one of their aliases.
 * The contract's sharpest check is "every string the printer can emit is readable
 * back", and `datetime`'s format hook prints `zoneSymbol(zone)` — "ET", "PT",
 * "NZ" — none of which the zone table lists as a word. `Asia/Shanghai` is the one
 * that would be a genuine bug elsewhere: its symbol "CST" *is* an alias, of
 * `America/Chicago`.
 */
const OFFSETS = Object.keys(OFFSET_ZONES).map((zone) => `datetime:${zone}`);
const SYMBOL_IS_NOT_A_WORD = Object.keys(ZONES)
  .filter((zone) => {
    const words = datetimeJa.units[zone];
    const symbol = words?.symbol?.toLowerCase();
    return symbol !== undefined && !words?.aliases.includes(symbol);
  })
  .map((zone) => `datetime:${zone}`);

describe("datetime ja vocabulary", () => {
  test("it targets Japanese and names its kind by id", () => {
    expect(datetimeJa.locale).toBe("ja");
    expect(datetimeJa.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeJa.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeJa.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is unit ids and signatures, so no script but ASCII may reach it. Kana or
  // kanji anywhere in the descriptor would mean a translation had leaked into the
  // half of the package that is supposed to be language-free. The zone *ids* are
  // ASCII by IANA's own rules, which is what makes this assertion cheap here.
  test("the kind itself carries no Japanese word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(JAPANESE);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en` and `uk`: this file adds a layer, it does not replace one. A Japanese
    // engine still reads 「15:00をtokyo」, because recognition is many-to-one.
    expect(datetimeJa.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeJa.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeJa.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeJa.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Japanese words come through beside them, deduped", () => {
    expect(datetimeJa.units["Asia/Tokyo"]?.aliases).toContain("東京");
    expect(datetimeJa.units["Europe/Kyiv"]?.aliases).toContain("キーウ");
    for (const [zone, words] of Object.entries(datetimeJa.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Japanese words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and
    // leaves the rest to the table, which is affordable only because that table
    // is already English. A Japanese keyboard produces kana, so a gap here is a
    // zone a Japanese speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeJa.units[zone]?.aliases.some((a) => JAPANESE.test(a)),
        `${zone} has no Japanese word`,
      ).toBe(true);
    }
  });

  test("no Japanese word is claimed by two zones", () => {
    // A word claimed by two units of one kind has no reading, because no context
    // the engine has can separate them. Checked over the added layer only: the
    // generated half is `@smartput/timezone`'s business and is already asserted
    // by its own tests.
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("satisfies the locale contract, with the two waivers the kind forces", () => {
    // Pinned before the call, so the waivers cannot quietly widen. Both lists are
    // properties of `@smartput/timezone` and hold identically under `en`; nothing
    // in either is a Japanese decision.
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
    // Under `ja` a fraction cannot select a different key — `selectForm` has one
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
  // there is no such thing as two Tokyos. `japanese.selectForm` still answers —
  // it is a function of the count and the slot and knows nothing about which
  // units have tables — so this pins that the reason nothing is indexed is the
  // missing table and not a missing key.
  test("declares no forms, and selectForm has one key it would need", () => {
    for (const [zone, words] of Object.entries(datetimeJa.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      japanese.selectForm({
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
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route
    // a user takes — and under `ja` the route is unspaced: を is the conversion
    // keyword, a postposition that attaches to the *left* operand, and
    // `japanese.segment` is what separates it from the zone name that follows.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00を${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Japanese zone words", () => {
    // The same sums `en.test.ts` pins, said in Japanese and written without a
    // space anywhere. The clock is 24-hour because "3pm" is an English spelling
    // of a time and this engine has no English in it at all.
    expect(engine.evaluate("15:00を東京").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00を日本").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00をグリニッジ").formatted).toBe("2026-01-15 15:00 UTC");
    // から is the second spelling of `in` this language lists — it means "from",
    // and marks the source the way を does, so a zone has to be reachable through
    // both.
    expect(engine.evaluate("15:00から東京").value?.unit).toBe("Asia/Tokyo");
    // A kanji city name, and the country name beside it: Japan is one zone in
    // this table, so 日本 and 大阪 are not competing readings of 東京.
    expect(engine.evaluate("15:00を大阪").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00を上海").formatted).toBe("2026-01-15 23:00 CST");
  });

  test("the Latin aliases still read in a Japanese engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00をtokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00をutc").formatted).toBe("2026-01-15 15:00 UTC");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeJa.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00をgmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });

  // The three names a Japanese reader would certainly type and this vocabulary
  // cannot list, recorded as live assertions rather than prose. The cause is the
  // segmenter, not the language: the alias index is keyed by one *segmented*
  // word, so a name ICU's dictionary does not hold can never be produced as a
  // lookup key. If ICU learns one of these, the assertion fails and the omission
  // gets revisited instead of ageing quietly in a comment.
  test("records the zone names ICU will not keep whole", () => {
    expect(japanese.segment?.("ニューヨーク")).toEqual(["ニュー", "ヨーク"]);
    // Mid-mora, which is ICU being wrong rather than ICU disagreeing: ッ can
    // never begin a Japanese word.
    expect(japanese.segment?.("マンハッタン")).toEqual(["マンハ", "ッタン"]);
    expect(japanese.segment?.("協定世界時")).toEqual(["協定", "世界", "時"]);
    const newYork = datetimeJa.units["America/New_York"]?.aliases ?? [];
    expect(newYork).not.toContain("ニューヨーク");
    expect(newYork).not.toContain("マンハッタン");
    expect(() => engine.evaluate("15:00をニューヨーク")).toThrow();
    // And the substitutes that carry the zone instead, both inside it.
    expect(engine.evaluate("15:00をブルックリン").value?.unit).toBe("America/New_York");
    expect(engine.evaluate("15:00をボストン").value?.unit).toBe("America/New_York");
    expect(engine.evaluate("15:00をグリニッジ").value?.unit).toBe("UTC");
  });

  test("round-trips its own output, by the only route this kind has", () => {
    // What this kind prints is a formatted instant with a zone *symbol* on the
    // end, and that string is not input in any language: "2026-01-16 00:00 JST"
    // fails to parse under `en` exactly as it does under `ja`. Asserted against
    // an English engine beside the Japanese one, so the gap is attributed where
    // it belongs — to the kind's format hook, not to this translation.
    const englishEngine = createEngine({
      locales: [composeLocale(english, [datetimeEn])],
      kinds: [datetime],
      now: () => TEST_NOW,
      timeZone: TEST_ZONE,
    });
    const printed = engine.evaluate("15:00を東京").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    expect(() => englishEngine.evaluate(printed)).toThrow();
    // The round trip that *is* available, and the one that matters: a conversion
    // out and back is a fixed point on the instant and on the printed clock
    // reading alike. Both hops are Japanese words, chained through two を
    // particles with no space in the whole expression.
    const there = engine.evaluate("2026-01-15 15:00を東京");
    const back = engine.evaluate("15:00を東京をグリニッジ");
    expect(back.formatted).toBe("2026-01-15 15:00 UTC");
    expect(back.value?.canonical.toString()).toBe(there.value?.canonical.toString());
    // And the same instant reached through the Latin half, which must agree to
    // the nanosecond or one of the two layers is naming a different zone.
    expect(engine.evaluate("15:00をtokyo").value?.canonical.toString()).toBe(
      engine.evaluate("15:00を東京").value?.canonical.toString(),
    );
  });
});
