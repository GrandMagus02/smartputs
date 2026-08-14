import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Spanish words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * Spanish sits between the two vocabularies that came before it. Ukrainian had
 * to name every zone, because not one alias in the shipped table is typeable on
 * a Ukrainian layout; English had to name almost none, because that table is
 * already English. Spanish shares the script and therefore the keyboard, so a
 * zone whose name Spanish spells the same way — Chicago, Denver, Dubái's
 * consonants, Singapur's stem — is already reachable, and adding a byte-identical
 * alias would buy nothing. What Spanish does change is:
 *
 *   the **exonym**, where Spanish has its own name for the place: Londres for
 *   London, Moscú for Moscow, Tokio for Tokyo, Calcuta for Kolkata, Pekín for
 *   Beijing. None of these is recoverable from the English form by any analyzer,
 *   so each is a word a Spanish speaker cannot reach without this file.
 *
 *   the **written accent**, where the name is otherwise the same: París, Berlín,
 *   Moscú, Dubái, Shanghái, Sídney, Japón. NFKC folding leaves a precomposed á
 *   as á rather than stripping it, so "parís" and "paris" are two different
 *   strings to the alias index and the accented one has to be declared. The
 *   unaccented spelling is already in the table for four of them and is added
 *   for the rest, because a keyboard without accents is the commoner keyboard.
 *
 *   the **country**, which is how a person most often names a zone they do not
 *   live in — "las 3 en Japón", not "las 3 en Tokio". English adds a handful of
 *   these; Spanish adds one for every zone that has a single-token country name.
 *
 * Hyphens and spaces are what is *not* here, for the reason `ZONES` documents
 * for keeping "new york" out: core's alias index is keyed by one segmented word,
 * so "Nueva York", "Los Ángeles", "São Paulo" and "Nueva Zelanda" can never be
 * looked up. Each of those four is reached instead by the one word of its name
 * that carries the meaning ("ángeles", "zelanda") or by a district or country
 * that is a single word (Manhattan, Brooklyn, Brasil) — the same trade `en`
 * makes with "manhattan" and `uk` makes with "зеландія".
 */
const SPANISH: Record<string, readonly string[]> = {
  // "universal" is the first word of "tiempo universal coordinado", the official
  // Spanish rendering of UTC, and the word carrying the meaning — "coordinado"
  // alone could be anything. "greenwich" is what a Spanish clock face and a
  // Spanish weather report actually say ("hora de Greenwich"); Spanish quotes
  // the English spelling rather than adapting it.
  UTC: ["universal", "greenwich"],
  "America/New_York": ["manhattan", "brooklyn"],
  "America/Los_Angeles": ["hollywood", "ángeles", "angeles"],
  "America/Sao_Paulo": ["brasil"],
  "Europe/London": ["londres", "inglaterra"],
  "Europe/Paris": ["parís", "francia"],
  "Europe/Berlin": ["berlín", "alemania"],
  // "kiev" is already in the table and is the Spanish spelling too; the RAE now
  // prefers "Kyiv", which is also already there. Only the country is missing.
  "Europe/Kyiv": ["ucrania"],
  "Europe/Moscow": ["moscú", "rusia"],
  "Asia/Dubai": ["dubái", "emiratos"],
  // Delhi and Mumbai are spelled as the table spells them; Calcutta is not.
  "Asia/Kolkata": ["calcuta", "india"],
  "Asia/Shanghai": ["shanghái", "pekín", "pekin", "china"],
  "Asia/Tokyo": ["tokio", "japón"],
  "Asia/Singapore": ["singapur"],
  "Australia/Sydney": ["sídney", "australia"],
  "Pacific/Auckland": ["zelanda"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en` and `uk`: the zone
    // table's own words first, the Spanish ones after, deduped. A Spanish engine
    // still reads "15:00 en tokyo" — recognition is many-to-one (design decision
    // I6), and dropping the Latin aliases here would make a bilingual user's
    // input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(SPANISH[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Spanish symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Spanish writing uses anyway (UTC, CET and EET are not
    // translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Spanish words for the datetime kind's units, which are IANA zone ids.
 *
 * The kind next door names no language at all: after ruling R1 its `units` is a
 * bare array of zone ids, and every word anyone types to reach one of them lives
 * here. That is the same split every ratio kind got — the difference is only
 * that a zone's "unit id" is already a proper noun, so the id and the word look
 * alike.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "2 metros" against "1 metro" — and
 * a zone is never counted: there is no such thing as two Tokios. The renderer
 * only reaches a form through `selectForm`, and the one string this kind ever
 * prints comes from its own format hook, so two keys per zone across a hundred
 * and twenty-two units would be two keys nothing would ever index. Spanish is
 * also the language where a gender axis would be tempting — "el Japón", "la
 * India" — and it stays out for the same reason `es.ts` folds CLDR's `many` into
 * `other`: an axis is added in `selectForm` and nowhere else, and nothing here
 * would read it.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/es` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in every language,
 * for a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "es", kind: DATETIME_KIND, units });
