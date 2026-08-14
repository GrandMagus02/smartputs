import { defineVocabulary, type UnitWords } from "@smartput/core";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Turkish words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * **This layer is `en`'s shape, not `uk`'s, and the difference is the alphabet.**
 * Ukrainian starts from nothing — not one alias in the zone table is typeable on
 * a Ukrainian layout — so `uk.ts` gives every named zone a word. Turkish is
 * written in Latin letters, so an entry earns its line only where Turkish spells
 * the name **differently** (Londra, Moskova, Kalküta, Kaliforniya, Singapur,
 * Sidney) or where the natural one-token word is the **country** (İngiltere,
 * Fransa, Almanya, Ukrayna, Rusya, Japonya, Çin, Hindistan, Brezilya), which the
 * zone table has no reason to carry.
 *
 * **Turkish respells a foreign place name far more often than an Indonesian or a
 * German file has to, and that is its largest single contribution here.** The
 * 1928 alphabet reform made spelling phonemic and the rule was applied to
 * toponyms as well as to common nouns, so a city keeps its pronunciation and
 * loses its foreign orthography: London → *Londra*, Moscow → *Moskova*, Calcutta
 * → *Kalküta*, Sydney → *Sidney*, Singapore → *Singapur*. A Dutch or Indonesian
 * file adds mostly countries and passes the city names through untouched; this
 * one adds both.
 *
 * Four shapes worth naming before the table:
 *
 * **Two-word names are absent, and that is not an omission.** *New York*, *Los
 * Angeles*, *São Paulo*, *Yeni Zelanda* (New Zealand) and *Birleşik Arap
 * Emirlikleri* (the UAE) are each two or more word tokens to `lex`, and core's
 * alias index is keyed by one segmented word, so no lookup could reach them — the
 * same reason `ZONES` documents for keeping "new york" out and "nyc" in. Those
 * zones are reached instead through a district or a region whose name is one word
 * (Manhattan, Brooklyn, Hollywood, Kaliforniya, Brezilya), which is exactly the
 * trade `en` makes. Nothing is closed up to dodge it: Turkish compounds only
 * where the language itself has lexicalised the compound, and *yenizelanda* is
 * not a string anyone types even by accident.
 *
 * **Where a Turkish word carries a letter an ASCII keyboard lacks, the plain
 * spelling is listed beside it — but only where the plain spelling is not
 * already another word.** This is `tr-cardinals.ts`'s rule, which lists "uc"
 * beside "üç", and `@smartput/core/locale/tr`'s, which lists "cevir" beside
 * "çevir". *Kalküta* gets its ASCII twin *kalkuta*, which means nothing else in
 * Turkish. *Çin* does **not** get *cin*: that is the ordinary noun for a jinn (and
 * for gin), so claiming it would turn a sentence about a spirit into a time zone.
 * The dotted/dotless i needs no such entry anywhere below, because
 * `@smartput/core/locale/tr`'s `caseFolds` analyzer already reaches "İNGİLTERE"
 * and "INGILTERE" alike from the single lowercase alias.
 *
 * **Europe/Istanbul is not in `ZONES`, and this file cannot add it.** The one
 * zone a Turkish vocabulary most obviously wants — the zone every Turkish reader
 * is in — has no unit id to name, and a `Vocabulary` may only name units the kind
 * declares. So *İstanbul*, *Ankara*, *Türkiye* and *TSİ* (Türkiye Saati İle)
 * appear nowhere below. The temptation to point them at Europe/Moscow is
 * unusually strong and unusually wrong: Turkey has kept UTC+03:00 year round
 * since 2016, so Moscow's offset is Turkey's offset and the alias would print the
 * **right number** — while answering a question about one country with a fact
 * about another, and breaking the day either country legislates. Reported rather
 * than faked, and pinned as a failing-if-fixed assertion in `tr.test.ts`: the
 * repair is a row in `@smartput/timezone`, which is neither this package nor this
 * file.
 */
