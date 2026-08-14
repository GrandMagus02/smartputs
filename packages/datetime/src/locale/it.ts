import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Italian words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * Italian sits where Spanish sits, and for the same reason. Ukrainian had to
 * name every zone, because not one alias in the shipped table is typeable on a
 * Ukrainian layout; English had to name almost none, because that table is
 * already English. Italian shares the script and therefore the keyboard, so a
 * zone Italian spells the way the table does — Chicago, Denver, Singapore,
 * Sydney, Dubai — is already reachable, and a byte-identical alias would buy
 * nothing. What Italian changes is:
 *
 *   the **exonym**, where Italian has a name of its own for the place: Londra
 *   for London, Parigi for Paris, Berlino for Berlin, Mosca for Moscow, Pechino
 *   for Beijing, Calcutta for Kolkata. None is recoverable from the English form
 *   by any analyzer — `it.ts`'s fold substitutes a final vowel, and "londra" is
 *   not "london" with a vowel swapped — so each is a word an Italian speaker
 *   cannot reach without this file.
 *
 *   the **country**, which is how a person most often names a zone they do not
 *   live in — "le 15 in Giappone", not "le 15 a Tokyo". English adds a handful
 *   of these; Italian adds one for every zone whose country name is a single
 *   token, which is nearly all of them, Italian having its own single-word name
 *   for every country in this table.
 *
 * What is **not** here is the written accent, and its absence is worth stating
 * because the Spanish file next door is half made of it. Italian writes an acute
 * or grave only on a final stressed vowel, and not one of these names ends in
 * one: "Parigi", "Berlino", "Mosca", "Dubai", "Sydney" are all unaccented in
 * Italian orthography where Spanish writes "París", "Berlín", "Moscú", "Dubái",
 * "Sídney". So no accent-free variant has to be declared beside an accented one:
 * there is no accented one.
 *
 * Hyphens and spaces are what is also not here, for the reason `ZONES`
 * documents for keeping "new york" out: core's alias index is keyed by one
 * segmented word, so "Nuova York", "Los Angeles", "San Paolo" and "Nuova
 * Zelanda" can never be looked up. Each is reached instead by the one word of
 * its name that carries the meaning ("zelanda") or by a district or country that
 * is a single word (Manhattan, Brooklyn, Brasile) — the same trade `en` makes
 * with "manhattan" and `uk` makes with "зеландія".
 */
const ITALIAN: Record<string, readonly string[]> = {
  // "universale" is the word carrying the meaning in "tempo universale
  // coordinato", the Italian rendering of UTC — "coordinato" alone could be
  // anything. It survives `foldNumerals` intact, which is not obvious: the
  // welded-numeral parser matches the atom "un" at its front and then finds
  // nothing it can read in "iversale", and because it must consume the whole
  // token it refuses the word rather than claiming a piece of it. "greenwich" is
  // what an Italian clock face says ("ora di Greenwich"); Italian quotes the
  // English spelling rather than adapting it.
  UTC: ["universale", "greenwich"],
  "America/New_York": ["manhattan", "brooklyn"],
  // "Los Angeles" is two words in Italian as in English, so the meaning-bearing
  // half is what can be indexed. Italian writes no accent on it.
  "America/Los_Angeles": ["hollywood", "angeles"],
  "America/Sao_Paulo": ["brasile"],
  "Europe/London": ["londra", "inghilterra"],
  "Europe/Paris": ["parigi", "francia"],
  "Europe/Berlin": ["berlino", "germania"],
  // "kiev" is already in the table and is also the traditional Italian spelling;
  // "kyiv" is there too, and is the form Italian institutional usage has moved
  // to. Only the country is missing.
  "Europe/Kyiv": ["ucraina"],
  "Europe/Moscow": ["mosca", "russia"],
  "Asia/Dubai": ["emirati"],
  // Delhi and Mumbai are spelled as the table spells them; Calcutta is not —
  // Italian keeps the older transcription with its double t.
  "Asia/Kolkata": ["calcutta", "india"],
  "Asia/Shanghai": ["pechino", "cina"],
  // "Tokyo" is the standard Italian spelling and is already in the table, so
  // only the country is added. "Tokio" is a dated variant and is left out: it
  // would be a second spelling of a word that already reads.
  "Asia/Tokyo": ["giappone"],
  "Australia/Sydney": ["australia"],
  "Pacific/Auckland": ["zelanda"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk` and `es`: the
    // zone table's own words first, the Italian ones after, deduped. An Italian
    // engine still reads "15:00 in tokyo" — recognition is many-to-one (design
    // decision I6), and dropping the Latin aliases here would make a bilingual
    // user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(ITALIAN[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so an Italian symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Italian writing uses anyway (UTC, CET and EET are not
    // translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Italian words for the datetime kind's units, which are IANA zone ids.
 *
 * The kind next door names no language at all: after ruling R1 its `units` is a
 * bare array of zone ids, and every word anyone types to reach one of them lives
 * here. That is the same split every ratio kind got — the difference is only
 * that a zone's "unit id" is already a proper noun, so the id and the word look
 * alike.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "2 metri" against "1 metro" — and
 * a zone is never counted: there is no such thing as due Tokyo. The renderer
 * only reaches a form through `selectForm`, and the one string this kind ever
 * prints comes from its own format hook, so two keys per zone across a hundred
 * and twenty-two units would be two keys nothing would ever index. Italian is
 * also a language where a gender axis would be tempting — "il Giappone", "la
 * Francia", and the preposition contracts with the article ("in Giappone" but
 * "negli Emirati") — and it stays out for the same reason `it.ts` folds CLDR's
 * `many` into `other`: an axis is added in `selectForm` and nowhere else, and
 * nothing here would read it.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/it` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in every language,
 * for a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "it", kind: DATETIME_KIND, units });
