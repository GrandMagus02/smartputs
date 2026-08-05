import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// The five imports below are reached by relative path rather than by package
// name on purpose. This script is not a workspace member, so it has no
// node_modules of its own and no package.json to declare them in; a relative
// path is the only route, and it keeps `check-deps.ts` honest — none of this
// reaches the published packages, which still ship the two dependencies spec
// §11 allows them. `chrono-node` has to be reached through the one package that
// does declare it, which is why that path goes through datetime's node_modules.
import en from "../../packages/core/src/locale/en";
import type { Kind, Lexicon, Locale } from "../../packages/core/src/types";
import * as chrono from "../../packages/datetime/node_modules/chrono-node";
import { MIN_NAME_LENGTH } from "../../packages/geo/src/matcher";
import { BUILTIN_KINDS } from "../../packages/kinds/src/index";
import { NUMBER_WORDS } from "../../packages/number/src/words";

/**
 * Builds `packages/geo/src/data/{countries,cities,admin1,reserved}.ts` from the
 * GeoNames dump and from the engine's own vocabulary.
 *
 * Run deliberately — `bun run scripts/geo/build.ts` — and commit the diff. The
 * data is vendored rather than fetched at build time so the package takes on no
 * runtime dependency and no third party can break a build (spec §7.2), and each
 * generated file carries the SHA-256 of its own body so a hand edit is caught
 * by a test rather than shipped.
 *
 * Everything above `main()` is pure and column-level, which is what lets
 * `build.test.ts` pin the layout against checked-in samples without a network.
 */

// ---------------------------------------------------------------------------
// countryInfo.txt
// ---------------------------------------------------------------------------

export interface CountryInfo {
  readonly a2: string;
  readonly a3: string;
  readonly name: string;
  readonly capital: string;
  readonly area: number;
  readonly population: number;
  readonly currency: string;
  readonly phone: string;
  readonly postalRegex: string;
  readonly geonameId: number;
}

