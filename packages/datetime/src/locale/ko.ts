import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Korean words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Korean starts from nothing — a Korean keyboard produces Hangul, and not one
 * alias in that table is what a Korean speaker writes — so every named zone gets
 * an entry here, and the subset `en` could afford is not a model to copy. That is
 * the same conclusion `uk` and `ja` reached, for the same reason.
 *
 * Where Ukrainian then needed three cases per name, Korean needs one word. Nouns
 * do not decline; what looks like an ending is a bound *particle*, and
 * `korean.analyze` peels it off with `particleStripper` before the alias index is
 * consulted — 「도쿄로」 resolves to Asia/Tokyo through 도쿄, and 「도쿄으로」 is
 * refused because 쿄 is an open syllable and 으로 is the wrong shape after one.
 * So this table is a third the size of the Ukrainian one and carries the same
 * coverage, and `ko.test.ts` pins the refusal rather than trusting it.
 *
 * **What may be listed at all is decided by the space, and that is where Korean
 * parts company with its two neighbours rather than with English.** `ja` had to
 * run every candidate through `Intl.Segmenter` and lost ニューヨーク, マンハッタン
 * and 協定世界時 to ICU's dictionary. Korean has been spaced since the 1896
 * 독립신문, `lex` has already cut at every space, and `defaultSegment` hands a
 * Hangul run straight back whole — so ICU takes nothing away here, and 뉴욕 is
 * listable where ニューヨーク was not. The limit that remains is `en`'s and `uk`'s
 * limit: the alias index is keyed by one word, so a *two-word* Korean name cannot
 * be an entry. Nothing below is two words. 협정 세계시 (the official rendering of
 * UTC) is, and is left out for exactly the reason "new york" is left out of
 * `ZONES` — with 그리니치 carrying the zone instead, as ja's グリニッジ does.
 *
 * A **country** name is listed only where the country is one zone in this table
 * *and* where naming it is not a claim about the rest of the country. 일본, 중국,
 * 인도, 프랑스, 독일, 우크라이나, 영국 and 뉴질랜드 all qualify. 러시아 does not —
 * Russia spans eleven zones and Europe/Moscow is only the westernmost — and
 * neither does 미국, which this table splits four ways. 브라질 and 호주 are the two
 * borderline entries and are listed for the reason `uk` and `ja` list them: each
 * country has several zones, and the one here is where the great majority of the
 * population lives.
 *
 * **Two Sino-Korean city names are deliberately absent, and both for homography
 * rather than for style.** 동경 is the Sino-Korean reading of 東京 and was the
 * ordinary Korean name for Tokyo within living memory; it is also 憧憬,
 * "yearning", a word in current use. 상해 is the same case for Shanghai against
 * 傷害, "bodily injury" — a term of art in Korean law. Both are single tokens
 * that the index would happily claim, and both would make an ordinary Korean noun
 * a time zone. The modern transcriptions 도쿄 and 상하이 are what a Korean reader
 * writes today and carry no such second reading.
 *
 * **The one zone a Korean user would type first is not here, and cannot be.**
 * There is no `Asia/Seoul` in `ZONES`, so 서울 and 한국 name no unit this kind
 * declares, and a `Vocabulary` may only name units the kind declares (rule 2).
 * Mapping either onto `Asia/Tokyo` because the two share UTC+9 today would be a
 * wrong answer dressed as coverage — a zone is a rule about offsets over time,
 * not an offset. Reported, not faked; the fix is a row in `@smartput/timezone`.
 */
