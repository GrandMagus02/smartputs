import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Hindi words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Devanagari starts from nothing — not one alias in that table is typeable on a
 * Hindi layout — so **every** named zone gets an entry here, and the subset `en`
 * could afford is not a model to copy. This is `ru`'s, `uk`'s and `ar`'s
 * position rather than `de`'s: German shares the Latin alphabet and can leave
 * "Chicago" to the table; a different script can leave nothing to it.
 *
 * Four things decide what goes in a row, and only the last of them is grammar.
 *
 * **1. One token or nothing.** `lex` ends a word token at a space, so a name
 * Hindi writes as two words can never be an alias. That is why लॉस एंजेलिस and
 * साओ पाउलो are absent and हॉलीवुड and ब्राज़ील stand in for their zones — the
 * same trade `en` makes with "manhattan" and "brooklyn", and the same one
 * `ZONES` itself documents for keeping "new york" out and "nyc" in. Hindi is
 * luckier than Cyrillic in two places: it writes New York as the single token
 * न्यूयॉर्क and New Zealand as न्यूज़ीलैंड, where Russian has the hyphenated
 * Нью-Йорк and the hyphen is the subtraction operator.
 *
 * **2. The nukta is written decomposed, and its absence is written out.** ज़, ड़
 * and फ़ are Unicode composition exclusions: NFKC, which `normalize()` applies
 * before a word reaches the resolver, decomposes U+095B/U+095C/U+095E into a bare
 * consonant plus U+093C. Every name below is written in the decomposed form, and
 * `hi.test.ts` asserts NFKC-stability over the whole table — a precomposed
 * spelling would test green here and be unreachable through the engine. The
 * *absence* of the nukta is a separate matter that no normalization will ever
 * fix: ब्राजील for ब्राज़ील and फ्रांस for फ़्रांस are ordinary Devanagari that a
 * great many people type, so each is declared beside its nukta-bearing twin.
 * This is the same pairing `hi-cardinals.ts` makes for हज़ार and हजार.
 *
 * **3. The stripper is not a substitute for a spelling.** `hindi`'s analyzer
 * chain is `identity()` plus a five-suffix stripper at `weight: -2`, and it
 * *removes* endings — it can never substitute the final vowel Hindi actually
 * changes, and there is no prefix stripper at all (Hindi has no definite article
 * for one to take off, which is the work `ar`'s does). So a spelling a reader
 * might type has to be listed, not left to be guessed at.
 *
 * **4. Case is real and invisible here, which is why every row is a list of
 * names rather than of inflections.** Hindi's conversion postpositions govern the
 * oblique — "टोक्यो में", "दिल्ली को" — and for these names that changes nothing
 * a reader types: टोक्यो and दिल्ली end in vowels Hindi does not decline
 * (ो and ी are not the ा that becomes े), and the consonant-final ones
 * (लंदन, बर्लिन, जापान) have an oblique singular identical to their direct
 * singular. That is the reading side of the same fact
 * `@smartput/core/locale/hi`'s `selectForm` cites when it declines a case axis:
 * where `uk` and `ru` need three forms of every place name because their `in`
 * keyword governs three different cases, Hindi needs one.
 *
 * A country name doubles as a zone word wherever the country has one zone, which
 * is how `en` reaches Europe/Berlin through "germany". भारत is the row that
 * matters most in this file and the one `en` renders as "india": Asia/Kolkata is
 * the home zone of the language this vocabulary is written in, and a Hindi user
 * asking for a time "भारत में" is the commonest query this table will ever see.
 */
const HINDI: Record<string, readonly string[]> = {
  // ग्रीनविच is Greenwich, which is what Hindi says for the zero meridian
  // ("ग्रीनविच मानक समय"); यूटीसी and जीएमटी are the two acronyms transliterated,
  // which is how they are actually written in Devanagari running text rather than
  // quoted in Latin. वैश्विक ("universal") is the adjective carrying the meaning
  // of "समन्वित वैश्विक समय", and it is `en`'s "universal" said in Hindi.
  UTC: ["ग्रीनविच", "यूटीसी", "जीएमटी", "वैश्विक"],
  // Hindi writes New York as one token, so unlike Russian this zone keeps its own
  // name and does not have to be reached through a district.
  "America/New_York": ["न्यूयॉर्क", "न्यूयार्क", "मैनहट्टन", "ब्रुकलिन"],
  "America/Chicago": ["शिकागो"],
  "America/Denver": ["डेनवर"],
  // लॉस एंजेलिस is two tokens in every Hindi spelling of it, so the zone is
  // reached by a district and by the state, exactly as `en` reaches it by
  // "hollywood". कैलिफ़ोर्निया is unambiguous here — the whole state is in this
  // one zone — and appears with and without its nukta.
  "America/Los_Angeles": ["हॉलीवुड", "कैलिफ़ोर्निया", "कैलिफोर्निया"],
  // साओ पाउलो is two tokens; the country is one.
  "America/Sao_Paulo": ["ब्राज़ील", "ब्राजील"],
  "Europe/London": ["लंदन", "इंग्लैंड", "ब्रिटेन"],
  "Europe/Paris": ["पेरिस", "फ़्रांस", "फ्रांस"],
  "Europe/Berlin": ["बर्लिन", "जर्मनी"],
  "Europe/Kyiv": ["कीव", "कीएव", "यूक्रेन"],
  // मॉस्को with the candrabindu-less ऑ and मास्को with a plain ा are the two
  // spellings Hindi print uses for the same city; neither folds onto the other.
  "Europe/Moscow": ["मॉस्को", "मास्को", "रूस"],
  // संयुक्त अरब अमीरात is three tokens, so the country is reached by its head
  // noun alone, which is also what Hindi news writes on second mention.
  "Asia/Dubai": ["दुबई", "अमीरात"],
  // The home zone. All three cities the Latin table lists get their Devanagari
  // names, and भारत is the word a Hindi speaker will actually type.
  "Asia/Kolkata": ["कोलकाता", "कलकत्ता", "दिल्ली", "मुंबई", "भारत"],
  "Asia/Shanghai": ["शंघाई", "बीजिंग", "चीन"],
  "Asia/Tokyo": ["टोक्यो", "जापान"],
  "Asia/Singapore": ["सिंगापुर"],
  "Australia/Sydney": ["सिडनी", "ऑस्ट्रेलिया", "आस्ट्रेलिया"],
  // न्यूज़ीलैंड is one token in Hindi, where "Новая Зеландия" is two in Russian —
  // so this zone keeps its country name outright instead of surrendering the
  // qualifier.
  "Pacific/Auckland": ["ऑकलैंड", "न्यूज़ीलैंड", "न्यूजीलैंड"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk`, `ru` and
    // `ar`: the zone table's own words first, the Hindi ones after, deduped. A
    // Hindi engine still reads "15:00 में tokyo" — recognition is many-to-one
    // (design decision I6), and dropping the Latin aliases here would make a
    // bilingual user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(HINDI[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Devanagari symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Hindi writing uses anyway (IST, UTC and GMT are not
    // translated in an Indian timetable, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Hindi words for the datetime kind's units, which are IANA zone ids.
 *
 * **No `forms` on any unit, and the absence is a claim rather than a gap.** A
 * `forms` table exists so a *count* can pick a word, and a zone is never
 * counted: there is no such thing as two Tokyos. `hindi.selectForm` returns
 * `one` or `other` — two keys, not Arabic's six or Ukrainian's eight — but two
 * keys across a hundred and twenty-two units would still be two keys nothing
 * would ever index. And the axis a slot could have carried is not written in
 * Hindi for these names either: the oblique that a postposition governs is
 * identical to the direct for every one of them (see `HINDI` above), so what a
 * reader types belongs in `aliases` and there is nothing left for a table only
 * the printer reads. `selectForm` still answers when asked, because it is a
 * function of the count and the slot and knows nothing about which units carry
 * tables, which is why `hi.test.ts` asserts the absence rather than inferring it.
 *
 * **Devanagari digits are inherited and left alone.**
 * `@smartput/core/locale/hi` documents why "१५:००" does not lex — `lex` decides
 * digit-ness with an ASCII range test and १ is `\p{Nd}`, so it is skipped as an
 * unrecognized character before anything could read it — so every clock in
 * `hi.test.ts` is written with Latin digits. That is a core-level gap named
 * there, not one a word list can close.
 *
 * The one change Hindi needed outside its own language file was in `lex` and is
 * what makes this kind reachable at all: a letter run was built out of `\p{L}`
 * alone, and an abugida hangs its vowels on the consonants as combining marks,
 * so टोक्यो lexed as the bare consonant ट. `lex` now continues a run through a
 * `\p{M}` (never starts one on it). Without it not one alias in this file could
 * be typed.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/hi` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "hi", kind: DATETIME_KIND, units });