/** Tab-separated with a `#` preamble whose last line is the column header. */
export function parseCountryInfo(text: string): CountryInfo[] {
  const out: CountryInfo[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0 || line.startsWith("#")) continue;
    const c = line.split("\t");
    const a2 = c[0] ?? "";
    // A row without a code or an id cannot be keyed or made into a Value, and
    // GeoNames has never emitted one — so this is a corruption guard, not a
    // filter. Everything else is allowed to be blank; see Antarctica.
    if (a2 === "" || (c[16] ?? "") === "") continue;
    out.push({
      a2: a2.toLowerCase(),
      a3: (c[1] ?? "").toLowerCase(),
      // Trimmed: "Bonaire, Saint Eustatius and Saba " ships with a trailing
      // space upstream, and it would reach the alias index and the formatter.
      name: (c[4] ?? "").trim(),
      capital: (c[5] ?? "").trim(),
      area: Number(c[6] ?? "") || 0,
      population: Number(c[7] ?? "") || 0,
      currency: (c[10] ?? "").toUpperCase(),
      phone: c[12] ?? "",
      postalRegex: c[14] ?? "",
      geonameId: Number(c[16]),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// cities15000.txt
// ---------------------------------------------------------------------------

export interface City {
  readonly geonameId: number;
  readonly name: string;
  readonly asciiName: string;
  readonly alternateNames: readonly string[];
  readonly lat: number;
  readonly lon: number;
  readonly featureCode: string;
  readonly country: string;
  /** GeoNames' admin1 code — "TX", "40" — as written, not yet joined. */
  readonly admin1: string;
  readonly population: number;
  readonly zone: string;
}

export function parseCities(text: string): City[] {
  const out: City[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const c = line.split("\t");
    const id = Number(c[0] ?? "");
    if (!Number.isFinite(id) || id === 0) continue;
    out.push({
      geonameId: id,
      name: c[1] ?? "",
      asciiName: c[2] ?? "",
      alternateNames: (c[3] ?? "").split(",").filter((s) => s.length > 0),
      lat: Number(c[4] ?? "") || 0,
      lon: Number(c[5] ?? "") || 0,
      featureCode: c[7] ?? "",
      country: c[8] ?? "",
      admin1: c[10] ?? "",
      population: Number(c[14] ?? "") || 0,
      zone: c[17] ?? "",
    });
  }
  return out;
}

/**
 * The T1 population floor (spec §7.1), and the exception to it.
 *
 * Every national capital is kept whatever its size. A small capital is exactly
 * the one a user asks about — Ngerulmud has 0 residents on this table and is
 * still what "palau" resolves through — and M6.1 already reaches every capital
 * through `COUNTRIES`, so dropping them here would make the city table rank
 * worse than the country table it is meant to refine.
 */
export const CITY_MIN_POPULATION = 100_000;

export function isTier1(city: City): boolean {
  return city.population >= CITY_MIN_POPULATION || city.featureCode === "PPLC";
}

// ---------------------------------------------------------------------------
// admin1CodesASCII.txt
// ---------------------------------------------------------------------------

export interface Admin1Info {
  /** "US.TX": the country's alpha-2 uppercased, a dot, then the admin1 code. */
  readonly key: string;
  readonly name: string;
  readonly asciiName: string;
  readonly geonameId: number;
}

/** Four tab-separated columns and no preamble: key, name, ascii name, id. */
export function parseAdmin1(text: string): Admin1Info[] {
  const out: Admin1Info[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const c = line.split("\t");
    const key = c[0] ?? "";
    // A key without a dot is not a division — it is a corrupt line, or the day
    // GeoNames changes this file's shape, and either way it must not become an
    // Admin1Row whose `key` can never be joined to.
    if (!/^[A-Z]{2}\.[^\t]+$/.test(key)) continue;
    out.push({
      key,
      name: (c[1] ?? "").trim(),
      asciiName: (c[2] ?? "").trim(),
      geonameId: Number(c[3] ?? "") || 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The capital's zone and coordinates
// ---------------------------------------------------------------------------

export interface Capital {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly zone: string;
  /** Null when the capital was matched by name; otherwise why it was not. */
  readonly fallback: string | null;
}

/** Diacritics are folded because countryInfo and cities15000 disagree on them. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * PPLC before population, because a seat of government is the capital whether
 * or not it is the largest city — Washington is a tenth of New York.
 */
const better = (a: City, b: City) => {
  const rank = (c: City) => (c.featureCode === "PPLC" ? 1 : 0);
  return rank(b) - rank(a) || b.population - a.population;
};

/**
 * countryInfo carries the capital's *name* and nothing else, so its zone and
 * coordinates have to be recovered from cities15000. Matching on the name is
 * the only join available: there is no capital geonameid column.
 *
 * Two ways that misses — a stale name (Palau still says Melekeok) and a country
 * with no city over 15000 at all — so the fallback is reported rather than
 * silently taken, and `main()` prints every one.
 */
export function resolveCapital(
  country: CountryInfo,
  cities: readonly City[],
): Capital | null {
  const mine = cities.filter((c) => c.country.toLowerCase() === country.a2);
  if (mine.length === 0) return null;

  const want = fold(country.capital);
  const named =
    want === ""
      ? []
      : mine.filter(
          (c) =>
            fold(c.name) === want ||
            fold(c.asciiName) === want ||
            c.alternateNames.some((a) => fold(a) === want),
        );

  const pool = named.length > 0 ? named : mine;
  const pick = pool.slice().sort(better)[0];
  if (pick === undefined) return null;

  const fallback =
    named.length > 0
      ? null
      : country.capital === ""
        ? "no capital declared"
        : `no city matched "${country.capital}"`;

  return { name: pick.name, lat: pick.lat, lon: pick.lon, zone: pick.zone, fallback };
}

// ---------------------------------------------------------------------------
// timeZones.txt
// ---------------------------------------------------------------------------

/**
 * Last resort for a country with no city row. The file is sorted by zone id and
 * a country can list ten of them, so the first is taken: there is no defensible
 * "main" zone for Antarctica, and a deterministic pick beats a clever one that
 * moves between releases.
 */
export function parseTimeZones(text: string): Map<string, string> {
  const zones = new Map<string, string>();
  for (const line of text.split("\n")) {
    if (line.length === 0 || line.startsWith("CountryCode")) continue;
    const c = line.split("\t");
    const cc = c[0] ?? "";
    const zone = c[1] ?? "";
    if (cc === "" || zone === "" || zones.has(cc)) continue;
    zones.set(cc, zone);
  }
  return zones;
}

// ---------------------------------------------------------------------------
// alternateNamesV2.txt
// ---------------------------------------------------------------------------

/**
 * A whitelist, not a blacklist. `isolanguage` is a language code for a real
 * name and a tag for everything else — `link` holds URLs, `wkdt` Wikidata ids,
 * `post` postal codes, the aviation tags three-letter airport codes — but
 * excluding only those leaves ~180 names per country, most of them exonyms in
 * languages this engine does not speak. Andorra alone brings "andorra nutome"
 * and "i-andorra", which quadruple the table and are match surface for input
 * nobody will type.
 *
 * `en` and `abbr` are the English name and its abbreviations. The blank
 * language is where GeoNames files the Latin transliterations that are actually
 * typed — Nippon, Holland, Burma. Everything else belongs to a locale package,
 * the same boundary datetime draws at `locale/en`.
 */
const NAME_LANGUAGES = new Set(["", "en", "abbr"]);

/**
 * The same whitelist minus the blank language, for cities.
 *
 * For a country the blank tag is where the typed Latin forms live — Nippon,
 * Holland, Burma. For a city it is where the exonyms live: Geneva brings "Genf"
 * and "Ginevra", New York brings "Njujork" and "Neu Jorck", and none of those is
 * English or a transliteration anyone types into an English launcher. Five
 * thousand cities' worth of them is both a table nobody can review and match
 * surface for input that will not arrive, so the tag that pays for a country is
 * refused for a city.
 */
const CITY_NAME_LANGUAGES = new Set(["en", "abbr"]);

export function parseAlternateNames(
  text: string,
  wanted: ReadonlySet<number>,
  languages: ReadonlySet<string> = NAME_LANGUAGES,
): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const c = line.split("\t");
    const id = Number(c[1] ?? "");
    if (!wanted.has(id)) continue;
    if (!languages.has(c[2] ?? "")) continue;
    const name = c[3] ?? "";
    // Non-ASCII is dropped here rather than left to `buildAliases` only because
    // this runs while streaming 777 MB: most of a country's ~180 alternate names
    // are in scripts a launcher's input never carries, and holding them to
    // filter later is the difference between a small map and a large one.
    if (name === "" || !/^[\x20-\x7e]+$/.test(name)) continue;
    const list = out.get(id);
    if (list) list.push(name);
    else out.set(id, [name]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reserved words
// ---------------------------------------------------------------------------

/**
 * The words a place claim must never consume.
 *
 * The literal fold is destructive: once the matcher eats a word, no weight and
 * no solver ranking can give it back, so `3 days ago` with a city called Ago in
 * the table is not a worse reading — it is no reading at all. Five thousand city
 * names contain a great many ordinary English words, and the ones that hurt are
 * exactly the ones some other part of the engine already owns.
 *
 * So the set is *derived* from those owners rather than hand-listed. A list
 * somebody thought of fails on the word they did not think of, and it fails
 * destructively; a derivation fails only when a package changes its vocabulary
 * without regenerating, which the body hash catches. Each source below is the
 * authority for its own words, and `reserved.ts`'s header records what each one
 * contributed so the derivation stays reviewable.
 *
 * Applied here, in the generator, and not in the matcher: the shipped table
 * simply does not contain these aliases. A rule enforced at match time is one
 * `if` away from being skipped, and there is no second chance to catch it.
 */
export interface ReservedSource {
  /** Named in the generated header, so a reader can go and check it. */
  readonly id: string;
  readonly words: readonly string[];
}

/** Only whole lowercase words. A symbol like "°C" is not a word a city can be. */
const RESERVABLE = /^[a-z][a-z']*$/;

/** The locale's keyword surface forms: in, to, as, of, plus, minus, times, by. */
export function keywordWords(locale: Locale): string[] {
  return Object.values(locale.keywords).flatMap((forms) => forms ?? []);
}

/**
 * Month and weekday names, long and short, from the host's own English data.
 *
 * Read out of Intl rather than written down because the engine's dates are
 * formatted by Intl: whatever it calls the month is what a user sees and types
 * back. The dates below are fixed so a regeneration is not a diff.
 */
export function calendarWords(): string[] {
  const out: string[] = [];
  for (const month of ["long", "short"] as const) {
    const fmt = new Intl.DateTimeFormat("en", { month, timeZone: "UTC" });
    for (let m = 0; m < 12; m += 1) out.push(fmt.format(Date.UTC(2001, m, 15)));
  }
  for (const weekday of ["long", "short"] as const) {
    const fmt = new Intl.DateTimeFormat("en", { weekday, timeZone: "UTC" });
    // 2001-01-01 was a Monday, so seven consecutive days is every weekday once.
    for (let d = 1; d <= 7; d += 1) out.push(fmt.format(Date.UTC(2001, 0, d)));
  }
  return out;
}

/**
 * chrono's own relative vocabulary — today, tomorrow, ago, next, last, this,
 * past — read off the patterns its parsers compile.
 *
 * Taken from the library rather than transcribed from `packages/datetime`,
 * because datetime does not enumerate these words anywhere: it hands the string
 * to `chrono.parse` and accepts what comes back (`chrono-bridge.ts`). Only what
 * chrono itself recognises can tell us which words a date reading depends on,
 * and transcribing a third party's vocabulary by hand is how it goes stale.
 *
 * `pattern()` wants a parsing context; a fixed reference date keeps a parser
 * that interpolates one from making the output depend on the day of the run.
 */
export function chronoWords(): string[] {
  const context = {
    refDate: new Date(Date.UTC(2001, 0, 1)),
    option: { forwardDate: false },
  };
  const out: string[] = [];
  for (const parser of chrono.en.casual.parsers) {
    const source = parser.pattern(context as never).source;
    for (const word of source.match(/[a-zA-Z]{2,}/g) ?? []) out.push(word);
  }
  return out;
}

/**
 * Every alias, unit id, symbol and display form the built-in kinds register.
 *
 * `MatchCtx.isUnitAlias` answers this at match time, but the generated set has
 * to stand on its own: `reserved.test.ts` asserts "km" and "mile" are in it
 * without building an engine, and the table has to be right before any engine
 * exists to ask. Display forms are included because they are what a formatter
 * prints — "kilometres" comes back as input often enough to matter.
 */
export function unitWords(kinds: readonly Kind[]): string[] {
  const out: string[] = [];
  const take = (lexicon: Lexicon | undefined) => {
    for (const [unit, entry] of Object.entries(lexicon ?? {})) {
      out.push(unit);
      if (Array.isArray(entry)) {
        out.push(...entry);
        continue;
      }
      out.push(...entry.aliases);
      if (entry.symbol !== undefined) out.push(entry.symbol);
      out.push(...Object.values(entry.display ?? {}));
    }
  };
  for (const kind of kinds) {
    take(kind.lexicon);
    if (kind.value.mode === "ratio") out.push(...Object.keys(kind.value.units));
  }
  return out;
}

/**
 * Geo's own short country aliases — "no" is Norway, "is" Iceland, "it" Italy,
 * "and" Andorra, "ago" Angola.
 *
 * M6.1 found these the hard way and answered them in the matcher, which refuses
 * to claim a lowercase two- or three-letter code at all. That ruling is a fact
 * about the *data*, so it belongs in the data: a division coded IN or a city
 * spelled with three letters would otherwise reintroduce exactly the collision
 * the matcher rule exists to prevent, through a table the rule does not cover.
 *
 * Nothing is lost by including them. A city alias is already held to
 * `MIN_NAME_LENGTH`, and the country table is not filtered by this set — the
 * matcher's own `claimable` still decides there, so "japan to UA" keeps working.
 */
export function shortPlaceCodes(
  rows: readonly { aliases: readonly string[] }[],
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    for (const alias of row.aliases) {
      if (alias.length < MIN_NAME_LENGTH) out.push(alias);
    }
  }
  return out;
}

/**
 * The hand-written remainder — words no source above produces and every one of
 * them a word that would destroy an expression.
 *
 * Kept to what can be justified word by word, because a hand list is the thing
 * the derivation exists to replace. Anything that a source *does* produce is
 * dropped from this block by `buildReserved` and reported, so it cannot quietly
 * grow into a second, unreviewed vocabulary.
 */
export interface SupplementWord {
  readonly word: string;
  /** Emitted verbatim above the word, so the generated file carries the why. */
  readonly why: readonly string[];
}

export const RESERVED_SUPPLEMENT: readonly SupplementWord[] = [
  {
    word: "or",
    why: [
      'Oregon\'s admin1 code is OR, so without this "portland or london" claims',
      '"portland or" as a scoped city and the expression loses its second place.',
      "No kind, keyword or numeral owns the word, so no source can derive it.",
    ],
  },
];

export interface Reserved {
  /** Sorted, deduplicated, the supplement excluded — the derivation's output. */
  readonly derived: readonly string[];
  /** Supplement words no source produced, in the order they are declared. */
  readonly supplement: readonly SupplementWord[];
  /** Per source, how many of its words are in the set. For the header. */
  readonly contributions: ReadonlyArray<readonly [id: string, count: number]>;
  /** Supplement entries a source already produced, so the block can be pruned. */
  readonly redundant: readonly string[];
}

export function buildReserved(
  sources: readonly ReservedSource[],
  supplement: readonly SupplementWord[] = RESERVED_SUPPLEMENT,
): Reserved {
  const derived = new Set<string>();
  const contributions: Array<readonly [string, number]> = [];

  for (const source of sources) {
    let count = 0;
    for (const raw of source.words) {
      const word = raw.toLowerCase().trim();
      if (!RESERVABLE.test(word)) continue;
      derived.add(word);
      count += 1;
    }
    contributions.push([source.id, count]);
  }

  const redundant: string[] = [];
  const extra: SupplementWord[] = [];
  for (const entry of supplement) {
    if (derived.has(entry.word)) redundant.push(entry.word);
    else extra.push(entry);
  }

  return {
    derived: [...derived].sort(),
    supplement: extra,
    contributions,
    redundant: redundant.sort(),
  };
}

/** Both halves as one lookup, which is what the alias filters consult. */
export function reservedSet(reserved: Reserved): Set<string> {
  return new Set([...reserved.derived, ...reserved.supplement.map((e) => e.word)]);
}

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

/**
 * Letters first, then letters, digits, spaces, apostrophes and hyphens. Leading
 * with a letter is what rejects a pure-digit alias without a second rule, and
 * excluding the dot is what rejects "U.S." — a launcher tokenizes on it, so the
 * alias could never be matched whole.
 */
const SHAPE = /^[a-z][a-z0-9' -]*$/;

/**
 * The trie the matcher walks is bounded at four words (spec §5.1), so a longer
 * alias is dead weight in a file whose size budget is the reason cities are a
 * separate entry point.
 */
const MAX_WORDS = 4;

/**
 * The country name, both ISO codes and every GeoNames variant that survives
 * `SHAPE`, deduplicated.
 *
 * One- and two-letter aliases are refused unless the alias *is* the alpha-2:
 * two letters is the whole ISO 3166-1 code space plus most of the unit
 * vocabulary, and an alias like "UK" — which is not a code — would be a place
 * claiming a token that some other kind may own. The cost is real: `uk` does
 * not resolve. That is a matcher-level curated alias if it is ever wanted, not
 * a hole punched in the data rule.
 *
 * The variants are sorted rather than left in file order so a GeoNames release
 * that reorders its rows is not a diff.
 */
export function buildAliases(
  name: string,
  a2: string,
  a3: string,
  variants: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string) => {
    const alias = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!SHAPE.test(alias)) return;
    if (alias.length < 3 && alias !== a2) return;
    if (alias.split(" ").length > MAX_WORDS) return;
    if (seen.has(alias)) return;
    seen.add(alias);
    out.push(alias);
  };

  add(name);
  add(a3);
  add(a2);
  for (const v of [...variants].sort()) add(v);
  return out;
}

export interface CityAliases {
  readonly aliases: string[];
  /** Single-word aliases refused because a reserved word owns them. */
  readonly reserved: string[];
}

/**
 * The display name, the ASCII name, and the English alternate names, filtered.
 *
 * Held to `MIN_NAME_LENGTH` characters rather than to the country table's three,
 * because a city has no ISO code to exempt: every alias here is a name, and a
 * name below four characters is a token some other kind may own. The cost is
 * real and visible — Ufa is a city of a million people and "ufa" is three
 * letters, so it is unreachable until a curated alias exists to say otherwise.
 *
 * The reserved filter applies to *single-word* aliases only. Two words in a row
 * are nobody's unit and nobody's keyword, which is the same line the matcher
 * draws when it only tests `claimable` on a one-word claim — so "may pen" keeps
 * its name where a city called "May" could not.
 */
export function buildCityAliases(
  name: string,
  asciiName: string,
  variants: readonly string[],
  reserved: ReadonlySet<string>,
): CityAliases {
  const seen = new Set<string>();
  const aliases: string[] = [];
  const refused: string[] = [];

  const add = (raw: string) => {
    const alias = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!SHAPE.test(alias)) return;
    if (alias.length < MIN_NAME_LENGTH) return;
    const words = alias.split(" ");
    if (words.length > MAX_WORDS) return;
    if (seen.has(alias)) return;
    seen.add(alias);
    if (words.length === 1 && reserved.has(alias)) {
      refused.push(alias);
      return;
    }
    aliases.push(alias);
  };

  add(asciiName);
  add(name);
  // Sorted rather than left in GeoNames' order, so a release that reorders its
  // rows is not a diff in a five-thousand-row file.
  for (const v of [...variants].sort()) add(v);
  return { aliases, reserved: refused };
}

/**
 * The division's name and its code: Texas is "texas" and "tx".
 *
 * The code is kept only when it is alphabetic — Japan's prefectures are numbered
 * and "40" is a number before it is Tokyo. And `MIN_NAME_LENGTH` does not apply,
 * because an admin1 alias is only ever read as the second word of a scoped
 * claim; a two-word claim is nobody's token, which is what makes "tx" safe here
 * and unsafe anywhere else.
 */
export function buildAdmin1Aliases(
  key: string,
  name: string,
  asciiName: string,
  reserved: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string) => {
    const alias = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!SHAPE.test(alias)) return;
    const words = alias.split(" ");
    if (words.length > MAX_WORDS) return;
    if (words.length === 1 && reserved.has(alias)) return;
    if (seen.has(alias)) return;
    seen.add(alias);
    out.push(alias);
  };

  add(asciiName);
  add(name);
  const code = key.slice(key.indexOf(".") + 1);
  if (/^[A-Za-z]+$/.test(code)) add(code);
  return out;
}

// ---------------------------------------------------------------------------
// Emitting
// ---------------------------------------------------------------------------

/**
 * Everything below this line is hashed. Splitting on a marker rather than
 * counting header lines means the header can grow a note without invalidating
 * every checkout's hash.
 */
export const BODY_MARKER =
  "// ---- generated body; the hash above covers everything below ----";

export function bodyOf(source: string, file = "the generated file"): string {
  const at = source.indexOf(BODY_MARKER);
  if (at < 0) throw new Error(`${file} has lost its body marker`);
  return source.slice(at + BODY_MARKER.length);
}

export function sha256(data: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(data).digest("hex");
}

export interface CountryRowOut {
  a2: string;
  a3: string;
  name: string;
  aliases: string[];
  capital: string;
  currency: string;
  phone: string;
  population: number;
  area: number;
  lat: number;
  lon: number;
  zone: string;
  geonameId: number;
  postalRegex: string;
}

const s = (v: string) => JSON.stringify(v);

/**
 * Emitted as one object literal per country rather than a packed string that a
 * loader unpacks. The file is meant to be reviewed in a git diff (spec §7.2),
 * and a diff of packed rows is unreadable — the gzip saving is not worth a
 * table nobody can check.
 */
function emitRow(r: CountryRowOut): string {
  return [
    "  {",
    `    a2: ${s(r.a2)},`,
    `    a3: ${s(r.a3)},`,
    `    name: ${s(r.name)},`,
    `    aliases: [${r.aliases.map(s).join(", ")}],`,
    `    capital: ${s(r.capital)},`,
    `    currency: ${s(r.currency)},`,
    `    phone: ${s(r.phone)},`,
    `    population: ${r.population},`,
    `    area: ${r.area},`,
    `    lat: ${r.lat},`,
    `    lon: ${r.lon},`,
    `    zone: ${s(r.zone)},`,
    `    geonameId: ${r.geonameId},`,
    `    postalRegex: ${s(r.postalRegex)},`,
    "  },",
  ].join("\n");
}

export interface Header {
  readonly inputs: ReadonlyArray<readonly [name: string, hash: string]>;
  /** Every fallback the run took, `a2` first so the count below is countable. */
  readonly fallbacks: readonly string[];
  readonly count: number;
}

const HASH_PLACEHOLDER = "0".repeat(64);

export function emitCountries(rows: readonly CountryRowOut[], header: Header): string {
  const affected = new Set(header.fallbacks.map((f) => f.slice(0, 2))).size;
  const fallbackNote =
    header.fallbacks.length === 0
      ? "// Every capital was matched by name."
      : [
          `// ${affected} of ${header.count} countries needed a fallback for the capital's`,
          "// zone or position. Listed in full so the list stays reviewable:",
          ...header.fallbacks.map((f) => `//   ${f}`),
        ].join("\n");

  return [
    "// Generated by scripts/geo/build.ts. Do not edit by hand — countries.test.ts",
    "// recomputes the body hash below and fails on a mismatch.",
    "//",
    "// Source: GeoNames (https://www.geonames.org/), CC BY 4.0.",
    "//",
    `// sha256 ${"body".padEnd(22)}${HASH_PLACEHOLDER}`,
    ...header.inputs.map(([name, hash]) => `// sha256 ${name.padEnd(22)}${hash}`),
    "//",
    // Deliberately no timestamp: a generated-on line would make every
    // regeneration a diff even when the upstream data has not moved.
    `// ${header.count} countries.`,
    "//",
    fallbackNote,
    "",
    'import type { CountryRow } from "../types";',
    "",
    BODY_MARKER,
    "",
    "export const COUNTRIES: readonly CountryRow[] = [",
    ...rows.map(emitRow),
    "];",
    "",
  ].join("\n");
}

export interface CityRowOut {
  geonameId: number;
  name: string;
  aliases: string[];
  country: string;
  admin1: string;
  lat: number;
  lon: number;
  zone: string;
  population: number;
  capital: boolean;
}

function emitCityRow(r: CityRowOut): string {
  return [
    "  {",
    `    geonameId: ${r.geonameId},`,
    `    name: ${s(r.name)},`,
    `    aliases: [${r.aliases.map(s).join(", ")}],`,
    `    country: ${s(r.country)},`,
    `    admin1: ${s(r.admin1)},`,
    `    lat: ${r.lat},`,
    `    lon: ${r.lon},`,
    `    zone: ${s(r.zone)},`,
    `    population: ${r.population},`,
    `    capital: ${r.capital},`,
    "  },",
  ].join("\n");
}

/** One refused alias, kept so the header can say what the filter cost. */
export interface ReservedDrop {
  readonly word: string;
  readonly city: string;
  readonly country: string;
  /** True when the city kept no alias at all and is not in the table. */
  readonly unreachable: boolean;
}

export interface CityHeader {
  readonly inputs: ReadonlyArray<readonly [name: string, hash: string]>;
  readonly count: number;
  readonly capitals: number;
  readonly drops: readonly ReservedDrop[];
  /** Cities no alias survived for, `"Ufa (ru)"`, so the loss is countable. */
  readonly unnamed: readonly string[];
}

const shared = (inputs: CityHeader["inputs"]) => [
  "// Source: GeoNames (https://www.geonames.org/), CC BY 4.0.",
  "//",
  `// sha256 ${"body".padEnd(22)}${HASH_PLACEHOLDER}`,
  ...inputs.map(([name, hash]) => `// sha256 ${name.padEnd(22)}${hash}`),
  "//",
];

export function emitCities(rows: readonly CityRowOut[], header: CityHeader): string {
  const lost = header.drops.filter((d) => d.unreachable);
  const cost = [
    header.drops.length === 0
      ? [
          "// No city alias was refused by data/reserved.ts. Not because the risk is",
          "// imaginary — it is why that file exists — but because MIN_NAME_LENGTH",
          "// already removes every name short enough to be a keyword, and no city of",
          "// 100 000 people is called March or Reading or Boring. The set still earns",
          "// its keep on ADMIN1, where it takes Indiana's `in` and Oregon's `or`, and",
          "// on whatever T2 tier reaches down to the towns that are.",
        ].join("\n")
      : [
          `// ${header.drops.length} single-word aliases were refused because data/reserved.ts`,
          "// owns the word. Listed in full: the fold is destructive, so what a place is",
          "// not allowed to claim is the most reviewable thing in this package.",
          ...header.drops.map((d) => `//   ${d.word} — ${d.city} (${d.country})`),
          "//",
          lost.length === 0
            ? "// Every one of them kept another alias and is still in the table."
            : [
                `// ${lost.length} of those kept no alias at all and are not in the table:`,
                ...lost.map((d) => `//   ${d.city} (${d.country})`),
              ].join("\n"),
        ].join("\n"),
    "//",
    // The bigger cost by far, and the one that would otherwise be invisible: a
    // name under MIN_NAME_LENGTH is refused whatever it says, so a million
    // people in Ufa are unreachable. Listed so the next milestone can decide
    // whether a curated short-name allowance is worth its ambiguity.
    `// ${header.unnamed.length} cities kept no alias at all and are not in the table:`,
    ...header.unnamed.map((u) => `//   ${u}`),
  ].join("\n");

  return [
    "// Generated by scripts/geo/build.ts. Do not edit by hand — cities.test.ts",
    "// recomputes the body hash below and fails on a mismatch.",
    "//",
    ...shared(header.inputs),
    `// ${header.count} cities — every one over ${CITY_MIN_POPULATION} people, plus the`,
    `// ${header.capitals} seats of government, whatever their size.`,
    "//",
    cost,
    "",
    'import type { CityRow } from "../types";',
    "",
    BODY_MARKER,
    "",
    "export const CITIES: readonly CityRow[] = [",
    ...rows.map(emitCityRow),
    "];",
    "",
  ].join("\n");
}

export interface Admin1RowOut {
  key: string;
  name: string;
  aliases: string[];
}

export function emitAdmin1(
  rows: readonly Admin1RowOut[],
  inputs: CityHeader["inputs"],
): string {
  return [
    "// Generated by scripts/geo/build.ts. Do not edit by hand — cities.test.ts",
    "// recomputes the body hash below and fails on a mismatch.",
    "//",
    ...shared(inputs),
    `// ${rows.length} first-level divisions — only the ones a city in CITIES names,`,
    "// because a division no city sits in can never scope one.",
    "",
    'import type { Admin1Row } from "../types";',
    "",
    BODY_MARKER,
    "",
    "export const ADMIN1: readonly Admin1Row[] = [",
    ...rows.map((r) =>
      [
        "  {",
        `    key: ${s(r.key)},`,
        `    name: ${s(r.name)},`,
        `    aliases: [${r.aliases.map(s).join(", ")}],`,
        "  },",
      ].join("\n"),
    ),
    "];",
    "",
  ].join("\n");
}

export function emitReserved(reserved: Reserved): string {
  const width = Math.max(...reserved.contributions.map(([id]) => id.length));
  return [
    "// Generated by scripts/geo/build.ts. Do not edit by hand — reserved.test.ts",
    "// recomputes the body hash below and fails on a mismatch.",
    "//",
    "// Every word here is derived from the vocabulary of the package that owns it,",
    "// not from a list somebody thought of: a hand list fails on the word it forgot,",
    "// and the literal fold is destructive, so that failure has no second chance.",
    "// Regenerate after any of these packages changes what it recognises.",
    "//",
    `// sha256 ${"body".padEnd(22)}${HASH_PLACEHOLDER}`,
    "//",
    `// ${reserved.derived.length} derived words. What each source contributed, before overlap:`,
    ...reserved.contributions.map(
      ([id, count]) => `//   ${id.padEnd(width)}  ${String(count).padStart(5)}`,
    ),
    "//",
    reserved.supplement.length === 0
      ? "// No hand-written supplement was needed."
      : `// Plus ${reserved.supplement.length} no source produces; each says below why it is here.`,
    "",
    BODY_MARKER,
    "",
    "/**",
    " * The words a place claim must never consume.",
    " *",
    " * Already applied to CITIES and ADMIN1 by the generator, so the shipped tables",
    " * contain none of them. Exported so the rule is testable without an engine, and",
    " * so a matcher building its own trie over other data can apply the same filter.",
    " *",
    " * COUNTRIES is deliberately not filtered by this set: the matcher's `claimable`",
    " * already refuses every lowercase short code, and filtering the country table",
    " * would take `japan to UA` with it.",
    " */",
    "export const RESERVED_WORDS: ReadonlySet<string> = new Set([",
    ...reserved.derived.map((w) => `  ${s(w)},`),
    ...(reserved.supplement.length === 0
      ? []
      : [
          "",
          "  // ---- hand-written: words no source above produces ----",
          ...reserved.supplement.flatMap((e) => [
            ...e.why.map((line) => `  // ${line}`),
            `  ${s(e.word)},`,
          ]),
        ]),
    "]);",
    "",
  ].join("\n");
}

/** Rewrites the placeholder once the formatter has settled the body. */
export function stampHash(source: string): string {
  return source.replace(HASH_PLACEHOLDER, sha256(bodyOf(source)));
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const DUMP = "https://download.geonames.org/export/dump/";

/**
 * Downloads land in the OS temp directory, not the repo. They total a quarter
 * of a gigabyte and the repo has no ignore rule that would cover them, so
 * caching them anywhere under the worktree is one `git add .` away from a
 * disaster. Re-running the generator the same day costs nothing; a fresh
 * machine pays the download once.
 */
async function cached(name: string, url: string): Promise<string> {
  const dir = join(tmpdir(), "smartput-geo-dump");
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  if (await Bun.file(path).exists()) return path;
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  await Bun.write(path, res);
  return path;
}

/**
 * `unzip -p` rather than a zip library. The repo ships one dependency per
 * package and this is a script that runs a few times a year; adding a decoder
 * to devDependencies to read three archives is the wrong trade. Streaming
 * matters for exactly one of them: alternateNamesV2.txt is 777 MB and does not
 * belong in memory or on disk.
 */
function unzipStream(zip: string, member: string): ReadableStream<Uint8Array> {
  const proc = Bun.spawn(["unzip", "-p", zip, member], {
    stdout: "pipe",
    stderr: "inherit",
  });
  return proc.stdout;
}

async function unzipText(
  zip: string,
  member: string,
): Promise<{ text: string; hash: string }> {
  const text = await new Response(unzipStream(zip, member)).text();
  return { text, hash: sha256(text) };
}

/**
 * The two tables together need ~5300 rows out of twenty million, so the file is
 * consumed a chunk at a time and hashed on the way past. Buffering it whole
 * would be 777 MB of string for a few tens of thousands of useful lines.
 *
 * One pass, two collections: countries and cities disagree about which language
 * tags carry a usable name (`CITY_NAME_LANGUAGES` says why), so each chunk is
 * read twice rather than the file. Splitting a string that is already in memory
 * is not what this loop's time goes on.
 */
async function streamAlternateNames(
  zip: string,
  countryIds: ReadonlySet<number>,
  cityIds: ReadonlySet<number>,
): Promise<{
  countries: Map<number, string[]>;
  cities: Map<number, string[]>;
  hash: string;
}> {
  const hasher = new Bun.CryptoHasher("sha256");
  const countries = new Map<number, string[]>();
  const cities = new Map<number, string[]>();
  const decoder = new TextDecoder();
  let tail = "";

  const absorb = (block: string) => {
    for (const [into, wanted, languages] of [
      [countries, countryIds, NAME_LANGUAGES],
      [cities, cityIds, CITY_NAME_LANGUAGES],
    ] as const) {
      for (const [id, list] of parseAlternateNames(block, wanted, languages)) {
        const have = into.get(id);
        if (have) have.push(...list);
        else into.set(id, list);
      }
    }
  };

  for await (const chunk of unzipStream(zip, "alternateNamesV2.txt")) {
    hasher.update(chunk);
    const text = tail + decoder.decode(chunk, { stream: true });
    const cut = text.lastIndexOf("\n");
    if (cut < 0) {
      tail = text;
      continue;
    }
    tail = text.slice(cut + 1);
    absorb(text.slice(0, cut));
  }
  absorb(tail);
  return { countries, cities, hash: hasher.digest("hex") };
}

/**
 * Last resort for the handful of territories with no city over 15 000: the
 * country's own feature row, from its per-country dump. Those archives are a
 * few kilobytes each and only the countries that need one are fetched, which is
 * why this beats streaming the 2 GB allCountries dump for eight coordinates.
 *
 * timeZones.txt cannot serve here — it has a zone and no position, and a place
 * at 0°N 0°E would make `in | place | place` return a distance to the Gulf of
 * Guinea rather than an error.
 */
async function countryFeature(
  a2: string,
  geonameId: number,
): Promise<{ lat: number; lon: number; zone: string } | null> {
  const cc = a2.toUpperCase();
  const zip = await cached(`${cc}.zip`, `${DUMP}${cc}.zip`);
  const { text } = await unzipText(zip, `${cc}.txt`);
  for (const line of text.split("\n")) {
    const c = line.split("\t");
    if (Number(c[0] ?? "") !== geonameId) continue;
    return {
      lat: Number(c[4] ?? "") || 0,
      lon: Number(c[5] ?? "") || 0,
      zone: c[17] ?? "",
    };
  }
  return null;
}

/**
 * Writes, formats, then stamps the body hash.
 *
 * Formatting has to happen before hashing, so the committed bytes and the hashed
 * bytes are the same ones biome would produce — otherwise the next `biome check`
 * run reformats the file and breaks its own hash.
 */
async function write(name: string, source: string): Promise<number> {
  const out = new URL(`../../packages/geo/src/data/${name}`, import.meta.url).pathname;
  await mkdir(join(out, ".."), { recursive: true });
  await Bun.write(out, source);

  // `--files-max-size` because cities.ts is past biome's 1 MiB default and would
  // otherwise be skipped with a warning — leaving the committed bytes in
  // whatever shape this emitter happened to produce. Formatting it anyway keeps
  // every generated file canonical, so raising the repo's limit one day is not a
  // reformat that breaks four body hashes at once.
  const biome = Bun.spawnSync(
    ["bunx", "biome", "format", "--files-max-size=16777216", "--write", out],
    {
      cwd: new URL("../..", import.meta.url).pathname,
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if (biome.exitCode !== 0) throw new Error(`biome format failed on ${name}`);

  await Bun.write(out, stampHash(await Bun.file(out).text()));
  return (await Bun.file(out).arrayBuffer()).byteLength;
}

/**
 * Why nothing in a city's names survived `buildCityAliases`, for the header.
 *
 * Read off the ASCII name because that is the candidate with the best chance:
 * five words is over the trie's bound, three characters is under the floor, and
 * what is left is a dot or a comma the launcher would tokenize on. Stated per
 * city because "65 cities were dropped" is a number nobody can act on.
 */
function whyUnnamed(city: City): string {
  const ascii = city.asciiName.toLowerCase().replace(/\s+/g, " ").trim();
  if (ascii.split(" ").length > MAX_WORDS) return "over four words";
  if (ascii.length < MIN_NAME_LENGTH) return "under four characters";
  if (!SHAPE.test(ascii)) return "a shape the alias rule refuses";
  return "no usable name at all";
}

async function main(): Promise<void> {
  console.log("geo/build: fetching the GeoNames dump");
  const countryInfoPath = await cached("countryInfo.txt", `${DUMP}countryInfo.txt`);
  const timeZonesPath = await cached("timeZones.txt", `${DUMP}timeZones.txt`);
  const admin1Path = await cached("admin1CodesASCII.txt", `${DUMP}admin1CodesASCII.txt`);
  const citiesZip = await cached("cities15000.zip", `${DUMP}cities15000.zip`);
  const altZip = await cached("alternateNamesV2.zip", `${DUMP}alternateNamesV2.zip`);

  const countryInfoText = await Bun.file(countryInfoPath).text();
  const timeZonesText = await Bun.file(timeZonesPath).text();
  const admin1Text = await Bun.file(admin1Path).text();
  const cities15000 = await unzipText(citiesZip, "cities15000.txt");

  const countries = parseCountryInfo(countryInfoText);
  const cities = parseCities(cities15000.text);
  const zonesByCountry = parseTimeZones(timeZonesText);
  const divisions = parseAdmin1(admin1Text);
  const tier1 = cities.filter(isTier1);

  console.log(
    `geo/build: reading alternate names for ${countries.length} countries and ${tier1.length} cities`,
  );
  const alt = await streamAlternateNames(
    altZip,
    new Set(countries.map((c) => c.geonameId)),
    new Set(tier1.map((c) => c.geonameId)),
  );

  const fallbacks: string[] = [];
  const rows: CountryRowOut[] = [];

  for (const country of countries) {
    const capital = resolveCapital(country, cities);
    const name = capital?.name ?? country.capital;
    let lat = capital?.lat ?? 0;
    let lon = capital?.lon ?? 0;
    let zone = capital?.zone ?? "";

    if (capital === null) {
      const feature = await countryFeature(country.a2, country.geonameId);
      lat = feature?.lat ?? 0;
      lon = feature?.lon ?? 0;
      zone = feature?.zone ?? "";
      fallbacks.push(
        `${country.a2} ${country.name}: no city over 15000; used the country feature` +
          (feature === null ? " (missing)" : ""),
      );
    } else if (capital.fallback !== null) {
      fallbacks.push(
        `${country.a2} ${country.name}: ${capital.fallback}; used ${capital.name}`,
      );
    }

    if (zone === "") {
      const fromTable = zonesByCountry.get(country.a2.toUpperCase()) ?? "";
      fallbacks.push(
        `${country.a2} ${country.name}: no zone on the feature; used timeZones.txt ${fromTable || "(none)"}`,
      );
      zone = fromTable;
    }

    rows.push({
      a2: country.a2,
      a3: country.a3,
      name: country.name,
      aliases: buildAliases(
        country.name,
        country.a2,
        country.a3,
        alt.countries.get(country.geonameId) ?? [],
      ),
      capital: name,
      currency: country.currency,
      phone: country.phone,
      population: country.population,
      area: country.area,
      lat,
      lon,
      zone,
      geonameId: country.geonameId,
      postalRegex: country.postalRegex,
    });
  }

  // Sorted by alpha-2 so a regeneration diffs against the last one rather than
  // against GeoNames' file order, which is not guaranteed stable.
  rows.sort((a, b) => (a.a2 < b.a2 ? -1 : a.a2 > b.a2 ? 1 : 0));

  for (const line of fallbacks) console.log(`  fallback: ${line}`);

  const countryBytes = await write(
    "countries.ts",
    emitCountries(rows, {
      count: rows.length,
      fallbacks,
      inputs: [
        ["countryInfo.txt", sha256(countryInfoText)],
        ["cities15000.txt", cities15000.hash],
        ["timeZones.txt", sha256(timeZonesText)],
        ["alternateNamesV2.txt", alt.hash],
      ],
    }),
  );
  console.log(
    `geo/build: wrote ${rows.length} countries, ${fallbacks.length} fallbacks, ${countryBytes} bytes`,
  );

  // ---- reserved words ----
  //
  // Built after the country table because that table is one of its sources: the
  // short codes M6.1's matcher refuses are a fact about the data, so they are
  // read off the data rather than transcribed.
  const reserved = buildReserved([
    { id: "core locale/en keywords", words: keywordWords(en) },
    // Straight from the package: cardinals, tens, scales, "point", and the "and"
    // that makes "two hundred and five" one number rather than a sum.
    { id: "number NUMBER_WORDS", words: NUMBER_WORDS },
    { id: "Intl months and weekdays", words: calendarWords() },
    { id: "chrono en.casual patterns", words: chronoWords() },
    { id: "kinds BUILTIN_KINDS aliases", words: unitWords(BUILTIN_KINDS) },
    { id: "geo COUNTRIES short codes", words: shortPlaceCodes(rows) },
  ]);
  for (const word of reserved.redundant) {
    console.log(`  supplement "${word}" is redundant — a source already produces it`);
  }
  const reservedBytes = await write("reserved.ts", emitReserved(reserved));
  const forbidden = reservedSet(reserved);
  console.log(
    `geo/build: wrote ${forbidden.size} reserved words, ${reservedBytes} bytes`,
  );

  // ---- cities ----
  const byA2 = new Set(rows.map((r) => r.a2));
  const divisionByKey = new Map(divisions.map((d) => [d.key, d]));
  const drops: ReservedDrop[] = [];
  const unnamed: string[] = [];
  const usedDivisions = new Set<string>();
  const orphans: string[] = [];
  const cityRows: CityRowOut[] = [];

  for (const city of tier1) {
    const country = city.country.toLowerCase();
    if (!byA2.has(country)) {
      orphans.push(`${city.name} (${city.country}): no country row to join to`);
      continue;
    }

    const key = `${city.country.toUpperCase()}.${city.admin1}`;
    // A code with no division row cannot be scoped against, and `CityRow.admin1`
    // promises a join. Blanking it here is what lets cities.test.ts assert the
    // join holds for every row instead of listing exceptions.
    const admin1 = city.admin1 !== "" && divisionByKey.has(key) ? city.admin1 : "";
    if (admin1 !== "") usedDivisions.add(key);

    const { aliases, reserved: refused } = buildCityAliases(
      city.name,
      city.asciiName,
      alt.cities.get(city.geonameId) ?? [],
      forbidden,
    );
    for (const word of refused) {
      drops.push({
        word,
        city: city.name,
        country,
        unreachable: aliases.length === 0,
      });
    }
    // A row nothing can name is dead weight in a file whose size is the reason
    // T1 is a separate entry point. It is reported, not silently dropped.
    if (aliases.length === 0) {
      unnamed.push(`${city.name} (${country}, ${city.population}) — ${whyUnnamed(city)}`);
      continue;
    }

    cityRows.push({
      geonameId: city.geonameId,
      name: city.name,
      aliases,
      country,
      admin1,
      lat: city.lat,
      lon: city.lon,
      zone: city.zone,
      population: city.population,
      capital: city.featureCode === "PPLC",
    });
  }

  // Country first so the file reads as one country's cities at a time, then
  // population descending so the row a reader looks for is at the top of its
  // block, then the id to break the ties population leaves.
  cityRows.sort(
    (a, b) =>
      (a.country < b.country ? -1 : a.country > b.country ? 1 : 0) ||
      b.population - a.population ||
      a.geonameId - b.geonameId,
  );

  const admin1Rows: Admin1RowOut[] = [...usedDivisions]
    .sort()
    .map((key) => {
      const d = divisionByKey.get(key) as Admin1Info;
      return {
        key,
        name: d.name,
        aliases: buildAdmin1Aliases(key, d.name, d.asciiName, forbidden),
      };
    })
    .filter((r) => r.aliases.length > 0);

  // A division whose every alias was refused can scope nothing, so the cities
  // pointing at it are re-blanked rather than left with a key that joins to no
  // row — the invariant cities.test.ts checks.
  const scopable = new Set(admin1Rows.map((r) => r.key));
  for (const row of cityRows) {
    if (row.admin1 === "") continue;
    if (!scopable.has(`${row.country.toUpperCase()}.${row.admin1}`)) row.admin1 = "";
  }

  for (const line of orphans) console.log(`  orphan: ${line}`);
  for (const drop of drops) {
    console.log(
      `  reserved: ${drop.city} (${drop.country}) may not be "${drop.word}"${drop.unreachable ? " — and has no other alias, so it is dropped" : ""}`,
    );
  }

  const geoInputs = [
    ["cities15000.txt", cities15000.hash],
    ["admin1CodesASCII.txt", sha256(admin1Text)],
    ["alternateNamesV2.txt", alt.hash],
  ] as const;

  const cityBytes = await write(
    "cities.ts",
    emitCities(cityRows, {
      inputs: geoInputs,
      count: cityRows.length,
      capitals: cityRows.filter((r) => r.capital).length,
      drops,
      unnamed,
    }),
  );
  const admin1Bytes = await write("admin1.ts", emitAdmin1(admin1Rows, geoInputs));
  console.log(
    `geo/build: wrote ${cityRows.length} cities (${cityBytes} bytes) and ${admin1Rows.length} divisions (${admin1Bytes} bytes)`,
  );
}

if (import.meta.main) await main();