const KOREAN: Record<string, readonly string[]> = {
  // 그리니치 is how Korean names the zero meridian (그리니치 표준시) and is the only
  // single-token route to UTC: 협정 세계시, the official rendering, is two words,
  // and 표준시 on its own means "standard time" — a phrase every other zone in
  // this table could equally claim.
  UTC: ["그리니치"],
  // 뉴욕 is one Korean word, which is the whole difference from `ja`: the same
  // city is unreachable there because ICU cuts ニューヨーク in two. 보스턴 is added
  // as the second-largest city in the zone, matching what `ja` had to do for
  // want of the first.
  "America/New_York": ["뉴욕", "보스턴"],
  "America/Chicago": ["시카고"],
  "America/Denver": ["덴버"],
  // 엘에이 is the initialism spelled out in Hangul, which is how it is typed when
  // the keyboard is in Korean mode; the Latin "la" is already in `ZONES`.
  "America/Los_Angeles": ["로스앤젤레스", "엘에이"],
  "America/Sao_Paulo": ["상파울루", "브라질"],
  "Europe/London": ["런던", "영국"],
  "Europe/Paris": ["파리", "프랑스"],
  "Europe/Berlin": ["베를린", "독일"],
  // 키이우 is the current transcription, adopted from Ukrainian in 2022, and
  // 키예프 the older one by way of Russian; both are typed, and the Latin table
  // already carries the same pair as "kyiv"/"kiev".
  "Europe/Kyiv": ["키이우", "키예프", "우크라이나"],
  "Europe/Moscow": ["모스크바"],
  // 두바이 ends in 이, which is also the nominative particle — and it survives
  // because `particleStripper` checks the environment: 바 is an open syllable and
  // 이 only follows a closed one, so the stripper never proposes 두바. 뭄바이 and
  // 상하이 below are protected by the same condition.
  "Asia/Dubai": ["두바이"],
  // 콜카타 is the current transcription and 캘커타 the older one, exactly the pair
  // the Latin table carries as "kolkata". 델리 and 뭄바이 are the other two cities
  // `ZONES` already names in Latin.
  "Asia/Kolkata": ["콜카타", "캘커타", "델리", "뭄바이", "인도"],
  "Asia/Shanghai": ["상하이", "베이징", "중국"],
  // 오사카 is here and 교토 is not, on the same rule as the country names: Japan is
  // one zone, so a second city is not a competing reading, and 오사카 is the one a
  // Korean user is most likely to type after 도쿄.
  "Asia/Tokyo": ["도쿄", "오사카", "일본"],
  "Asia/Singapore": ["싱가포르"],
  // 호주 is the Sino-Korean name and what Korean actually writes;
  // 오스트레일리아 is the transcription the standard prescribes and what an
  // atlas prints. Both are typed, so both are read.
  "Australia/Sydney": ["시드니", "호주", "오스트레일리아"],
  // 오클랜드 is also how Korean spells Oakland, California. Only one of the two is
  // a zone in this table, so the collision costs nothing today — and it is
  // recorded here because the day `America/Los_Angeles` acquires a second city
  // name, this is the word not to pick.
  "Pacific/Auckland": ["오클랜드", "뉴질랜드"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk` and `ja`: the
    // zone table's own words first, the Korean ones after, deduped. A Korean
    // engine still reads 「15:00을 tokyo」 — recognition is many-to-one (design
    // decision I6), and dropping the Latin aliases here would make a bilingual
    // user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(KOREAN[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Hangul symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and Korean writing quotes
    // these abbreviations rather than translating them (UTC, KST and CET are
    // written in Latin letters in Korean newspapers).
    symbol: def.symbol,
  };
}

/**
 * Korean words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap — the same one
 * `uk` and `ja` took, and cheaper to state here. A `forms` table exists so a
 * *count* can pick a word, and a zone is never counted: there is no such thing as
 * two Tokyos. Under Ukrainian that meant declining to write eight keys per zone
 * across a hundred and twenty-two units; under Korean it would be one key per
 * zone, and it is still one key nothing would ever index, because the only string
 * this kind prints comes from its own format hook.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`, `uk` and `ja`: this
 * file links neither chrono nor the zone matcher, so `@smartput/datetime/locale/ko`
 * is a translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "ko", kind: DATETIME_KIND, units });
