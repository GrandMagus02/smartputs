import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The French words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * French sits where Spanish and Italian sit, and for the same reason. Ukrainian
 * had to name every zone, because not one alias in the shipped table is typeable
 * on a Ukrainian layout; English had to name almost none, because that table is
 * already English. French shares the script and therefore the keyboard, so a
 * zone French spells the way the table does — Chicago, Denver, Berlin, Sydney,
 * Shanghai — is already reachable, and a byte-identical alias would buy nothing.
 * What French changes is:
 *
 *   the **exonym**, where French has a name of its own for the place: Londres
 *   for London, Moscou for Moscow, Pékin for Beijing, Calcutta for Kolkata,
 *   Singapour for Singapore. None is recoverable from the English form by any
 *   analyzer — `fr.ts`'s chain is `identity` plus a stripper that takes a final
 *   -s or -x off, and "londres" minus its -s is "londre", not "london" — so each
 *   is a word a French speaker cannot reach without this file.
 *
 *   the **country**, which is how a person most often names a zone they do not
 *   live in — "15 h au Japon", not "15 h à Tokyo". English adds a handful of
 *   these; French adds one for every zone whose country name is a single token,
 *   which is nearly all of them, French having its own single-word name for every
 *   country in this table.
 *
 *   the **written accent**, which is the half the Italian file next door does not
 *   need and the Spanish one is made of. `normalize()`'s NFKC pass leaves a
 *   precomposed é as é rather than stripping it, so "pekin" typed on a keyboard
 *   without accents is a *different string* to the alias index than "pékin".
 *   Every accented word below therefore ships with its bare-vowel twin beside it,
 *   the same concession `fr-cardinals.ts` makes for "zéro"/"zero".
 *
 * Hyphens and spaces are what is **not** here, for the reason `ZONES` documents
 * for keeping "new york" out: core's alias index is keyed by one segmented word,
 * so "Nouvelle-Zélande", "Los Angeles", "São Paulo" and "Grande-Bretagne" can
 * never be looked up — and a hyphen is worse than a space here, since
 * `normalize()` maps every dash to "-" and the lexer emits it as an *operator*.
 * Each is reached instead by the one word of its name that carries the meaning
 * ("zélande", "brésil") or by a district that is a single word (Manhattan,
 * Brooklyn) — the same trade `en` makes with "manhattan" and `uk` makes with
 * "зеландія".
 */
const FRENCH: Record<string, readonly string[]> = {
  // "universel" is the word carrying the meaning in "temps universel coordonné",
  // the French rendering of UTC — "coordonné" alone could be anything. It is
  // safe from the numeral fold in a way that is worth stating, because Italian's
  // "universale" was not: French's fold matches whole words against its four
  // tables, so the "un" at the front of this one is never looked at.
  // "greenwich" is what a French clock face says ("heure de Greenwich"); French
  // quotes the English spelling rather than adapting it.
  UTC: ["universel", "greenwich"],
  "America/New_York": ["manhattan", "brooklyn"],
  // "Los Angeles" is two words in French as in English, so the meaning-bearing
  // half is what can be indexed. French writes no accent on it.
  "America/Los_Angeles": ["hollywood", "angeles"],
  // "São Paulo" is two words and carries a tilde French does not type, so the
  // country is the reachable name.
  "America/Sao_Paulo": ["brésil", "bresil"],
  "Europe/London": ["londres", "angleterre"],
  // "Paris" is already in the table and French spells it identically, so only the
  // country is added.
  "Europe/Paris": ["france"],
  "Europe/Berlin": ["allemagne"],
  // "kiev" is already in the table and is the traditional French spelling;
  // "kyiv" is there too, and is the form French institutional usage has moved to.
  // Only the country is missing.
  "Europe/Kyiv": ["ukraine"],
  "Europe/Moscow": ["moscou", "russie"],
  // The tréma on "Dubaï" is French orthography for the two-syllable reading; the
  // table's bare "dubai" already covers the keyboard that cannot write it.
  "Asia/Dubai": ["dubaï", "émirats", "emirats"],
  // Delhi and Mumbai are spelled as the table spells them; Calcutta is not —
  // French keeps the older transcription with its double t.
  "Asia/Kolkata": ["calcutta", "inde"],
  "Asia/Shanghai": ["pékin", "pekin", "chine"],
  // "Tokyo" is the standard French spelling and is already in the table, so only
  // the country is added.
  "Asia/Tokyo": ["japon"],
  // One of the few zones whose *city* French respells: Singapour, not Singapore.
  "Asia/Singapore": ["singapour"],
  "Australia/Sydney": ["australie"],
  "Pacific/Auckland": ["zélande", "zelande"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk`, `es` and
    // `it`: the zone table's own words first, the French ones after, deduped. A
    // French engine still reads "15:00 en tokyo" — recognition is many-to-one
    // (design decision I6), and dropping the Latin aliases here would make a
    // bilingual user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(FRENCH[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a French symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what French writing uses anyway (UTC, CET and EET are not
    // translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * French words for the datetime kind's units, which are IANA zone ids.
 *
 * The kind next door names no language at all: after ruling R1 its `units` is a
 * bare array of zone ids, and every word anyone types to reach one of them lives
 * here. That is the same split every ratio kind got — the difference is only that
 * a zone's "unit id" is already a proper noun, so the id and the word look alike.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "2 mètres" against "1 mètre" — and
 * a zone is never counted: there is no such thing as deux Tokyo. The renderer
 * only reaches a form through `selectForm`, and the one string this kind ever
 * prints comes from its own format hook, so two keys per zone across a hundred
 * and twenty-two units would be two keys nothing would ever index. French is also
 * a language where a gender axis would be tempting — "le Japon", "la France",
 * and the preposition contracts with the article ("au Japon" but "aux Émirats") —
 * and it stays out for the same reason `fr.ts` folds CLDR's `many` into `other`:
 * an axis is added in `selectForm` and nowhere else, and nothing here would read
 * it.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/fr` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in every language,
 * for a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "fr", kind: DATETIME_KIND, units });
