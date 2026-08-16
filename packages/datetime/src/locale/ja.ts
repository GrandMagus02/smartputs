import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Japanese words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Japanese starts from nothing — a Japanese keyboard produces kana, and not one
 * alias in that table is what a Japanese speaker writes — so every named zone
 * gets an entry here, and the subset `en` could afford is not a model to copy.
 * That is the same conclusion `uk` reached, for the same reason.
 *
 * Where Ukrainian then needed three cases per name, Japanese needs one word.
 * Nouns do not decline, and the particles that mark the conversion (を, から) are
 * separate tokens that `japanese.segment` has already cut away by the time an
 * alias is looked up — measured, and pinned in `ja.test.ts` rather than assumed.
 * So this table is a third the size of the Ukrainian one and carries the same
 * coverage.
 *
 * **What decides whether a name can be listed at all is ICU, not Japanese.** The
 * alias index is keyed by one *segmented* word, and `japanese.segment` is
 * `Intl.Segmenter` scoped to the three Japanese scripts — so a name ICU's
 * dictionary does not hold comes back in pieces and can never be produced as a
 * lookup key. Every name below was segmented before it was written down, and
 * three that a Japanese reader would certainly type did not survive:
 *
 *   ニューヨーク  cut into ニュー | ヨーク
 *   マンハッタン  cut into マンハ | ッタン — mid-mora, which is ICU being wrong
 *                 rather than ICU disagreeing
 *   協定世界時    cut into 協定 | 世界 | 時, the official rendering of UTC
 *
 * This is exactly the constraint `ZONES` documents for keeping "new york" out and
 * "nyc" in, and exactly the one `uk` records for Нью-Йорк — arrived at by a
 * different mechanism (a segmenter dictionary rather than a space) and landing in
 * the same place. The three zones affected are reached instead by a district or a
 * city inside the same zone whose name ICU does hold: ブルックリン and ボストン
 * for the US east coast, グリニッジ for UTC. `ja.test.ts` asserts the cuts, so
 * the day ICU learns these words the omission is a failing test rather than a
 * stale comment.
 *
 * A **country** name is listed only where the country is one zone in this table
 * *and* where naming it is not a claim about the rest of the country. 日本,
 * 中国, インド, フランス, ドイツ, ウクライナ, イギリス and ニュージーランド all
 * qualify. ロシア does not — Russia spans eleven zones and Europe/Moscow is only
 * the westernmost — and neither does アメリカ, which this table splits four ways.
 * ブラジル and オーストラリア are the two borderline entries and are listed for
 * the reason `uk` lists them: each country has several zones, and the one here is
 * where the great majority of the population lives.
 */
const JAPANESE: Record<string, readonly string[]> = {
  // グリニッジ is how Japanese names the zero meridian (グリニッジ標準時), and it
  // is the only single-token route to UTC: 協定世界時, the official rendering, is
  // three words to ICU, and 標準時 on its own means "standard time" — a phrase
  // every other zone in this table could equally claim.
  UTC: ["グリニッジ"],
  // ニューヨーク and マンハッタン are both unreachable (see above), so the zone is
  // named by two other places inside it. ブルックリン is `en`'s own choice;
  // ボストン is added because it is the largest city in this zone whose Japanese
  // name is one segment, and dropping to a single alias for the busiest US zone
  // would be thin.
  "America/New_York": ["ブルックリン", "ボストン"],
  "America/Chicago": ["シカゴ"],
  "America/Denver": ["デンバー"],
  "America/Los_Angeles": ["ロサンゼルス", "ハリウッド"],
  "America/Sao_Paulo": ["サンパウロ", "ブラジル"],
  "Europe/London": ["ロンドン", "イギリス", "英国"],
  "Europe/Paris": ["パリ", "フランス"],
  "Europe/Berlin": ["ベルリン", "ドイツ"],
  // キエフ is the older transcription, from Russian, and キーウ the current one
  // adopted from Ukrainian; both are typed, and the Latin table already carries
  // the same pair as "kyiv"/"kiev".
  "Europe/Kyiv": ["キーウ", "キエフ", "ウクライナ"],
  "Europe/Moscow": ["モスクワ"],
  "Asia/Dubai": ["ドバイ"],
  // コルカタ is the current transcription and カルカッタ the older one, exactly
  // the pair the Latin table carries as "kolkata". デリー and ムンバイ are the
  // other two cities `ZONES` already names in Latin.
  "Asia/Kolkata": ["コルカタ", "カルカッタ", "デリー", "ムンバイ", "インド"],
  // The two Chinese city names are written in kanji in Japanese and read with
  // Japanese pronunciations (シャンハイ, ペキン) — the characters are the word, and
  // they are what a Japanese keyboard produces.
  "Asia/Shanghai": ["上海", "北京", "中国"],
  // 大阪 is here and 京都 is not, on the same rule as the country names: Japan is
  // one zone, so a second city is not a competing reading, and 大阪 is the one a
  // Japanese user is most likely to type after 東京. 京都 would be a third entry
  // buying nothing the first two do not already reach.
  "Asia/Tokyo": ["東京", "大阪", "日本"],
  "Asia/Singapore": ["シンガポール"],
  "Australia/Sydney": ["シドニー", "オーストラリア", "豪州"],
  "Pacific/Auckland": ["オークランド", "ニュージーランド"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en` and `uk`: the zone
    // table's own words first, the Japanese ones after, deduped. A Japanese
    // engine still reads 「15:00をtokyo」 — recognition is many-to-one (design
    // decision I6), and dropping the Latin aliases here would make a bilingual
    // user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(JAPANESE[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a katakana symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and Japanese writing
    // quotes these abbreviations rather than translating them (UTC, JST, CET are
    // written in Latin letters in Japanese newspapers).
    symbol: def.symbol,
  };
}

/**
 * Japanese words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap — the same one
 * `uk` took, and cheaper to state here. A `forms` table exists so a *count* can
 * pick a word, and a zone is never counted: there is no such thing as two Tokyos.
 * Under Ukrainian that meant declining to write eight keys per zone across a
 * hundred and twenty-two units; under Japanese it would be one key per zone, and
 * it is still one key nothing would ever index, because the only string this kind
 * prints comes from its own format hook.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en` and `uk`: this file
 * links neither chrono nor the zone matcher, so `@smartput/datetime/locale/ja` is
 * a translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "ja", kind: DATETIME_KIND, units });
