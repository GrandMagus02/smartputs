import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeKo from "./ko";

const locale = composeLocale(korean, [datetimeKo]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/**
 * Hangul, and nothing else. Where the Japanese regex in the sibling file can only
 * claim "a CJK word leaked into the language-free half" — a kanji is shared with
 * Chinese — a Hangul test is exact: the script writes Korean and no other living
 * language. It is also what separates this file's own layer from the generated
 * one, since every alias `@smartput/timezone` ships is ASCII.
 */
const HANGUL = /\p{Script=Hangul}/u;

/** Every word this vocabulary adds on top of the generated table, by zone. */
const added: Array<[string, string]> = Object.entries(datetimeKo.units).flatMap(
  ([zone, words]) =>
    words.aliases.filter((a) => HANGUL.test(a)).map((a): [string, string] => [zone, a]),
);

/**
 * The two waivers `assertLocaleContract` needs to run against this kind *at all*,
 * both derived from the data rather than written out, and both facts about
 * `@smartput/timezone` rather than about Korean — which is exactly why they are
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
 * — none of which the zone table lists as a word.
 */
const OFFSETS = Object.keys(OFFSET_ZONES).map((zone) => `datetime:${zone}`);
const SYMBOL_IS_NOT_A_WORD = Object.keys(ZONES)
  .filter((zone) => {
    const words = datetimeKo.units[zone];
    const symbol = words?.symbol?.toLowerCase();
    return symbol !== undefined && !words?.aliases.includes(symbol);
  })
  .map((zone) => `datetime:${zone}`);

describe("datetime ko vocabulary", () => {
  test("it targets Korean and names its kind by id", () => {
    expect(datetimeKo.locale).toBe("ko");
    expect(datetimeKo.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeKo.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeKo.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  test("the kind itself carries no Korean word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(HANGUL);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk` and `ja`: this file adds a layer, it does not replace one. A
    // Korean engine still reads 「15:00을 tokyo」, because recognition is
    // many-to-one.
    expect(datetimeKo.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeKo.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeKo.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeKo.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Korean words come through beside them, deduped", () => {
    expect(datetimeKo.units["Asia/Tokyo"]?.aliases).toContain("도쿄");
    expect(datetimeKo.units["Europe/Kyiv"]?.aliases).toContain("키이우");
    for (const [zone, words] of Object.entries(datetimeKo.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Korean words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and leaves
    // the rest to the table, which is affordable only because that table is already
    // English. A Korean keyboard produces Hangul, so a gap here is a zone a Korean
    // speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeKo.units[zone]?.aliases.some((a) => HANGUL.test(a)),
        `${zone} has no Korean word`,
      ).toBe(true);
    }
  });

  test("no Korean word is claimed by two zones", () => {
    // A word claimed by two units of one kind has no reading, because no context
    // the engine has can separate them. Checked over the added layer only: the
    // generated half is `@smartput/timezone`'s business and is already asserted by
    // its own tests.
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("satisfies the locale contract, with the two waivers the kind forces", () => {
    // Pinned before the call, so the waivers cannot quietly widen. Both lists are
    // properties of `@smartput/timezone` and hold identically under `en`; nothing
    // in either is a Korean decision.
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
    // Under `ko` a fraction cannot select a different key — `selectForm` has one
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
  // there is no such thing as two Tokyos. `korean.selectForm` still answers — it is
  // a function of the count and the slot and knows nothing about which units have
  // tables — so this pins that the reason nothing is indexed is the missing table
  // and not a missing key.
  test("declares no forms, and selectForm has one key it would need", () => {
    for (const [zone, words] of Object.entries(datetimeKo.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      korean.selectForm({
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
    // Through the engine rather than against the table, because that is the route a
    // user takes — and under `ko` the source particle is glued to the clock reading,
    // which splits off by itself: the digits end the run before the Hangul starts.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00을 ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Korean zone words", () => {
    // The same conversions `en.test.ts` pins, said in Korean. The clock is 24-hour
    // because "3pm" is an English spelling of a time and this engine has no English
    // in it at all.
    expect(engine.evaluate("15:00을 도쿄").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00을 일본").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00을 그리니치").formatted).toBe("2026-01-15 15:00 UTC");
    // 에서 is another spelling of `in` this language lists — it means "from", and
    // marks the source the way 을 does, so a zone has to be reachable through both.
    expect(engine.evaluate("15:00에서 도쿄").value?.unit).toBe("Asia/Tokyo");
    // A second city, and the country name beside it: Japan is one zone in this
    // table, so 일본 and 오사카 are not competing readings of 도쿄.
    expect(engine.evaluate("15:00을 오사카").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00을 상하이").formatted).toBe("2026-01-15 23:00 CST");
    // The city `ja` could not name at all, because ICU cuts ニューヨーク in two.
    // Korean is spaced, 뉴욕 is one word, and the whole question does not arise.
    expect(engine.evaluate("15:00을 뉴욕").value?.unit).toBe("America/New_York");
  });

  // The natural Korean sentence, with the directional particle glued to the target
  // — 「15:00을 도쿄로」, "15:00 into Tokyo" — and the euphonic conditional deciding
  // which shape of it is legal. This is the one place a language file can implement
  // 로/으로 at all, since a bound particle never reaches the keyword table.
  test("the target particle is stripped, on the euphonic condition", () => {
    expect(engine.evaluate("15:00을 도쿄로").value?.unit).toBe("Asia/Tokyo");
    // 본 closes in ㄴ, so 일본 takes 으로 and not 로.
    expect(engine.evaluate("15:00을 일본으로").value?.unit).toBe("Asia/Tokyo");
    // 쿄 is an open syllable, so 으로 after it is not Korean and the analyzer
    // refuses to strip it — where a flat suffix list would have stripped it happily
    // and taught the engine a spelling nobody writes.
    expect(() => engine.evaluate("15:00을 도쿄으로")).toThrow();
    // And the conditional protecting a name that merely *ends* in a particle: 두바이
    // survives because 바 is open and the nominative 이 only follows a closed
    // syllable, so 두바 is never proposed.
    expect(engine.evaluate("15:00을 두바이").value?.unit).toBe("Asia/Dubai");
  });

  test("the Latin aliases still read in a Korean engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00을 tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00을 utc").formatted).toBe("2026-01-15 15:00 UTC");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeKo.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00을 gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });

  // The zone a Korean user would type first, and the two Sino-Korean city names
  // this file will not claim. Recorded as live assertions rather than prose, so the
  // day `@smartput/timezone` grows an `Asia/Seoul` row the omission is a failing
  // test rather than a stale comment.
  test("records the names it cannot or will not claim", () => {
    expect(Object.keys(ZONES)).not.toContain("Asia/Seoul");
    expect(() => engine.evaluate("15:00을 서울")).toThrow();
    // 동경 is 東京 read in Sino-Korean and was the ordinary name for Tokyo within
    // living memory; it is also 憧憬, "yearning". 상해 is the same case for Shanghai
    // against 傷害, "bodily injury". Both are single tokens the index would happily
    // claim, and both would make an ordinary Korean noun a time zone.
    expect(datetimeKo.units["Asia/Tokyo"]?.aliases).not.toContain("동경");
    expect(datetimeKo.units["Asia/Shanghai"]?.aliases).not.toContain("상해");
    // 협정 세계시 is the official Korean rendering of UTC and is two words, so no
    // alias index can hold it — the same limit `ZONES` records for "new york", and
    // *not* the segmenter limit `ja` had to work around. 그리니치 carries the zone.
    expect(datetimeKo.units.UTC?.aliases).not.toContain("협정 세계시");
    expect(engine.evaluate("15:00을 그리니치").value?.unit).toBe("UTC");
  });

  test("round-trips its own output, by the only route this kind has", () => {
    // What this kind prints is a formatted instant with a zone *symbol* on the end,
    // and that string is not input in any language: "2026-01-16 00:00 JST" fails to
    // parse under `en` exactly as it does under `ko`. Asserted against an English
    // engine beside the Korean one, so the gap is attributed where it belongs — to
    // the kind's format hook, not to this translation.
    const englishEngine = createEngine({
      locales: [composeLocale(english, [datetimeEn])],
      kinds: [datetime],
      now: () => TEST_NOW,
      timeZone: TEST_ZONE,
    });
    const printed = engine.evaluate("15:00을 도쿄").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    expect(() => englishEngine.evaluate(printed)).toThrow();
    // The round trip that *is* available, and the one that matters: a conversion
    // out and back is a fixed point on the instant and on the printed clock reading
    // alike. Both hops are Korean words. The second particle has to stand as its
    // own word — 「도쿄를 그리니치」 written closed is one token, which is the core
    // gap `core/locale/ko.ts` reports — so the chain is written with it spaced.
    const there = engine.evaluate("2026-01-15 15:00을 도쿄");
    const back = engine.evaluate("15:00을 도쿄 를 그리니치");
    expect(back.formatted).toBe("2026-01-15 15:00 UTC");
    expect(back.value?.canonical.toString()).toBe(there.value?.canonical.toString());
    // And the same instant reached through the Latin half, which must agree to the
    // nanosecond or one of the two layers is naming a different zone.
    expect(engine.evaluate("15:00을 tokyo").value?.canonical.toString()).toBe(
      engine.evaluate("15:00을 도쿄").value?.canonical.toString(),
    );
  });
});
