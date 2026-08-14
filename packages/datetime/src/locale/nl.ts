import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Dutch words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * **This layer is `en`'s shape, not `uk`'s, and the difference is the alphabet.**
 * Ukrainian starts from nothing — not one alias in the zone table is typeable on a
 * Ukrainian layout — so `uk.ts` gives every named zone a word and says that the
 * subset `en` could afford is not a model to copy. Dutch shares the Latin alphabet
 * and, for a good many of these names, the spelling: *Chicago*, *Denver*, *Dubai*,
 * *Shanghai*'s modern rendering, *Sydney*, *Auckland* and *Singapore* are written
 * in Dutch exactly as the table already has them. So a Dutch entry earns its line
 * only where Dutch spells the name **differently** (Londen, Parijs, Berlijn,
 * Moskou, Tokio, Peking, Sjanghai, Calcutta) or where the natural one-token word
 * is the **country** (Frankrijk, Duitsland, Oekraïne, Rusland, Brazilië), which
 * the table has no reason to carry.
 *
 * Four shapes worth naming before the table:
 *
 * **Dutch spells a great many European city names its own way, and that is this
 * language's largest single contribution here.** *Londen*, *Parijs* and *Berlijn*
 * are not variants or archaisms — they are the only spellings a Dutch text uses,
 * and each is a name the shipped table has in its English form and only that.
 * German next door had none of these three to add.
 *
 * **The trema is written both ways.** *Brazilië*, *Californië*, *Oekraïne* and
 * *Australië* are the correct spellings, and each is listed beside its bare-ASCII
 * twin for the reason `nl-cardinals.ts` reads *tweeëntwintig* and *tweeentwintig*
 * alike: a keyboard that cannot produce a trema is not a reason to lose a zone.
 * The NFKC pass in `normalize()` folds compatibility characters, not diacritics,
 * so nothing upstream collapses the two for us. This is the Dutch counterpart of
 * German's ß pair, and it costs one extra alias per name rather than one per file.
 *
 * **Hyphenated and two-word names are absent, and that is not an omission.** *New
 * York*, *Los Angeles*, *São Paulo* and *Nieuw-Zeeland* are each two word tokens
 * to `lex`, and core's alias index is keyed by one segmented word, so no lookup
 * could reach them — the same reason `ZONES` documents for keeping "new york" out
 * and "nyc" in. Those zones are reached instead through a district or a region
 * whose name is one word (Manhattan, Brooklyn, Hollywood, Californië, Brazilië),
 * which is exactly the trade `en` makes. New Zealand gets one further concession:
 * the closed-up *nieuwzeeland* is listed, which is not the standard orthography
 * but is a single token, is what a reader typing into a search box produces, and
 * is read-only — nothing here is ever printed, so the spelling has to be
 * recognisable rather than correct.
 *
 * **The compound splitter is irrelevant to every word below, and it is worth
 * saying why.** `COMPOUND_HEADS` in `@smartput/core/locale/nl` is a list of
 * *measurement* heads — meter, graad, jaar — so a place name never splits against
 * it. These are lexicalised proper nouns and are enumerated, exactly as German's
 * *Neuseeland* was; the productive-compound machinery that makes Dutch interesting
 * in the length and area packages has nothing to do here.
 *
 * One thing deliberately *not* done: Belgium keeps Paris's offset, and Brussels is
 * not in `ZONES`, so "België" has no unit here to point at. Pointing it at
 * `Europe/Paris` would answer a question about one country with a fact about
 * another, and the fact would stop being true the day the table grows
 * `Europe/Brussels` — which for a Dutch-language package is the likeliest growth
 * of all.
 */
