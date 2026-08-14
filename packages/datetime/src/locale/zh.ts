import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Chinese words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `zh` is the bare tag and means what CLDR means by it: Simplified Chinese,
 * mainland conventions. Every name below is written in Simplified characters;
 * the Traditional spellings of the same places belong to a `zh-Hant` file rather
 * than to a fork of this one.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Chinese starts from nothing — a Chinese keyboard produces Han characters, and
 * not one alias in that table is what a Chinese speaker writes — so every named
 * zone gets an entry here, and the subset `en` could afford is not a model to
 * copy. That is the same conclusion `uk` and `ja` reached, for the same reason.
 *
 * Where Ukrainian then needed three cases per name, Chinese needs one word:
 * nothing on a Chinese noun inflects, and the particles that mark a conversion
 * (到, 为) are separate tokens `chinese.segment` has already cut away by the time
 * an alias is looked up — measured, and pinned in `zh.test.ts` rather than
 * assumed.
 *
 * **What decides whether a name can be listed at all is ICU, not Chinese.** The
 * alias index is keyed by one *segmented* word, and `chinese.segment` is
 * `Intl.Segmenter` scoped to Han — so a name ICU's dictionary does not hold comes
 * back in pieces and can never be produced as a lookup key. Every name below was
 * segmented before it was written down, and the survivors cut across what a
 * translator would guess. Three names a Chinese reader would certainly type did
 * not survive:
 *
 *   迪拜    cut into 迪 | 拜 — Dubai, and with it 杜拜 (迪 | 拜's Taiwan
 *           spelling) and 阿联酋 (阿 | 联 | 酋, the UAE)
 *   悉尼    cut into 悉 | 尼 — Sydney
 *   奥克兰  cut into 奥 | 克 | 兰 — Auckland
 *
 * This is exactly the constraint `ZONES` documents for keeping "new york" out and
 * "nyc" in, and exactly the one `ja` records for ニューヨーク — arrived at by the
 * same mechanism and landing on a different set of names, which is the point:
 * 纽约 and 曼哈顿 both survive here, so the busiest US zone needs no substitute at
 * all where Japanese had to find two. The three zones affected are reached
 * instead by another place observing the same clock — 阿布扎比, 墨尔本, 惠灵顿 —
 * and `zh.test.ts` asserts the cuts, so the day ICU learns these words the
 * omission is a failing test rather than a stale comment.
 *
 * A **country** name is listed only where the country is one zone in this table
 * *and* where naming it is not a claim about the rest of the country. 中国, 日本,
 * 印度, 法国, 德国, 乌克兰, 英国 and 新西兰 all qualify — 中国 in particular is a
 * fact about the country rather than about this table, since the mainland keeps a
 * single zone across five geographic hours. 俄罗斯 does not qualify: Russia spans
 * eleven zones and Europe/Moscow is only the westernmost. Neither does 美国, which
 * this table splits four ways. 巴西 and 澳大利亚 are the two borderline entries and
 * are listed for the reason `uk` and `ja` list them: each country has several
 * zones, and the one here is where the great majority of the population lives.
 */
