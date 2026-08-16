import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Polish words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * **This layer sits between `de`'s shape and `uk`'s, and the reason is that
 * Polish is a Latin-script language that declines.** German could leave
 * *Chicago*, *Denver*, *London* and *Sydney* to the zone table because German
 * spells them the same way and does nothing to them afterwards; Ukrainian had to
 * give every zone a word because not one alias in that table is typeable on its
 * layout. Polish shares the alphabet, so a name it spells identically is already
 * half-covered — and then a Pole writes "15:00 w Londynie", and "londynie" is in
 * no index. So the rule this file follows is: a zone earns an entry where Polish
 * spells the name **differently** (Kijów, Moskwa, Paryż, Pekin, Kalkuta), where
 * the natural one-token word is the **country** (Francja, Niemcy, Chiny), or —
 * the Polish-specific reason German never has — where the name **declines**,
 * even if its nominative is the table's own word (Denver → *w Denverze*).
 *
 * Which cases, and why those:
 *
 *   nominative  a bare mention                    "Kijów"
 *   locative    what `w` and `na` govern          "15:00 w Kijowie"
 *   genitive    what `do` governs                 "15:00 do Kijowa"
 *
 * All three prepositions are `in` to core — `@smartput/core/locale/pl` lists
 * them under one keyword — so a zone reachable through only one of them stops
 * resolving when the user picks a different word, which is not a choice they are
 * making about zones. The accusative is deliberately absent even though `na`
 * governs one: with a place, `na` takes the accusative for *motion* ("na
 * Ukrainę") and the locative for *location* ("na Ukrainie"), and a time zone is
 * always a location. That the locative is the interesting case is the same
 * observation `polish.selectForm` makes when it maps `conversion-target` onto
 * it; the difference here is that a zone has no `forms` table to select from
 * (see below), so every case has to be readable as a plain alias or the sentence
 * a Polish speaker actually writes does not parse.
 *
 * The language's suffix stripper recovers some of this and is not relied on for
 * any of it. It is penalised (`weight: -2`), and several of these forms are
 * beyond it outright: the consonant alternations Polish runs before the locative
 * -e turn *Kalkuta* into "Kalkucie" (t→c), *Denver* into "Denverze" (r→rz) and
 * *Auckland* into "Aucklandzie" (d→dz), and stripping "ie" from any of them
 * leaves a stem that matches nothing at all.
 *
 * Indeclinable names appear once and that is not an omission: Tokio, Chicago,
 * Delhi, Hollywood and Greenwich are the same word in every case Polish has —
 * borrowed nouns ending in -o and -i do not decline. Chicago and Delhi are
 * therefore left entirely to the zone table, which already spells them the way
 * Polish does; they are the only two named zones with no Polish line here, and
 * `pl.test.ts` checks that they are still reachable rather than treating the gap
 * as coverage.
 *
 * What is *not* here is a multi-word name. Nowy Jork, Los Angeles, São Paulo and
 * Nowa Zelandia are each two tokens to `lex` — and a word token ends at a space
 * — so no lookup could ever reach them, the same reason `ZONES` documents for
 * keeping "new york" out and "nyc" in. Those zones are reached instead through a
 * district, a state or the head noun of the country's name (Manhattan, Brooklyn,
 * Kalifornia, Brazylia, Zelandia), which is exactly the trade `en` and `de` both
 * make.
 */
