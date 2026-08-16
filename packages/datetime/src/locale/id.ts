import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Indonesian words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * **This layer is `en`'s shape, not `uk`'s, and the difference is the alphabet.**
 * Ukrainian starts from nothing — not one alias in the zone table is typeable on a
 * Ukrainian layout — so `uk.ts` gives every named zone a word. Indonesian shares the
 * Latin alphabet and, for most city names, the spelling: *Chicago*, *Denver*,
 * *Dubai*, *Shanghai*, *Sydney*, *Auckland*, *London*, *Paris*, *Berlin*, *Tokyo*
 * and *Delhi* are written in Indonesian exactly as the table already has them. So an
 * Indonesian entry earns its line only where Indonesian spells the name
 * **differently** (Singapura, Moskwa, Kalkuta, Kalifornia) or where the natural
 * one-token word is the **country** (Inggris, Prancis, Jerman, Ukraina, Rusia,
 * Jepang, Tiongkok, Brasil), which the table has no reason to carry.
 *
 * **This language spells country names its own way far more often than it spells
 * city names its own way, and that is its largest single contribution here.**
 * Indonesian country names come through Dutch and Portuguese rather than through
 * English — *Inggris* (England, via Portuguese *inglês*), *Prancis* (France),
 * *Jerman* (Germany), *Jepang* (Japan), *Brasil*, *Rusia*, *Ukraina* — and every one
 * of them is a single token, which is exactly the shape an alias index can hold. A
 * Dutch or German file adds mostly cities; this one adds mostly countries.
 *
 * Four shapes worth naming before the table:
 *
 * **Two-word names are absent, and that is not an omission.** *New York*, *Los
 * Angeles*, *São Paulo*, *Selandia Baru* (New Zealand), *Uni Emirat Arab* and *Korea
 * Selatan* are each two or more word tokens to `lex`, and core's alias index is keyed
 * by one segmented word, so no lookup could reach them — the same reason `ZONES`
 * documents for keeping "new york" out and "nyc" in. Those zones are reached instead
 * through a district or a region whose name is one word (Manhattan, Brooklyn,
 * Hollywood, Kalifornia, Brasil), which is exactly the trade `en` makes.
 *
 * **Nothing is closed up to dodge that, where `nl.ts` allowed itself one.** Dutch
 * lists *nieuwzeeland* — not the standard orthography, but a single token a search
 * box produces. Indonesian gets no such concession, because this language does not
 * compound at all: a modifier stands apart from its head as its own word, always, so
 * *selandiabaru* is not a spelling anybody would type even by accident, and *baru*
 * alone means "new". Pacific/Auckland therefore keeps only the table's own words,
 * and `id.test.ts` records that rather than papering over it.
 *
 * **Where Indonesian has two current spellings, both are listed.** *Moskwa* is the
 * standard rendering of Moscow and *Moskow* is common in the press; *Tiongkok* is the
 * name for China preferred since 2014 and *Cina* is the older one still in wide use.
 * Neither pair is an archaism the language has moved on from, and an alias is read
 * and never printed, so listing both costs one index slot and loses no reader.
 * `indonesian.analyze` is a bare `identity()` with no stripper behind it, so an
 * unlisted variant is unreachable rather than merely penalised — which makes
 * enumerating variants this language's job in a way it is not German's.
 *
 * **Asia/Jakarta is not in `ZONES`, and this file cannot add it.** The one zone an
 * Indonesian vocabulary most obviously wants — WIB, Western Indonesian Time, the zone
 * seven of every ten Indonesians live in — has no unit id to name, and a `Vocabulary`
 * may only name units the kind declares. So *Jakarta*, *WIB*, *WITA* and *WIT* appear
 * nowhere below, and pointing any of them at Asia/Singapore (the same UTC+07:00 is
 * not even true — Singapore is +08:00) or at Asia/Shanghai would answer a question
 * about one country with a fact about another. Reported rather than faked, and pinned
 * as a failing-if-fixed assertion in `id.test.ts`: the repair is a row in
 * `@smartput/timezone`, which is neither this package nor this file.
 */
