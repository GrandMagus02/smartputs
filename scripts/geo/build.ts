import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Builds `packages/geo/src/data/countries.ts` from the GeoNames dump.
 *
 * Run deliberately — `bun run scripts/geo/build.ts` — and commit the diff. The
 * data is vendored rather than fetched at build time so the package takes on no
 * runtime dependency and no third party can break a build (spec §7.2), and the
 * generated file carries the SHA-256 of its own body so a hand edit is caught
 * by `countries.test.ts` rather than shipped.
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
      population: Number(c[14] ?? "") || 0,
      zone: c[17] ?? "",
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

export function parseAlternateNames(
  text: string,
  wanted: ReadonlySet<number>,
): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const c = line.split("\t");
    const id = Number(c[1] ?? "");
    if (!wanted.has(id)) continue;
    if (!NAME_LANGUAGES.has(c[2] ?? "")) continue;
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

export function bodyOf(source: string): string {
  const at = source.indexOf(BODY_MARKER);
  if (at < 0) throw new Error("countries.ts has lost its body marker");
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
 * The country table needs ~250 rows out of twenty million, so the file is
 * consumed a chunk at a time and hashed on the way past. Buffering it whole
 * would be 777 MB of string for 44 000 useful lines.
 */
async function streamAlternateNames(
  zip: string,
  wanted: ReadonlySet<number>,
): Promise<{ names: Map<number, string[]>; hash: string }> {
  const hasher = new Bun.CryptoHasher("sha256");
  const names = new Map<number, string[]>();
  const decoder = new TextDecoder();
  let tail = "";

  for await (const chunk of unzipStream(zip, "alternateNamesV2.txt")) {
    hasher.update(chunk);
    const text = tail + decoder.decode(chunk, { stream: true });
    const cut = text.lastIndexOf("\n");
    if (cut < 0) {
      tail = text;
      continue;
    }
    tail = text.slice(cut + 1);
    for (const [id, list] of parseAlternateNames(text.slice(0, cut), wanted)) {
      const have = names.get(id);
      if (have) have.push(...list);
      else names.set(id, list);
    }
  }
  for (const [id, list] of parseAlternateNames(tail, wanted)) {
    const have = names.get(id);
    if (have) have.push(...list);
    else names.set(id, list);
  }
  return { names, hash: hasher.digest("hex") };
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

async function main(): Promise<void> {
  console.log("geo/build: fetching the GeoNames dump");
  const countryInfoPath = await cached("countryInfo.txt", `${DUMP}countryInfo.txt`);
  const timeZonesPath = await cached("timeZones.txt", `${DUMP}timeZones.txt`);
  const citiesZip = await cached("cities15000.zip", `${DUMP}cities15000.zip`);
  const altZip = await cached("alternateNamesV2.zip", `${DUMP}alternateNamesV2.zip`);

  const countryInfoText = await Bun.file(countryInfoPath).text();
  const timeZonesText = await Bun.file(timeZonesPath).text();
  const cities15000 = await unzipText(citiesZip, "cities15000.txt");

  const countries = parseCountryInfo(countryInfoText);
  const cities = parseCities(cities15000.text);
  const zonesByCountry = parseTimeZones(timeZonesText);

  console.log(`geo/build: reading alternate names for ${countries.length} countries`);
  const alt = await streamAlternateNames(
    altZip,
    new Set(countries.map((c) => c.geonameId)),
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
        alt.names.get(country.geonameId) ?? [],
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

  const out = new URL("../../packages/geo/src/data/countries.ts", import.meta.url)
    .pathname;
  await mkdir(join(out, ".."), { recursive: true });
  await Bun.write(
    out,
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

  // Formatted before hashing, so the committed bytes and the hashed bytes are
  // the same ones biome would produce — otherwise the next `biome check` run
  // reformats the file and breaks its own hash.
  const biome = Bun.spawnSync(["bunx", "biome", "format", "--write", out], {
    cwd: new URL("../..", import.meta.url).pathname,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (biome.exitCode !== 0) throw new Error("biome format failed on the generated file");

  await Bun.write(out, stampHash(await Bun.file(out).text()));

  const bytes = (await Bun.file(out).arrayBuffer()).byteLength;
  console.log(
    `geo/build: wrote ${rows.length} countries, ${fallbacks.length} fallbacks, ${bytes} bytes`,
  );
}

if (import.meta.main) await main();
