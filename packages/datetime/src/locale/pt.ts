import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The Portuguese words for the named zones, beside the Latin ones
 * `@smartput/timezone` ships.
 *
 * Portuguese sits where Spanish sits and not where Ukrainian sits. Ukrainian had
 * to name every zone, because not one alias in the shipped table is typeable on a
 * Ukrainian layout; English had to name almost none, because that table is
 * already English. Portuguese shares the script and therefore the keyboard, so a
 * zone whose name it spells the same way — Chicago, Denver, Paris, Dubai — is
 * already reachable, and a byte-identical alias would only put a duplicate in the
 * index. What Portuguese does change is:
 *
 *   the **exonym**, where Portuguese has a name of its own: Londres for London,
 *   Berlim for Berlin, Moscou for Moscow, Tóquio for Tokyo, Xangai for Shanghai,
 *   Pequim for Beijing, Calcutá for Kolkata, Singapura for Singapore. None of
 *   these is recoverable from the English form by any analyzer — "xangai" and
 *   "shanghai" share three letters — so each is a word a Portuguese speaker
 *   cannot reach without this file.
 *
 *   the **written accent**, where the name is otherwise the same: Tóquio,
 *   Calcutá, França, Rússia, Índia, Ucrânia, Austrália, Japão, Zelândia. NFKC
 *   folding leaves a precomposed á as á rather than stripping it, so "japao" and
 *   "japão" are two different strings to the alias index and both have to be
 *   declared — a keyboard without accents is the commoner keyboard, and the tilde
 *   in particular is the one Portuguese diacritic no neighbouring layout has.
 *
 *   the **country**, which is how a person most often names a zone they do not
 *   live in — "15:00 no Japão", not "15:00 em Tóquio". One is added for every zone
 *   whose country name is a single token.
 *
 * Hyphens and spaces are what is *not* here, for the reason `ZONES` documents for
 * keeping "new york" out: core's alias index is keyed by one segmented word, so
 * "Nova York", "Los Angeles", "São Paulo", "Nova Zelândia" and "Reino Unido" can
 * never be looked up. Each is reached instead by the one word of its name that
 * carries the meaning ("angeles", "zelândia") or by a district, a capital or a
 * country that is a single word (Manhattan, Brooklyn, Brasília, Brasil) — the same
 * trade `en` makes with "manhattan" and `uk` makes with "зеландія".
 *
 * One zone gets more attention than the rest, and it is the Brazilian one. Under
 * the bare `pt` tag this is the home zone: `America/Sao_Paulo` ships with exactly
 * one alias, the abbreviation "brt", which is not a word anyone types. "Brasil"
 * and "Brasília" are what a Brazilian writes for their own clock — the capital
 * gives the zone its usual name, *horário de Brasília* — and "sampa" is the city's
 * own nickname for itself, the one single-token way to say "São Paulo".
 */
