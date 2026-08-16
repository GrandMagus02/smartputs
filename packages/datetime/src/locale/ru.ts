import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Russian words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * `en` next door adds a handful of spelled-out names because the zone table is
 * already English: "tokyo" and "jst" are in it, so only "japan" was missing.
 * Russian starts from nothing — not one alias in that table is typeable on a
 * Russian keyboard layout — so every named zone gets an entry here, and the
 * subset `en` could afford is not a model to copy. This is `uk`'s position
 * rather than `de`'s: German shares the Latin alphabet and can leave "Chicago"
 * to the table, and Cyrillic cannot leave anything to it.
 *
 * Three forms per name wherever the noun declines, because Russian spells the
 * conversion keyword three ways and they do not govern the same case:
 *
 *   nominative     a bare mention              "Киев"
 *   prepositional  what `в` governs            "15:00 в Киеве"
 *   genitive       what `до` and `у` govern    "15:00 до Киева"
 *
 * All three are `in` to core — `@smartput/core/locale/ru` lists them under one
 * keyword — so a zone reachable through only one of them is a zone that stops
 * resolving when the user picks a different preposition, which is not a choice
 * they are making about zones. That the prepositional is the interesting one is
 * the same observation `russian.selectForm` makes when it maps
 * `conversion-target` onto that case (under Ukrainian's `"loc"` label, as `ru.ts`
 * explains at length); the difference here is that a zone has no `forms` table to
 * select from (see below), so every case has to be readable as a plain alias or
 * the sentence a Russian speaker actually writes does not parse.
 *
 * The language's suffix stripper covers more of this than Ukrainian's does, and
 * the list is written out anyway. Russian city names mostly decline without a
 * stem alternation — "Киеве" → "Киев" is a clean strip, where Ukrainian's
 * "Києві" → "Києв" lands on a non-word because the nominative is "Київ" with an
 * о/і alternation — but the stripper is penalised (`weight: -2`) and a word this
 * file expects a reader to type should be an entry rather than a guess.
 * "Москвы" and "Москве" are the case that proves the point: both strip to
 * "москв", which is in no index at all.
 *
 * Indeclinable names appear once and that is not an omission: Токио, Чикаго,
 * Дели and Мумбаи are the same word in every case Russian has. Feminine names in
 * -ия spell their genitive and prepositional alike ("Японии", "Индии"), so they
 * appear twice rather than three times — while Москва and Украина, which are -ва
 * and -на rather than -ия, do not ("Москвы" against "Москве").
 *
 * What is *not* here is a hyphenated name. Нью-Йорк, Лос-Анджелес and Сан-Паулу
 * are each three tokens to `lex` — the hyphen is the subtraction operator — so no
 * lookup could ever reach them, the same reason `ZONES` documents for keeping
 * "new york" out and "nyc" in. Those three zones are reached instead by a
 * district or a country whose name is one word (Манхэттен, Бруклин, Голливуд,
 * Бразилия), which is exactly the trade `en` makes with "manhattan" and
 * "brooklyn".
 */
const RUSSIAN: Record<string, readonly string[]> = {
  // "гринвич" is what Russian actually says for the zero meridian ("по
  // Гринвичу"); "всемирное" is the first word of "всемирное координированное
  // время", the official rendering of UTC, and it is the word carrying the
  // meaning — "координированное" alone could be anything.
  UTC: ["гринвич", "гринвича", "гринвиче", "всемирное"],
  "America/New_York": [
    "манхэттен",
    "манхэттена",
    "манхэттене",
    "бруклин",
    "бруклина",
    "бруклине",
  ],
  "America/Chicago": ["чикаго"],
  "America/Denver": ["денвер", "денвера", "денвере"],
  "America/Los_Angeles": ["голливуд", "голливуда", "голливуде"],
  "America/Sao_Paulo": ["бразилия", "бразилии"],
  "Europe/London": [
    "лондон",
    "лондона",
    "лондоне",
    "англия",
    "англии",
    "британия",
    "британии",
  ],
  "Europe/Paris": ["париж", "парижа", "париже", "франция", "франции"],
  "Europe/Berlin": ["берлин", "берлина", "берлине", "германия", "германии"],
  "Europe/Kyiv": ["киев", "киева", "киеве", "украина", "украины", "украине"],
  // "Москвой" is the instrumental, and it is here for one construction rather
  // than for symmetry: "по Москве" is the ordinary way a Russian timetable names
  // this zone, and "за Москвой" is one preposition away from being typed.
  "Europe/Moscow": ["москва", "москвы", "москве", "москвой"],
  "Asia/Dubai": ["дубай", "дубая", "дубае"],
  // Мумбаи and Дели are indeclinable; Калькутта is not.
  "Asia/Kolkata": [
    "калькутта",
    "калькутты",
    "калькутте",
    "дели",
    "мумбаи",
    "индия",
    "индии",
  ],
  "Asia/Shanghai": [
    "шанхай",
    "шанхая",
    "шанхае",
    "пекин",
    "пекина",
    "пекине",
    "китай",
    "китая",
    "китае",
  ],
  "Asia/Tokyo": ["токио", "япония", "японии"],
  "Asia/Singapore": ["сингапур", "сингапура", "сингапуре"],
  "Australia/Sydney": ["сидней", "сиднея", "сиднее", "австралия", "австралии"],
  // "Новая Зеландия" is two tokens, so only the head noun can be an alias — and
  // "Зеландия" alone is unambiguous here, since nothing else in this table is
  // named after the Dutch province.
  //
  // "nz" is the one Latin alias this table has to add by hand. Every other zone
  // below gets its symbol back for free, because the symbol is also one of the
  // words `ZONES` already generates; Auckland's is not. English reaches it
  // through its own spelled-out list ("nz"), and a Russian table that only added
  // Cyrillic would leave `symbols: true` printing an "NZ" this engine could not
  // read back — the printer emitting a string its own reader rejects, which is
  // the failure `assertLocaleContract`'s printable check exists to catch.
  "Pacific/Auckland": ["окленд", "окленда", "окленде", "зеландия", "зеландии", "nz"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en` and `uk`: the zone
    // table's own words first, the Russian ones after, deduped. A Russian engine
    // still reads "15:00 в tokyo" — recognition is many-to-one (design decision
    // I6), and dropping the Latin aliases here would make a bilingual user's
    // input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(RUSSIAN[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Cyrillic symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Russian writing uses anyway (UTC, CET, MSK are not
    // translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Russian words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "5 килограммов" against "2
 * килограмма" — and a zone is never counted: there is no such thing as two
 * Токио. The case axis has nothing to add either, because it is exactly what the
 * aliases above already carry: "в Киеве" is a spelling a reader *types*, and a
 * form the parser must recognise is an alias, not a printed form. The renderer
 * only reaches a form through `selectForm`, and the one string this kind ever
 * prints comes from its own format hook, so eight keys per zone across a hundred
 * and twenty-two units would be eight keys nothing would ever index.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/ru` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "ru", kind: DATETIME_KIND, units });
