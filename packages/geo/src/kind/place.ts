import { defineKind, type Kind } from "@smartput/core";
import { PlaceDistance } from "@smartput/distance";
import { createPostalLiteral } from "../postal/literal";
import { PlaceCompleter } from "./completion";
import { createPlaceFormatter } from "./format";
import { createPlaceLiteral } from "./matcher";
import type { Admin1Row, CityRow, CountryRow } from "./types";

export interface PlaceOptions {
  /**
   * The countries. Required, and the one table without which there is no kind:
   * a place Value's unit is always its country (geo spec §4.1), so an empty
   * table is a kind with no units at all.
   *
   * Where it comes from is the consumer's: `countryTable()` builds one from
   * GeoNames, a cached export deserializes into one, and a test writes four rows
   * by hand. What is gone is the fourth option — a table this repository ships —
   * and with it the monthly regeneration and the per-language copy of it.
   */
  readonly countries: readonly CountryRow[];
  /** Cities, if the consumer has any. Absent means countries only. */
  readonly cities?: readonly CityRow[];
  /**
   * The divisions a city can be scoped by, `paris texas` (geo spec §5.2).
   * Separate from `cities` rather than folded into it because a consumer who
   * wants a gazetteer but not the division names can pass one without the
   * other; the matcher just has no scoped edges to walk.
   */
  readonly admin1?: readonly Admin1Row[];
}

/**
 * A country, a city or a postal code. Opaque for datetime's reason: it is not a
 * scalar on a ratio line, and every operation it supports is a declared
 * signature — one, here.
 *
 * Every table arrives as an argument, which used to be true of the cities alone
 * and is now true of the countries too. The tiering argument that shape was
 * built for — keep a megabyte of gazetteer out of a bundle that only wanted a
 * country — has become something simpler: this package ships no places, so
 * there is nothing for a consumer to import by accident and nothing for anyone
 * to keep in step with upstream.
 *
 * Units are the alpha-2 codes of whatever table it was handed, built the way
 * datetime builds its units from ZONES. An opaque unit is a label, not a ratio,
 * and a country is exactly that: indexed, weighted, formatted and usable as an
 * `in` target. Every place Value's unit is therefore its country, which is what
 * lets `LiteralMatch.unit` always name something registered.
 *
 * Ids, and no words: the names a user types for a country are the *data's*, not
 * this package's, so they reach the registry as a `Vocabulary` built from the
 * same table — see `placeVocabulary` in `../locale/vocabulary.ts`. That is also
 * the whole of the internationalization story now: ask a provider for `lang`,
 * and the vocabulary is in that language.
 *
 * Cities are never units, and that is the non-obvious half of M6.2. The argument
 * is about *volume* as much as about codes: a gazetteer is thousands more names,
 * and a global index full of "nice", "gaza", "split" and "of" is a destructive
 * failure at scale. So a city is reachable only through the matcher's trie,
 * where a claim can be refused by surface, by neighbour and by reserved word
 * before the fold eats the token. A city Value borrows its country's alpha-2
 * instead, which is why `PlaceMeta.country` still equals `Value.unit` for a city.
 *
 * Each call returns an independent Kind. Two of them cannot share a registry —
 * both are `id: "place"` — which is intended: a build is a choice made once.
 */
export function definePlace(opts: PlaceOptions): Kind {
  const { countries, cities, admin1 } = opts;

  return defineKind({
    id: "place",
    // No `equals`: canonical is the GeoNames id (geo spec §4.2), so two Values
    // are the same place exactly when their canonicals are equal, and that is
    // already the default. Declaring one would restate it and invite it to drift.
    value: { mode: "opaque", units: countries.map((row) => row.a2) },
    // Names before codes. Both are registered unconditionally — a postal format
    // is one column of the country table, so gating it on `cities` would tie a
    // country's own format to a gazetteer it has nothing to do with.
    //
    // The order is not a precedence: the fold groups every match that reaches
    // the same end, so on the one input both could claim — a name that is also
    // a code — the readings travel on together and the solver ranks them. What
    // the order does buy is that the name matcher, which is the one with a trie
    // and a scope walk, is the first to see a span; the postal walk is one regex
    // per country and the cheaper question to ask second.
    literals: [
      createPlaceLiteral(countries, cities, admin1),
      createPostalLiteral(countries),
    ],
    // Registered by both tiers and not gated on `cities`, which is the
    // non-obvious half: core completes a kind out of the global alias index,
    // that path takes ratio kinds only, and a place is opaque — so a
    // countries-only build is the one that completes *nothing* without this
    // line, even though every country is in that index as a unit. Gating would
    // have read as "cities are the thing being completed" and quietly cost
    // `ukrai` its answer.
    //
    // The trie itself is not built here: `PlaceCompleter` defers to the first
    // keystroke, which matters more now that a build can happen after a fetch.
    completions: new PlaceCompleter(countries, cities).completions,
    // Built per call rather than shared, because the op measures from the table
    // its kind registered: a build handed a different table must not fall back
    // to another one's coordinates.
    ops: [new PlaceDistance(countries).op],
    format: createPlaceFormatter(countries),
  });
}