const PORTUGUESE: Record<string, readonly string[]> = {
  // "universal" is the first word of "tempo universal coordenado", the official
  // Portuguese rendering of UTC, and the word carrying the meaning — "coordenado"
  // alone could be anything. "greenwich" is what a Portuguese clock face and a
  // Portuguese weather report say ("hora de Greenwich"); Portuguese quotes the
  // English spelling rather than adapting it.
  UTC: ["universal", "greenwich"],
  "America/New_York": ["manhattan", "brooklyn"],
  "America/Los_Angeles": ["hollywood", "angeles"],
  // The home zone: see the note above.
  "America/Sao_Paulo": ["brasil", "brasília", "brasilia", "sampa"],
  "Europe/London": ["londres", "inglaterra"],
  // "paris" is already in the table and Portuguese spells it identically — the
  // accent French writes is not written in Portuguese. Only the country is new.
  "Europe/Paris": ["frança", "franca"],
  "Europe/Berlin": ["berlim", "alemanha"],
  // "kiev" is already in the table and is the older Portuguese spelling too;
  // "kyiv", which the Brazilian press now prefers, is also already there. Only the
  // country is missing.
  "Europe/Kyiv": ["ucrânia", "ucrania"],
  // "Moscou" is Brazilian, "Moscovo" is European. Both are listed: the tag is
  // Brazilian for what gets *written*, and nothing here is ever written.
  "Europe/Moscow": ["moscou", "moscovo", "rússia", "russia"],
  "Asia/Dubai": ["emirados"],
  // Delhi and Mumbai are spelled as the table spells them; Calcutta is not.
  "Asia/Kolkata": ["calcutá", "calcuta", "índia", "india"],
  // Two exonyms on one zone, because the table carries two cities on it: Xangai
  // for Shanghai and Pequim for Beijing, neither reachable from the English form.
  "Asia/Shanghai": ["xangai", "pequim", "china"],
  "Asia/Tokyo": ["tóquio", "toquio", "japão", "japao"],
  "Asia/Singapore": ["singapura"],
  // "Sydney" is how Portuguese usually writes it, and it is already in the table;
  // "Sidney" is the variant spelling Portuguese dictionaries also record.
  "Australia/Sydney": ["sidney", "austrália", "australia"],
  // "nz" is not a Portuguese word and is here anyway, for the reason
  // `@smartput/speed/locale/pt` lists "kn": this unit's printed symbol is "NZ",
  // and a symbol the printer can emit must be one the parser reads back by
  // declaration rather than by luck. The shipped table does not carry it — `en`
  // adds it from its own list, which is why English can read its own "NZ" and
  // this file could not until it said so. Portuguese writes the ISO code for
  // *Nova Zelândia* exactly the same way, so nothing is being invented; the
  // two-word name itself is unreachable (core's alias index is keyed by one
  // segmented word), which is why "zelândia" carries the meaning beside it.
  "Pacific/Auckland": ["nz", "zelândia", "zelandia"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The generated half stays generated, exactly as in `en`, `uk` and `es`: the
    // zone table's own words first, the Portuguese ones after, deduped. A
    // Portuguese engine still reads "15:00 em tokyo" — recognition is many-to-one
    // (design decision I6), and dropping the Latin aliases here would make a
    // bilingual user's input stop parsing the moment the format locale changed.
    aliases: [...new Set([...def.aliases, ...(PORTUGUESE[zone] ?? [])])],
    // The zone table's symbol, untranslated and deliberately so. `datetime`'s
    // format hook prints `zoneSymbol(zone)` — the timezone package's table,
    // reached without a locale — so a Portuguese symbol here would never be the
    // string a formatted result ends with, and would only ever be handed to
    // `Printer`'s `symbols: true`. Two spellings for one zone, disagreeing with
    // each other, is worse than one Latin abbreviation; and the Latin
    // abbreviation is what Portuguese writing uses anyway (UTC, CET and BRT are
    // not translated, they are quoted).
    symbol: def.symbol,
  };
}

/**
 * Portuguese words for the datetime kind's units, which are IANA zone ids.
 *
 * Brazilian, under the bare `pt` tag, per this project's ruling. The tag shows up
 * in exactly two places here: `America/Sao_Paulo` is treated as the home zone and
 * given the words a Brazilian actually types for it, and where Brazil and
 * Portugal spell a foreign city differently ("Moscou"/"Moscovo") both spellings
 * are listed rather than one chosen — nothing in this file is ever printed, so
 * there is no Brazilian-first decision to take.
 *
 * The kind next door names no language at all: after ruling R1 its `units` is a
 * bare array of zone ids, and every word anyone types to reach one of them lives
 * here. That is the same split every ratio kind got — the difference is only that
 * a zone's "unit id" is already a proper noun, so the id and the word look alike.
 *
 * No `forms` on any unit, and that is a decision rather than a gap. A `forms`
 * table exists so a *count* can pick a word — "2 metros" against "1 metro" — and a
 * zone is never counted: there is no such thing as two Tóquios. The renderer only
 * reaches a form through `selectForm`, and the one string this kind ever prints
 * comes from its own format hook, so two keys per zone across a hundred and
 * twenty-two units would be two keys nothing would ever index. Portuguese is also
 * a language where a gender axis would be tempting — "o Japão", "a Índia", and the
 * contraction that follows from it ("no Japão", "na Índia") — and it stays out for
 * the same reason `pt.ts` folds CLDR's `many` into `other`: a `forms` key is
 * something `selectForm` selects on, nothing here would ever be selected, and the
 * gender Portuguese does inflect for lives in `pt.ts`'s `renderQuantity`, where it
 * agrees a *numeral* with a noun. A zone has no numeral in front of it.
 *
 * Named by **id string** through `DATETIME_KIND`, like `en`: this file links
 * neither chrono nor the zone matcher, so `@smartput/datetime/locale/pt` is a
 * translation someone can ship without owning the kind.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases in every language,
 * for a reason that has nothing to do with translation: "gmt+3" lexes as three
 * tokens, so no alias lookup could ever reach it, and `parseOffsetZone` is its
 * only door.
 */
export default defineVocabulary({ locale: "pt", kind: DATETIME_KIND, units });
