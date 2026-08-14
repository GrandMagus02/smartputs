import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Ukrainian words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Ukrainian starts from nothing — not one alias in that table is typeable on a
 * Ukrainian keyboard layout — so every named zone gets an entry here, and the
 * subset `en` could afford is not a model to copy.
 *
 * Three forms per name wherever the noun declines, because Ukrainian spells the
 * conversion keyword three ways and they do not govern the same case:
 *
 *   nominative  a bare mention                  "Київ"
 *   locative    what `в`/`у` governs            "15:00 у Києві"
 *   genitive    what `до` governs               "15:00 до Києва"
 *
 * All three are `in` to core — `@smartput/core/locale/uk` lists them under one
 * keyword — so a zone reachable through only one of them is a zone that stops
 * resolving when the user picks a different preposition, which is not a choice
 * they are making about zones. That the locative is the interesting one is the
 * same observation `ukrainian.selectForm` makes when it maps
 * `conversion-target` onto the locative case; the difference here is that a
 * zone has no `forms` table to select from (see below), so every case has to be
 * readable as a plain alias or the sentence a Ukrainian speaker actually writes
 * does not parse.
 *
 * The language's suffix stripper is not a substitute for listing them. It
 * strips endings off a stem and cannot undo a stem alternation: "Києві" -> "Києв"
 * lands on a string that is in no index, because the nominative is "Київ" with
 * an о/і alternation the stripper knows nothing about.
 *
 * Indeclinable names appear once and that is not an omission: Токіо, Чикаго,
 * Делі and Мумбаї are the same word in every case Ukrainian has. Feminine names
 * in -ія spell their genitive and locative alike ("Японії", "Індії"), so they
 * appear twice rather than three times — while Німеччина and Україна, which are
 * -на rather than -ія, do not ("Німеччини" against "Німеччині").
 *
 * What is *not* here is a hyphenated name. Нью-Йорк, Лос-Анджелес and
 * Сан-Паулу are each two word tokens to `lex`, and core's alias index is keyed
 * by one segmented word, so no lookup could ever reach them — the same reason
 * `ZONES` documents for keeping "new york" out and "nyc" in. Those three zones
 * are reached instead by a district or a country whose name is one word
 * (Манхеттен, Бруклін, Голлівуд, Бразилія), which is exactly the trade `en`
 * makes with "manhattan" and "brooklyn".
 */
const UKRAINIAN: Record<string, readonly string[]> = {
  // "гринвіч" is what Ukrainian actually says for the zero meridian ("за
  // Гринвічем"); "всесвітній" is the first word of "всесвітній координований
  // час", the official rendering of UTC, and it is the word carrying the
  // meaning — "координований" alone could be anything.
  UTC: ["гринвіч", "гринвіча", "гринвічі", "всесвітній"],
  "America/New_York": [
    "манхеттен",
    "манхеттена",
    "манхеттені",
    "бруклін",
    "брукліна",
    "брукліні",
  ],
  "America/Chicago": ["чикаго"],
  "America/Denver": ["денвер", "денвера", "денвері"],
  "America/Los_Angeles": ["голлівуд", "голлівуда", "голлівуді"],
  "America/Sao_Paulo": ["бразилія", "бразилії"],
  "Europe/London": [
    "лондон",
    "лондона",
    "лондоні",
    "англія",
    "англії",
    "британія",
    "британії",
  ],
  "Europe/Paris": ["париж", "парижа", "парижі", "франція", "франції"],
  "Europe/Berlin": [
    "берлін",
    "берліна",
    "берліні",
    "німеччина",
    "німеччини",
    "німеччині",
  ],
  // "Києвом" is the instrumental, and it is here for one construction rather
  // than for symmetry: "за Києвом" is how a Ukrainian timetable names this
  // zone, and `за` is one preposition away from being typed.
  "Europe/Kyiv": ["київ", "києва", "києві", "києвом", "україна", "україни", "україні"],
  "Europe/Moscow": ["москва", "москви", "москві"],
  "Asia/Dubai": ["дубай", "дубая", "дубаї"],
  // Мумбаї and Делі are indeclinable; Калькутта is not.
  "Asia/Kolkata": [
    "калькутта",
    "калькутти",
    "калькутті",
    "делі",
    "мумбаї",
    "індія",
    "індії",
  ],
  "Asia/Shanghai": [
    "шанхай",
    "шанхая",
    "шанхаї",
    "пекін",
    "пекіна",
    "пекіні",
    "китай",
    "китаю",
    "китаї",
  ],
  "Asia/Tokyo": ["токіо", "японія", "японії"],
  "Asia/Singapore": ["сингапур", "сингапура", "сингапурі"],
  "Australia/Sydney": ["сідней", "сіднея", "сіднеї", "австралія", "австралії"],
  // "Нова Зеландія" is two tokens, so only the head noun can be an alias — and
  // "Зеландія" alone is unambiguous here, since nothing else in this table is
  // named after the Dutch province.
  "Pacific/Auckland": ["окленд", "окленда", "окленді", "зеландія", "зеландії"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`: the zone table's
    // own words first, the Ukrainian ones after, deduped. A Ukrainian engine
    // still reads "3pm in tokyo" — recognition is many-to-one (design decision
    // I6), and dropping the Latin aliases here would make a bilingual user's
    // input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(UKRAINIAN[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Cyrillic symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Ukrainian writing uses anyway (UTC, CET, EET are not
    // translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Ukrainian words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "5 кілограмів" against "2
 * кілограми" — and a zone is never counted: there is no such thing as two
 * Tokyos. The renderer only reaches a form through `selectForm`, and the one
 * string this kind ever prints comes from its own format hook, so eight keys
 * per zone across a hundred and twenty-two units would be eight keys nothing
 * would ever index.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/uk` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in either language,
 * for a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "uk", kind: DATETIME_KIND, units });