const DUTCH: Record<string, readonly string[]> = {
  // "wereldtijd" is what Dutch calls UTC — "gecoördineerde wereldtijd" — and the
  // head noun is the one carrying the meaning. The full phrase is two tokens; the
  // head alone is one.
  UTC: ["wereldtijd"],
  // Spelled identically in Dutch; listed because "New York" itself is two tokens
  // and a district is the only one-word way in.
  "America/New_York": ["manhattan", "brooklyn"],
  // Same for Los Angeles, plus the state, which Dutch spells its own way.
  "America/Los_Angeles": ["hollywood", "californië", "californie"],
  "America/Sao_Paulo": ["brazilië", "brazilie"],
  // "Londen" is the Dutch name of the city — not a variant of "London" but the
  // spelling a Dutch text uses. "Engeland" and "Brittannië" are the country words;
  // "Groot-Brittannië" is hyphenated and therefore two tokens.
  "Europe/London": ["londen", "engeland", "brittannië", "brittannie"],
  "Europe/Paris": ["parijs", "frankrijk"],
  "Europe/Berlin": ["berlijn", "duitsland"],
  // "Kiev" the table already has; Dutch writes the country "Oekraïne", which is
  // the word a Dutch reader reaches for first.
  "Europe/Kyiv": ["oekraïne", "oekraine"],
  "Europe/Moscow": ["moskou", "rusland"],
  // "Emiraten" is how Dutch names the country in ordinary speech ("in de
  // Emiraten"), where the full "Verenigde Arabische Emiraten" is three tokens.
  "Asia/Dubai": ["emiraten"],
  // "Calcutta" is the older Dutch spelling still in general use; "Delhi" and
  // "Mumbai" the table already has, and Dutch spells both the same. "Nieuw-Delhi"
  // is hyphenated, so it is two tokens and cannot be one.
  "Asia/Kolkata": ["calcutta", "india"],
  // "Peking" is not an older transliteration Dutch has moved on from — it is the
  // current Dutch name of the city the table lists as "beijing". "Sjanghai" is the
  // Dutch phonetic spelling of the zone's own city, still common beside the
  // international one the table carries.
  "Asia/Shanghai": ["sjanghai", "peking", "china"],
  // "Japan" is already in the zone table, spelled the same; "Tokio" is not.
  "Asia/Tokyo": ["tokio"],
  "Australia/Sydney": ["australië", "australie"],
  // "Nieuw-Zeeland" is hyphenated and therefore two tokens; the closed-up spelling
  // is what a search box produces and is listed for reading only.
  "Pacific/Auckland": ["nieuwzeeland"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk` and `de`: the
    // zone table's own words first, the Dutch ones after, deduped. A Dutch engine
    // still reads "15:00 in tokyo" — recognition is many-to-one (design decision
    // I6) — and dropping the Latin aliases here would make a bilingual user's input
    // stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(DUTCH[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s format
    // hook prints `zoneSymbol(zone)` — the timezone package's table, reached without
    // a locale — so a Dutch symbol here would never be the string a formatted result
    // ends with, and would only ever be handed to `Printer`'s `symbols: true`. Two
    // spellings for one zone, disagreeing with each other, is worse than one Latin
    // abbreviation; and the Latin abbreviation is what Dutch writing uses anyway.
    symbol: def.symbol,
  };
}

/**
 * Dutch words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "5 kilometer" against "1 kilometer"
 * — and a zone is never counted: there is no such thing as two Tokio's. The
 * renderer only reaches a form through `selectForm`, and the one string this kind
 * ever prints comes from its own format hook, so two keys per zone across a
 * hundred and twenty-three units would be two keys nothing would ever index.
 *
 * Dutch has less to say here than German did, and the reason is structural rather
 * than lexical: `dutch.selectForm` reads its `slot` and discards it, because modern
 * Dutch has no case marking on common nouns, so where `de.ts` had to record that
 * its dative axis is inert on a proper noun, this file has no second axis to be
 * inert. "in Tokio" is the same word as "Tokio", and there was never a key that
 * could have said otherwise.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`, `uk` and `de`: this
 * file links neither chrono nor the zone matcher, so `@smartput/datetime/locale/nl`
 * is a translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for a
 * reason that has nothing to do with translation: "gmt+3" lexes as three tokens, so
 * no alias lookup could ever reach it, and `parseOffsetZone` is its only door.
 */
export default defineVocabulary({ locale: "nl", kind: DATETIME_KIND, units });