const INDONESIAN: Record<string, readonly string[]> = {
  // "universal" is the head of *Waktu Universal Terkoordinasi*, which is the phrase
  // Indonesian uses for UTC; *waktu* alone is just "time" and belongs to nobody.
  UTC: ["universal"],
  // Spelled identically in Indonesian; listed because "New York" itself is two
  // tokens and a district is the only one-word way in.
  "America/New_York": ["manhattan", "brooklyn"],
  // Same for Los Angeles, plus the state, which Indonesian spells its own way.
  "America/Los_Angeles": ["hollywood", "kalifornia"],
  // "São Paulo" is two tokens and carries a diacritic besides; the country is one
  // word, and Indonesian writes it "Brasil" with an s.
  "America/Sao_Paulo": ["brasil"],
  // "Inggris" is Indonesian for England — borrowed through Portuguese *inglês*, not
  // through English — and it is what an Indonesian reader reaches for first.
  // "Britania" is the narrower word, used where the distinction matters; "Britania
  // Raya" (Great Britain) is two tokens and cannot be one alias.
  "Europe/London": ["inggris", "britania"],
  // "Prancis" is the standard spelling and "Perancis" the older one, still in
  // official use in Malaysia and common in Indonesian print.
  "Europe/Paris": ["prancis", "perancis"],
  "Europe/Berlin": ["jerman"],
  // "Kiev" the table already has; Indonesian writes the country "Ukraina", with the
  // -a ending Dutch and German give it rather than English's.
  "Europe/Kyiv": ["ukraina"],
  // "Moskwa" is the standard Indonesian rendering — transliterating the Russian w
  // rather than the English ow — and "Moskow" is the commoner press spelling.
  "Europe/Moscow": ["moskwa", "moskow", "rusia"],
  // "Uni Emirat Arab" is three tokens; "Emirat" is the head and is what ordinary
  // speech uses ("di Emirat").
  "Asia/Dubai": ["emirat"],
  // "Kalkuta" is the Indonesian spelling of the zone's own city. "Delhi" and
  // "Mumbai" the table already has, spelled the same way.
  "Asia/Kolkata": ["kalkuta", "india"],
  // "Tiongkok" is the name for China that Indonesian officially adopted in 2014 —
  // *Cina* is the older word, still in wide use and neither obsolete nor neutral —
  // and both read here. "Beijing" and "Shanghai" the table already carries.
  "Asia/Shanghai": ["tiongkok", "cina"],
  // "Jepang" is Indonesian for Japan, from the same Min Nan source Dutch *Japan* and
  // English "Japan" come through, respelled to Indonesian orthography.
  "Asia/Tokyo": ["jepang"],
  // The one city name Indonesian genuinely spells its own way: "Singapura" is the
  // Malay/Indonesian form, and the table's "singapore" is the English one.
  "Asia/Singapore": ["singapura"],
  "Australia/Sydney": ["australia"],
  // Pacific/Auckland gets nothing: "Selandia Baru" is two tokens, Indonesian does not
  // compound, and "Auckland" is already in the table spelled as Indonesian spells it.
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk`, `de` and `nl`:
    // the zone table's own words first, the Indonesian ones after, deduped. An
    // Indonesian engine still reads "15:00 in tokyo" — recognition is many-to-one
    // (design decision I6) — and dropping the Latin aliases here would make a
    // bilingual user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(INDONESIAN[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s format
    // hook prints `zoneSymbol(zone)` — the timezone package's table, reached without
    // a locale — so an Indonesian symbol here would never be the string a formatted
    // result ends with, and would only ever be handed to `Printer`'s `symbols: true`.
    // Two spellings for one zone, disagreeing with each other, is worse than one
    // Latin abbreviation; and the Latin abbreviation is what Indonesian writing uses
    // anyway.
    symbol: def.symbol,
  };
}

/**
 * Indonesian words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms` table
 * exists so a *count* can pick a word — "5 kilometer" against "1 kilometer" — and a
 * zone is never counted: there is no such thing as two Jakartas. The renderer only
 * reaches a form through `selectForm`, and the one string this kind ever prints comes
 * from its own format hook, so a table here would be keys nothing would ever index.
 *
 * Indonesian has less to say about that than any sibling, and the reason is
 * structural rather than lexical. German had to record that its dative axis is inert
 * on a proper noun; Dutch had to record that it has no second axis to be inert.
 * `indonesian.selectForm` returns the constant `"other"` for every count and every
 * slot, so there was never a key that could have said otherwise about anything — "di
 * Tokyo" is the same word as "Tokyo", and so is "lima Tokyo", which is not a phrase
 * this language has either.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`, `uk`, `de` and `nl`:
 * this file links neither chrono nor the zone matcher, so
 * `@smartput/datetime/locale/id` is a translation someone can ship without owning the
 * kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for a
 * reason that has nothing to do with translation: "gmt+3" lexes as three tokens, so
 * no alias lookup could ever reach it, and `parseOffsetZone` is its only door.
 */
export default defineVocabulary({ locale: "id", kind: DATETIME_KIND, units });