const CHINESE: Record<string, readonly string[]> = {
  // 格林威治 is how Chinese names the zero meridian (格林威治标准时间), and it is
  // the only single-token route to UTC: 协调世界时, the official rendering, is
  // three words to ICU (协调 | 世界 | 时), and 格林尼治 — the other, equally
  // standard transcription of Greenwich — is cut into 格林 | 尼 | 治. One of the
  // two spellings survives and the other does not, which is ICU's dictionary
  // rather than a preference of this file's.
  UTC: ["格林威治"],
  // Both the city and its best-known borough survive whole, so this zone needs
  // none of the substitutions `ja` had to make. 波士顿 is listed for the same
  // reason `ja` lists ボストン: it is the largest other city on this clock, and
  // it is what someone converting to "US east coast" may well type.
  "America/New_York": ["纽约", "曼哈顿", "波士顿"],
  "America/Chicago": ["芝加哥"],
  "America/Denver": ["丹佛"],
  "America/Los_Angeles": ["洛杉矶", "好莱坞"],
  "America/Sao_Paulo": ["圣保罗", "巴西"],
  "Europe/London": ["伦敦", "英国", "英格兰"],
  "Europe/Paris": ["巴黎", "法国"],
  "Europe/Berlin": ["柏林", "德国"],
  // 基辅 is the transcription every Simplified source uses, and it descends from
  // the Russian form the way "Kiev" does; Chinese has not adopted a second
  // spelling from Ukrainian the way Latin script did with "Kyiv", so unlike the
  // Latin table's "kyiv"/"kiev" pair there is one word here and not two.
  "Europe/Kyiv": ["基辅", "乌克兰"],
  "Europe/Moscow": ["莫斯科"],
  // Dubai itself is unreachable (see above), so the zone is named by the other
  // Emirati city on the same clock. 阿布扎比 is the federal capital, and it
  // survives ICU whole where 迪拜, 杜拜 and 阿联酋 all come back in pieces.
  "Asia/Dubai": ["阿布扎比"],
  // 加尔各答 is the current transcription of Kolkata. 德里 and 新德里 are the two
  // spellings of Delhi, 孟买 is Mumbai — the same three cities `ZONES` already
  // names in Latin — and 印度 is the country, which is one zone.
  "Asia/Kolkata": ["加尔各答", "德里", "新德里", "孟买", "印度"],
  "Asia/Shanghai": ["上海", "北京", "中国"],
  // 大阪 is here and 京都 is not, on the same rule as the country names: Japan is
  // one zone, so a second city is not a competing reading, and 大阪 is the one a
  // Chinese user is most likely to type after 东京.
  "Asia/Tokyo": ["东京", "日本", "大阪"],
  "Asia/Singapore": ["新加坡"],
  // 悉尼 is unreachable, so the country carries the zone and 墨尔本 stands beside
  // it as the second-largest city on the identical clock (Australia/Melbourne and
  // Australia/Sydney have never differed in offset or in DST rule). 澳洲 is the
  // ordinary colloquial name for the country and is typed at least as often as
  // 澳大利亚.
  "Australia/Sydney": ["澳大利亚", "澳洲", "墨尔本"],
  // 奥克兰 is unreachable and New Zealand has one zone, so the country name is the
  // primary route; 惠灵顿 is the capital, on that same single zone.
  "Pacific/Auckland": ["新西兰", "惠灵顿"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk` and `ja`: the
    // zone table's own words first, the Chinese ones after, deduped. A Chinese
    // engine still reads 「15:00到tokyo」 — recognition is many-to-one (design
    // decision I6), and dropping the Latin aliases here would make a bilingual
    // user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(CHINESE[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Han symbol here would never be the string a
    // formatted result ends with, and would only ever be handed to `Printer`'s
    // `symbols: true`. Two spellings for one zone, disagreeing with each other,
    // is worse than one Latin abbreviation; and Chinese writing quotes these
    // abbreviations rather than translating them (UTC, JST and CET are written in
    // Latin letters in Chinese newspapers).
    symbol: def.symbol,
  };
}

/**
 * Chinese words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap — the same one
 * `uk` and `ja` took, and cheaper to state here. A `forms` table exists so a
 * *count* can pick a word, and a zone is never counted: there is no such thing as
 * two Tokyos. Under Ukrainian that meant declining to write eight keys per zone
 * across a hundred and twenty-two units; under Chinese it would be one key per
 * zone, and it is still one key nothing would ever index, because the only string
 * this kind prints comes from its own format hook.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`, `uk` and `ja`: this
 * file links neither chrono nor the zone matcher, so `@smartput/datetime/locale/zh`
 * is a translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for a
 * reason that has nothing to do with translation: "gmt+3" lexes as three tokens,
 * so no alias lookup could ever reach it, and `parseOffsetZone` is its only door.
 */
export default defineVocabulary({ locale: "zh", kind: DATETIME_KIND, units });
