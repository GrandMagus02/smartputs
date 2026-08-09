import { expect } from "bun:test";
import { Corpora, parseCorpus } from "@smartput/core/testing";
import type { GeoKind } from "./features";
import { Geo } from "./geo";
import type { Place } from "./place";
import { bundled } from "./providers/custom";
import type { GeoProvider, GeoQuery } from "./types";

/**
 * The corpus, replayed through a `Geo` over a pinned gazetteer.
 *
 * Two files per language and not one: `gazetteer-<id>.tsv` is what exists, and
 * `<id>.tsv` is what is asked and what must come back. Splitting them is what
 * lets a reviewer read a row like `dnipro → the city, kind:water → the river`
 * and check it against the two rows that make it true, rather than against a
 * table of places embedded in a test file.
 *
 * No network, which is the same ruling every corpus in this repo makes for its
 * own reason. Here the reason is sharper than usual: a test that asked GeoNames
 * what "paris" is would be asserting GeoNames' uptime, their current population
 * figures and their ranking — none of which is this package's — and would fail
 * on a Sunday for reasons no one could act on. What is under test is the query
 * grammar, the filters and the ranking, and all three are ours.
 *
 * `Corpora.evaluate()` is not used, because it is the four-column engine-shaped
 * default and this package registers no kind and builds no engine. `each()` is
 * the door for exactly that, and it is what `@smartput/currency` and
 * `@smartput/timezone` already reach for.
 */

/** One gazetteer row: `id name kind country admin1 population postal lat lon`. */
function gazetteer(rows: readonly (readonly string[])[]): {
  places: Place[];
  kindOf: (place: Place) => GeoKind;
} {
  const places: Place[] = [];
  // Keyed on the identity `rank` itself uses, so the labelling survives the
  // copy `bundled` makes and cannot drift from the row it came from.
  const kinds = new Map<string, GeoKind>();

  for (const row of rows) {
    const place: Place = {
      geonameId: Number(row[0] ?? 0),
      name: row[1] ?? "",
      country: row[3] ?? "",
      admin1: row[4] ?? "",
      population: Number(row[5] ?? 0),
      postal: row[6] ?? "",
      lat: Number(row[7] ?? 0),
      lon: Number(row[8] ?? 0),
      // Neither is what this corpus asks about, and inventing them would put two
      // fabricated facts into every assertion's blast radius.
      zone: "",
      currency: "",
    };
    places.push(place);
    kinds.set(key(place), (row[2] ?? "city") as GeoKind);
  }

  return {
    places,
    kindOf: (place) => kinds.get(key(place)) ?? "city",
  };
}

/** Distinct per fixture row: the postal row's id is 0 and its code is not. */
function key(place: Place): string {
  return `${place.geonameId}|${place.postal}`;
}

/**
 * The filter column, which is a spelling of `GeoQuery` and nothing more.
 *
 * Parsed in the test rather than in the package on purpose: `Geo` takes a record
 * and has no string grammar of its own, and giving the corpus one that the
 * library also had would let the two drift into disagreeing about what a query
 * means.
 */
function query(text: string, filter: string): GeoQuery {
  const kinds: GeoKind[] = [];
  const countries: string[] = [];
  const q: {
    text: string;
    kinds?: GeoKind[];
    countries?: string[];
    near?: { lat: number; lon: number };
    bbox?: [number, number, number, number];
  } = { text };
  if (filter === "-") return q;

  // Semicolons between clauses, because a comma is already the separator inside
  // one: `near:33.66,-95.56` is a single coordinate pair, and splitting the
  // column on commas read `-95.56` as a filter name of its own.
  for (const clause of filter.split(";")) {
    const [head, ...rest] = clause.split(":");
    const tail = rest.join(":");
    if (head === "kind") kinds.push(tail as GeoKind);
    else if (head === "country") countries.push(tail);
    else if (head === "near") {
      const [lat, lon] = tail.split(",").map(Number);
      q.near = { lat: lat ?? 0, lon: lon ?? 0 };
    } else if (head === "bbox") {
      const [w, s, e, n] = tail.split(",").map(Number);
      q.bbox = [w ?? 0, s ?? 0, e ?? 0, n ?? 0];
    } else if (head !== "") {
      // Loud rather than ignored: a typo in a filter would otherwise turn a row
      // that asserts a narrowing into a row that asserts the unfiltered search,
      // and pass.
      throw new Error(`corpus filter ${JSON.stringify(clause)} names no GeoQuery field`);
    }
  }
  // Assigned only when non-empty: the repo compiles with
  // `exactOptionalPropertyTypes`, and an explicit `undefined` is not an absent
  // option. An empty array would also read as "no filter" to `rank`, but saying
  // so by omission is what a caller would actually write.
  if (kinds.length > 0) q.kinds = kinds;
  if (countries.length > 0) q.countries = countries;
  return q;
}

const dir = new URL("../corpus/", import.meta.url);

/** A `Geo` per language, over that language's own gazetteer. */
async function geoFor(id: string): Promise<Geo> {
  // A subdirectory, and not `corpus/gazetteer-<id>.tsv` beside the corpora. The
  // repo-wide net globs `packages/*/corpus/*.tsv` and requires every file it
  // finds to be a corpus that is replayed or a corpus that is excused by name;
  // a fixture sitting in that namespace is neither, and answering the net by
  // excusing it would have said "this corpus is not replayed" about a file that
  // is not a corpus.
  const rows = parseCorpus(await Bun.file(new URL(`gazetteer/${id}.tsv`, dir)).text());
  const { places, kindOf } = gazetteer(rows);
  const provider: GeoProvider = bundled(places, {
    asOf: "2026-08-09",
    kindOf,
    attribution: `fixture:${id}`,
  });
  return new Geo({ providers: [provider] });
}

const geos = new Map<string, Geo>([
  ["en", await geoFor("en")],
  ["uk", await geoFor("uk")],
]);

const corpora = await Corpora.load(dir, [{ id: "en" }, { id: "uk" }]);

corpora.each(([text, filter, name, kind, country], language) => {
  const geo = geos.get(language.id);
  if (geo === undefined) throw new Error(`no Geo built for "${language.id}"`);

  // Returned, not dropped: `Corpora.each` hands an assertion's promise straight
  // to the test runner, which is why a package whose door is async can use the
  // same harness as thirty-four packages whose door is not.
  return geo.search(query(text as string, filter as string)).then((hits) => {
    const top = hits[0];
    // Named, because "expected undefined to be defined" is what a corpus row
    // that finds nothing at all would otherwise report, for any of eighteen rows.
    expect(top, `no hit for ${JSON.stringify(text)}`).toBeDefined();
    expect(top?.place.name).toBe(name as string);
    expect(top?.kind).toBe(kind as GeoKind);
    expect(top?.place.country).toBe(country as string);
  });
});