const TURKISH: Record<string, readonly string[]> = {
  // "evrensel" is the head of *Eşgüdümlü Evrensel Zaman*, Turkish for
  // Coordinated Universal Time. *Zaman* alone is just "time" and belongs to
  // nobody; *eşgüdümlü* is the modifier and never stands alone.
  UTC: ["evrensel"],
  // Spelled identically in Turkish; listed because "New York" itself is two
  // tokens and a district is the only one-word way in.
  "America/New_York": ["manhattan", "brooklyn"],
  // Same for Los Angeles, plus the state, which Turkish respells with a y.
  "America/Los_Angeles": ["hollywood", "kaliforniya"],
  // "São Paulo" is two tokens and carries a diacritic besides; the country is one
  // word, and Turkish writes it "Brezilya".
  "America/Sao_Paulo": ["brezilya"],
  // "Londra" is the Turkish name of the city — through Italian *Londra* rather
  // than from English — and it is a different string from the table's "london".
  // "İngiltere" is England, the word an ordinary sentence reaches for first;
  // "Britanya" is the narrower one, used where the distinction matters, and
  // "Büyük Britanya" is two tokens and cannot be one alias.
  "Europe/London": ["londra", "ingiltere", "britanya"],
  // Paris is spelled the same; the country is not carried by the table.
  "Europe/Paris": ["fransa"],
  "Europe/Berlin": ["almanya"],
  // "Kiev" the table already has; Turkish writes the country "Ukrayna", with the
  // -y- Turkish orthography puts between the two vowels.
  "Europe/Kyiv": ["ukrayna"],
  // "Moskova" is the Turkish name of the city, and "Rusya" the country.
  "Europe/Moscow": ["moskova", "rusya"],
  // "Kalküta" is the Turkish spelling of the zone's own city, with its ASCII twin
  // beside it; "Hindistan" is the country. "Delhi" and "Mumbai" the table already
  // has, spelled the same way.
  "Asia/Kolkata": ["kalküta", "kalkuta", "hindistan"],
  // "Çin" is Turkish for China. Its ASCII spelling is deliberately absent: *cin*
  // is a jinn, and one of the commonest nouns in the language to collide with.
  "Asia/Shanghai": ["çin"],
  // "Japonya" is Turkish for Japan, through French *Japon*; the table's own
  // "japan" and "tokyo" stay beside it.
  "Asia/Tokyo": ["japonya"],
  // "Singapur" is the Turkish spelling; the table's "singapore" is the English
  // one.
  "Asia/Singapore": ["singapur"],
  // "Sidney" is how Turkish writes Sydney — phonemic spelling applied to a
  // toponym, the same rule that gives Londra and Moskova — and "Avustralya" is
  // the country.
  "Australia/Sydney": ["sidney", "avustralya"],
  // Asia/Dubai gets nothing: Turkish writes "Dubai" exactly as the table has it,
  // "Birleşik Arap Emirlikleri" is three tokens, and the bare "Emirlikler" is the
  // plural common noun "emirates", which names no country on its own.
  // Pacific/Auckland gets nothing either: "Yeni Zelanda" is two tokens and
  // "Auckland" is already in the table, spelled as Turkish spells it.
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk`, `de` and
    // `nl`: the zone table's own words first, the Turkish ones after, deduped. A
    // Turkish engine still reads "15:00 in tokyo" — recognition is many-to-one
    // (design decision I6) — and dropping the Latin aliases here would make a
    // bilingual user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(TURKISH[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Turkish symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Turkish writing uses anyway.
    symbol: def.symbol,
  };
}

/**
 * Turkish words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "5 kilometre" against "1 kilometre"
 * — and a zone is never counted: there is no such thing as two Japonyas. The
 * renderer only reaches a form through `selectForm`, and the one string this kind
 * ever prints comes from its own format hook, so a table here would be keys
 * nothing would ever index.
 *
 * Turkish has less to say about that than most siblings, and the reason is
 * structural rather than lexical. German had to record that its dative axis is
 * inert on a proper noun; Dutch had to record that it has no second axis to be
 * inert. `turkish.selectForm` returns the constant `"other"` for every count and
 * every slot, so there was never a key that could have said otherwise about
 * anything.
 *
 * **A second axis was nevertheless available in this language, and
 * `@smartput/core/locale/tr` rejected it for a reason this package is the sharpest
 * illustration of.** Turkish marks location with the locative — "Tokyo'da saat
 * kaç" — and a conversion target with the dative, so a `forms` table keyed by slot
 * could in principle have printed the inflected zone name. It could not have
 * printed it *correctly*: a proper noun takes its suffix after an **apostrophe**
 * in Turkish orthography, "Japonya'da" and "Tokyo'ya", and an apostrophe is
 * punctuation no `forms` cell survives being read back through. That is the same
 * argument `tr.ts` makes about "kg'a", arriving here on a kind whose every unit
 * is a proper noun.
 *
 * Reading those surfaces is a separate question and is *not* given up:
 * `turkish`'s `APOSTROPHE_STRIPPER` carries the whole case list again behind each
 * of the three apostrophes `lex` accepts, so "15:00 çevir Tokyo'ya" resolves to
 * the same zone the bare word does. This kind is where that matters most in the
 * repo — a Turkish sentence naming a place almost always inflects it, and a
 * vocabulary of proper nouns is exactly the class the apostrophe rule applies to
 * — so the asymmetry to keep in mind is that the inflected name is readable and
 * unprintable, not that it is unknown.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`, `uk`, `de` and `nl`:
 * this file links neither chrono nor the zone matcher, so
 * `@smartput/datetime/locale/tr` is a translation someone can ship without owning
 * the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "tr", kind: DATETIME_KIND, units });