const POLISH: Record<string, readonly string[]> = {
  // "Greenwich" is what Polish says for the zero meridian ("czas Greenwich") and
  // it does not decline; "uniwersalny" is the first word of "uniwersalny czas
  // koordynowany", the official rendering of UTC, and it is the word carrying
  // the meaning — "koordynowany" alone could be anything.
  UTC: ["greenwich", "uniwersalny"],
  // "Nowy Jork" is two tokens, so a district is the only one-word way in. Both
  // decline like ordinary masculine nouns: -u in the genitive, -ie in the
  // locative.
  "America/New_York": [
    "manhattan",
    "manhattanu",
    "manhattanie",
    "brooklyn",
    "brooklynu",
    "brooklynie",
  ],
  // Chicago is in the zone table already and is indeclinable in Polish, so it
  // gets no line — see the note above about the two zones that do not.
  //
  // Denver is in the table too, and needs one anyway: Polish declines it, and
  // the locative runs r→rz. Nothing strips its way from "Denverze" back.
  "America/Denver": ["denveru", "denverze"],
  // Hollywood does not decline; Kalifornia does, and its genitive and locative
  // are the same word, as every -ia feminine's are.
  "America/Los_Angeles": ["hollywood", "kalifornia", "kalifornii"],
  "America/Sao_Paulo": ["brazylia", "brazylii"],
  // "Wielka Brytania" is two tokens, so only the head noun can be an alias —
  // and "Brytania" alone is unambiguous here.
  "Europe/London": [
    "londyn",
    "londynu",
    "londynie",
    "anglia",
    "anglii",
    "brytania",
    "brytanii",
  ],
  "Europe/Paris": ["paryż", "paryża", "paryżu", "francja", "francji"],
  // "Niemcy" is grammatically a *plural*, so its cases are plural ones: "do
  // Niemiec" is the genitive plural and "w Niemczech" the locative plural, with
  // the c→cz the locative plural forces. Neither is reachable from "Niemcy" by
  // any suffix rule.
  "Europe/Berlin": ["berlina", "berlinie", "niemcy", "niemiec", "niemczech"],
  // "Kijów" has the ó/o alternation Polish runs on a closed syllable, so the
  // oblique stem is "Kijow-" and the nominative is the odd one out — exactly the
  // shape that defeats a stripper, since "Kijowie" reduces to "Kijow" and the
  // index holds "kijów".
  "Europe/Kyiv": ["kijów", "kijowa", "kijowie", "ukraina", "ukrainy", "ukrainie"],
  "Europe/Moscow": ["moskwa", "moskwy", "moskwie", "rosja", "rosji"],
  // "Zjednoczone Emiraty Arabskie" is three tokens; "Emiraty" alone is what a
  // Pole writes, and it is a plural like "Niemcy".
  "Asia/Dubai": ["dubaj", "dubaju", "emiraty", "emiratów", "emiratach"],
  // "Kalkuta" is the Polish spelling, and its locative runs t→c. "Delhi" the
  // table already has and Polish does not decline it; "Mumbaj" it spells its own
  // way. "Indie" is another plural.
  "Asia/Kolkata": [
    "kalkuta",
    "kalkuty",
    "kalkucie",
    "mumbaj",
    "mumbaju",
    "indie",
    "indii",
    "indiach",
  ],
  // "Pekin" is the current Polish name of the city the table lists as
  // "beijing"; "Szanghaj" is the Polish spelling of the zone's own city.
  "Asia/Shanghai": [
    "szanghaj",
    "szanghaju",
    "pekin",
    "pekinu",
    "pekinie",
    "chiny",
    "chin",
    "chinach",
  ],
  // Tokio is indeclinable — a borrowed -o noun — so it appears once. Japonia
  // declines like every other -ia feminine, with one word for both oblique
  // cases.
  "Asia/Tokyo": ["tokio", "japonia", "japonii"],
  // Singapur declines, and its locative runs r→rz the way Denver's does.
  "Asia/Singapore": ["singapur", "singapuru", "singapurze"],
  // Sydney is in the table and does not decline in Polish; the country does.
  "Australia/Sydney": ["australia", "australii"],
  // Auckland is in the table and needs its oblique forms all the same: the
  // locative runs d→dz. "Nowa Zelandia" is two tokens, so only the head noun can
  // be an alias, and nothing else here is named after the Dutch province.
  "Pacific/Auckland": ["aucklandu", "aucklandzie", "zelandia", "zelandii"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `de` and `uk`: the
    // zone table's own words first, the Polish ones after, deduped. A Polish
    // engine still reads "15:00 w tokyo" — recognition is many-to-one (design
    // decision I6) — and dropping the Latin aliases here would make a bilingual
    // user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(POLISH[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Polish symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Polish writing uses anyway (UTC, CET and CEST are not
    // translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Polish words for the datetime kind's units, which are IANA zone ids.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "5 kilogramów" against "2
 * kilogramy" — and a zone is never counted: there is no such thing as two Tokio.
 * The case axis has nothing to add either, because it is exactly what the
 * aliases above already carry: "w Kijowie" is a spelling a reader *types*, and a
 * form the parser must recognise is an alias, not a printed form. The renderer
 * only reaches a form through `selectForm`, and the one string this kind ever
 * prints comes from its own format hook, so eight keys per zone across a hundred
 * and twenty-two units would be eight keys nothing would ever index.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/pl` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in any language, for
 * a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "pl", kind: DATETIME_KIND, units });
