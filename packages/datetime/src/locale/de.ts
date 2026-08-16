import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The German words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * **This layer is `en`'s shape, not `uk`'s, and the difference is the alphabet.**
 * Ukrainian starts from nothing — not one alias in the zone table is typeable on
 * a Ukrainian layout — so `uk.ts` gives every named zone a word and says that
 * the subset `en` could afford is not a model to copy. German shares the Latin
 * alphabet and, for most of these names, the spelling: *Chicago*, *Denver*,
 * *Dubai*, *London*, *Paris*, *Berlin* and *Sydney* are written in German
 * exactly as the table already has them. So a German entry earns its line only
 * where German spells the name **differently** (Tokio, Kiew, Moskau, Singapur,
 * Kalkutta, Peking) or where the natural one-token word is the **country**
 * (Frankreich, Deutschland, Brasilien, Neuseeland), which the table has no
 * reason to carry.
 *
 * Three shapes worth naming before the table:
 *
 * **Country names are one token in German where they are two in English.**
 * *Neuseeland*, *Großbritannien* and *Deutschland* are single words, so they can
 * be aliases; "New Zealand" cannot, which is why `en` reaches that zone through
 * "nz". This is German compounding doing something useful for once without the
 * splitter — these are lexicalised names, not productive compounds, so they are
 * enumerated rather than cut.
 *
 * **Both spellings of ß.** *Großbritannien* is listed beside *Grossbritannien*
 * for the reason `de-cardinals.ts` lists *dreissig* beside *dreißig*: Swiss
 * German has no ß at all, and a keyboard that cannot produce one is not a reason
 * to lose the zone.
 *
 * **Hyphenated and two-word names are absent, and that is not an omission.**
 * *New York*, *Los Angeles*, *São Paulo* and *Neu-Delhi* are each two word
 * tokens to `lex`, and core's alias index is keyed by one segmented word, so no
 * lookup could reach them — the same reason `ZONES` documents for keeping "new
 * york" out and "nyc" in. Those zones are reached instead through a district or
 * a state whose name is one word (Manhattan, Brooklyn, Hollywood, Kalifornien,
 * Brasilien), which is exactly the trade `en` makes.
 *
 * One thing deliberately *not* done: Austria and Switzerland keep Berlin's
 * offset, and Vienna and Zurich are not in `ZONES`, so "Österreich" and
 * "Schweiz" have no unit here to point at. Pointing them at `Europe/Berlin`
 * would answer a question about one place with a fact about another, and the
 * fact would stop being true the day the table grows `Europe/Vienna`.
 */
const GERMAN: Record<string, readonly string[]> = {
  // "Weltzeit" is what German calls UTC — "koordinierte Weltzeit" — and
  // "Universalzeit" is the older rendering still used in astronomy. The head
  // noun is the one carrying the meaning, and both are single words.
  UTC: ["weltzeit", "universalzeit"],
  // Spelled identically in German; listed because "New York" itself is two
  // tokens and a district is the only one-word way in.
  "America/New_York": ["manhattan", "brooklyn"],
  // Same for Los Angeles, plus the state, which German spells its own way.
  "America/Los_Angeles": ["hollywood", "kalifornien"],
  "America/Sao_Paulo": ["brasilien"],
  "Europe/London": ["england", "großbritannien", "grossbritannien"],
  "Europe/Paris": ["frankreich"],
  "Europe/Berlin": ["deutschland"],
  // "Kiew" is the German spelling of the city; "Ukraine" is the same word in
  // both languages and is listed because it is the one a German writes first.
  "Europe/Kyiv": ["kiew", "ukraine"],
  "Europe/Moscow": ["moskau", "russland"],
  // "Emirate" is how German names the country in ordinary speech ("in den
  // Emiraten"), where the full "Vereinigte Arabische Emirate" is three tokens.
  "Asia/Dubai": ["emirate"],
  // "Kalkutta" is the German spelling; "Delhi" and "Mumbai" the table already
  // has, and they are spelled the same. "Neu-Delhi" is hyphenated, so it is two
  // tokens and cannot be one.
  "Asia/Kolkata": ["kalkutta", "indien"],
  // "Peking" is not an older transliteration German has moved on from — it is
  // the current German name of the city the table lists as "beijing".
  // "Schanghai" is the German spelling of the zone's own city.
  "Asia/Shanghai": ["schanghai", "peking", "china"],
  // "Japan" is already in the zone table, spelled the same; "Tokio" is not.
  "Asia/Tokyo": ["tokio"],
  "Asia/Singapore": ["singapur"],
  "Australia/Sydney": ["australien"],
  // "Neuseeland" is one word in German where "New Zealand" is two, which is why
  // this zone needs no district the way New York does.
  //
  // "nz" is listed beside it, and it is not an English word smuggled in: it is
  // this unit's own `symbol`, which `ZONES` sets to "NZ" and does **not** carry
  // in its alias list. Rule 5 — every form the vocabulary prints must be one it
  // reads — is therefore unsatisfiable for this zone unless the vocabulary adds
  // it, which is exactly why `en.ts` next door lists "nz" and nothing else here.
  // Dropping it in favour of the German name alone left `Printer`'s
  // `symbols: true` emitting an "NZ" this engine could not read back; it is the
  // one zone in the table where the symbol is not also a generated alias.
  "Pacific/Auckland": ["neuseeland", "nz"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en` and `uk`: the zone
    // table's own words first, the German ones after, deduped. A German engine
    // still reads "15:00 in tokyo" — recognition is many-to-one (design decision
    // I6) — and dropping the Latin aliases here would make a bilingual user's
    // input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(GERMAN[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a German symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what German writing uses anyway (UTC, CET, MEZ is quoted
    // beside it, never instead of it).
    symbol: def.symbol,
  };
}

/**
 * German words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "5 Kilometer" against "1
 * Kilometer" — and a zone is never counted: there is no such thing as two
 * Tokios. The renderer only reaches a form through `selectForm`, and the one
 * string this kind ever prints comes from its own format hook, so four keys per
 * zone across a hundred and twenty-three units would be four keys nothing would
 * ever index. German's dative-plural axis has nothing to say about a proper noun
 * either — "in Tokio" is the same word as "Tokio".
 *
 * Named by **id string** through `DATETIME_KIND`, like `en` and `uk`: this file
 * links neither chrono nor the zone matcher, so `@smartput/datetime/locale/de`
 * is a translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "de", kind: DATETIME_KIND, units });
