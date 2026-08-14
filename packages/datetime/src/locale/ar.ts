import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Arabic words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Arabic starts from nothing — not one alias in that table is typeable on an
 * Arabic keyboard layout — so **every** named zone gets an entry here, and the
 * subset `en` could afford is not a model to copy. This is `ru`'s and `uk`'s
 * position rather than `de`'s: German shares the Latin alphabet and can leave
 * "Chicago" to the table; a different script can leave nothing to it.
 *
 * Three things decide what goes in a row, and none of them is grammar — which is
 * the surprise of writing Arabic for this kind, after five other files in this
 * phase where grammar decided everything.
 *
 * **1. One token or nothing.** `lex` ends a word token at a space, so a name
 * Arabic writes as two words can never be an alias. That is why لوس أنجلوس and
 * ساو باولو are absent and هوليوود and البرازيل stand in for their zones — the
 * same trade `en` makes with "manhattan" and "brooklyn", and the same one `ZONES`
 * itself documents for keeping "new york" out and "nyc" in. Arabic is luckier
 * than Russian here in one place: it writes New York as the single token
 * نيويورك, where Cyrillic has the hyphenated Нью-Йорк and the hyphen is the
 * subtraction operator.
 *
 * **2. Hamza spellings come in pairs.** `arabic`'s orthographic analyzer folds
 * أ، إ، آ and ى toward the plain alif, so it removes a hamza the user typed and
 * can never invent one they did not. Every name written with a hamza — أستراليا,
 * ألمانيا, أوكرانيا, إنجلترا, الإمارات, أوكلاند — therefore appears twice, once
 * carefully and once as an ordinary keyboard produces it. The analyzer closes the
 * gap in one direction; only this file can close the other.
 *
 * **3. The definite article is written, and stripping it is a guess.** Arabic
 * country names split into two classes: اليابان، الصين، الهند، البرازيل،
 * الإمارات take an obligatory ال, while فرنسا، ألمانيا، أوكرانيا، بريطانيا do
 * not. `arabic`'s prefix stripper recovers the bare stem from the first class at
 * `weight: -2` (اليابان → يابان clears its `minStem: 3` floor), and it is
 * penalised precisely so that a declared alias outranks a guess — so both
 * spellings are listed for those five. That is the same reasoning `ru.ts` gives
 * for writing out the case forms its own stripper could mostly have reached.
 *
 * What Arabic does *not* need here is the thing Russian and Ukrainian needed
 * most. Those files carry three forms of every name because their conversion
 * keyword governs three different cases (в Києві / до Києва). Arabic's
 * prepositions govern the genitive, and the genitive of a proper noun is marked
 * by a final short vowel that Arabic does not write: طوكيو after إلى is spelled
 * exactly like طوكيو after في. That is the same fact `@smartput/core/locale/ar`'s
 * `selectForm` cites when it declines a second, slot-driven axis, seen from the
 * reading side — and it is why every row below is a list of *names*, not of
 * inflections.
 */
const ARABIC: Record<string, readonly string[]> = {
  // غرينتش is Greenwich, which is what Arabic actually says for the zero meridian
  // ("بتوقيت غرينتش"), spelled with either غ or ج for the foreign /g/ — a
  // pronunciation difference written down, not a different word. العالمي is the
  // adjective of "التوقيت العالمي", the standard rendering of UTC, and it is the
  // word carrying the meaning: التوقيت alone is just "the time".
  UTC: ["غرينتش", "جرينتش", "غرينيتش", "جرينيتش", "العالمي", "عالمي"],
  // Arabic writes New York as one token, so unlike Russian this zone keeps its
  // own name and does not have to be reached through a district.
  "America/New_York": ["نيويورك", "مانهاتن", "بروكلين", "بروكلن"],
  "America/Chicago": ["شيكاغو", "شيكاجو"],
  "America/Denver": ["دنفر", "دينفر"],
  // لوس أنجلوس is two tokens in every Arabic spelling of it, so the zone is
  // reached by a district and by the state, exactly as `en` reaches it by
  // "hollywood". كاليفورنيا is unambiguous here — the whole state is in this one
  // zone.
  "America/Los_Angeles": ["هوليوود", "هوليود", "كاليفورنيا"],
  // ساو باولو is two tokens; the country is one, and takes the article.
  "America/Sao_Paulo": ["البرازيل", "برازيل"],
  "Europe/London": ["لندن", "إنجلترا", "انجلترا", "انكلترا", "بريطانيا"],
  "Europe/Paris": ["باريس", "فرنسا"],
  "Europe/Berlin": ["برلين", "ألمانيا", "المانيا"],
  // كيف is deliberately not listed as a shorter spelling of the city: it is
  // Arabic for "how", one of the commonest words in the language, and claiming it
  // would make an interrogative a time zone in every composed engine.
  "Europe/Kyiv": ["كييف", "أوكرانيا", "اوكرانيا"],
  "Europe/Moscow": ["موسكو", "روسيا"],
  "Asia/Dubai": ["دبي", "الإمارات", "الامارات", "إمارات", "امارات"],
  "Asia/Kolkata": ["كلكتا", "دلهي", "مومباي", "الهند", "هند"],
  "Asia/Shanghai": ["شنغهاي", "شانغهاي", "بكين", "الصين", "صين"],
  "Asia/Tokyo": ["طوكيو", "اليابان", "يابان"],
  "Asia/Singapore": ["سنغافورة", "سنغافورا", "سينغافورة"],
  "Australia/Sydney": ["سيدني", "سدني", "أستراليا", "استراليا"],
  // نيوزيلندا is one token in Arabic, where "Новая Зеландия" is two in Russian —
  // so this zone keeps its country name outright instead of surrendering the
  // qualifier.
  "Pacific/Auckland": ["أوكلاند", "اوكلاند", "نيوزيلندا", "نيوزيلاندا"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk` and `ru`: the
    // zone table's own words first, the Arabic ones after, deduped. An Arabic
    // engine still reads "15:00 في tokyo" — recognition is many-to-one (design
    // decision I6), and dropping the Latin aliases here would make a bilingual
    // user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(ARABIC[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so an Arabic symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Arabic writing uses anyway (UTC, CET and GMT are not
    // translated in an Arabic timetable, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Arabic words for the datetime kind's units, which are IANA zone ids.
 *
 * **No `forms` on any unit, and in Arabic that absence is worth more than a
 * shrug.** `arabic.selectForm` returns six categories where English returns two,
 * and one of them is a genuine dual — كيلوغرامان, a suffixed noun meaning
 * precisely two of the thing. None of that reaches here, for two independent
 * reasons. A `forms` table exists so a *count* can pick a word, and a zone is
 * never counted: there is no such thing as طوكيوان, two Tokyos. And the case a
 * preposition governs, which is what a slot axis would have carried, is marked in
 * Arabic by a final short vowel that nobody writes — so the alias list above is
 * already every spelling a reader can type, and there is nothing left for a table
 * only the printer reads. Six keys across a hundred and twenty-two units would be
 * six keys nothing would ever index.
 *
 * **Digits and direction, both inherited and both left alone.**
 * `@smartput/core/locale/ar` pins the `latn` numbering system because the engine
 * can only emit Latin digits, so "١٥:٠٠" does not lex and every clock in
 * `ar.test.ts` is written with Latin digits. And the formatted string is in
 * *logical* order — date, time, zone abbreviation — which the Unicode
 * Bidirectional Algorithm arranges at display time; nothing here is reversed and
 * nothing here should be.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/ar` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "ar", kind: DATETIME_KIND, units });
