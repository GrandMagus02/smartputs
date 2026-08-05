import { defineKind, type Kind, type UnitLexeme } from "@smartput/core";
import { PlaceCompleter } from "./completion";
import { COUNTRIES } from "./data/countries";
import { distance } from "./distance";
import { formatPlace } from "./format";
import { createPlaceLiteral, MIN_NAME_LENGTH } from "./matcher";
import { createPostalLiteral } from "./postal";
import type { Admin1Row, CityRow } from "./types";

/**
 * Units are the ISO 3166-1 alpha-2 set (spec §4.1), built from COUNTRIES the
 * way datetime builds its units from ZONES. An opaque unit is a label, not a
 * ratio, and a country is exactly that: indexed, weighted, formatted and usable
 * as an `in` target. Every place Value's unit is therefore its country, which
 * is what lets `LiteralMatch.unit` always name something registered.
 *
 * Names only. The alias index is global — one key, every kind — so shipping the
 * codes as aliases makes "km" Comoros as well as a kilometre, "3pm" a country
 * instead of a time and "3 days ago" unparseable, none of which any weight can
 * undo. §4.1 lists alpha-3 among the aliases; it is dropped here because the
 * matcher's trie carries every code already and offers it a guard the index has
 * no way to express.
 *
 * Cities do not appear here, and that is the non-obvious half of M6.2. The
 * paragraph above is an argument about *volume* as much as about codes: T1 is
 * six thousand more names, and a global index full of "nice", "gaza", "split"
 * and "of" is the same destructive failure at twenty-five times the size. So a
 * city is never a unit — it is reachable only through the matcher's trie, where
 * a claim can be refused by surface, by neighbour and by reserved word before
 * the fold eats the token. A city Value borrows its country's alpha-2 instead,
 * which is why `PlaceMeta.country` still equals `Value.unit` for a city.
 */
const COUNTRY_UNITS: Record<string, UnitLexeme> = {};
for (const row of COUNTRIES) {
  COUNTRY_UNITS[row.a2] = {
    aliases: row.aliases.filter((a) => a.length >= MIN_NAME_LENGTH),
    symbol: row.name,
  };
}

export interface PlaceOptions {
  /** T1, from `@smartput/geo/cities`. Absent means countries only. */
  readonly cities?: readonly CityRow[];
  /**
   * The divisions a city can be scoped by, `paris texas` (spec §5.2). Separate
   * from `cities` rather than folded into it because a consumer who wants the
   * gazetteer but not the ~40 KB of division names can pass one without the
   * other; the matcher just has no scoped edges to walk.
   */
  readonly admin1?: readonly Admin1Row[];
}

/**
 * A country, a city or a postal code. Opaque for datetime's reason: it is not a
 * scalar on a ratio line, and every operation it supports is a declared
 * signature — one, here.
 *
 * A factory and not a constant so that T1 arrives as an argument. Nothing in
 * this module imports `data/cities.ts`, deliberately: a static import links the
 * whole gazetteer into every bundle that touches "@smartput/geo", and no
 * bundler can prove `CITIES` unused once the kind closes over it. The tiering in
 * spec §3 is only real if the dependency edge runs from the consumer inwards,
 * so `@smartput/geo/cities` is a second entry point the consumer names.
 *
 * Each call returns an independent Kind. Two of them cannot share a registry —
 * both are `id: "place"` — which is intended: a build is a choice made once.
 */
export function definePlace(opts: PlaceOptions = {}): Kind {
  return defineKind({
    id: "place",
    // No `equals`: canonical is the GeoNames id (spec §4.2), so two Values are
    // the same place exactly when their canonicals are equal, and that is already
    // the default. Declaring one would restate it and invite it to drift.
    value: { mode: "opaque", units: COUNTRY_UNITS },
    // Names before codes. Both are registered unconditionally — a postal code is
    // T0 data, one column of COUNTRIES, so gating it on `opts.cities` would tie
    // a country's own format to a gazetteer it has nothing to do with.
    //
    // The order is not a precedence: the fold groups every match that reaches
    // the same end, so on the one input both could claim — a name that is also
    // a code — the readings travel on together and the solver ranks them. What
    // the order does buy is that the name matcher, which is the one with a trie
    // and a scope walk, is the first to see a span; the postal walk is 178
    // regexes and the cheaper question to ask second.
    literals: [
      createPlaceLiteral(COUNTRIES, opts.cities, opts.admin1),
      createPostalLiteral(COUNTRIES),
    ],
    // Tiered by the same argument the matcher is, so `definePlace()` completes
    // countries and not one city, and the gazetteer is only walked by a build
    // that was handed it.
    //
    // Registered by both tiers and not gated on `opts.cities`, which is the
    // non-obvious half: core completes a kind out of the global alias index,
    // that path takes ratio kinds only, and a place is opaque — so the T0 build
    // is the one that completes *nothing* without this line, even though every
    // country is in that index as a unit. Gating would have read as "cities are
    // the thing being completed" and quietly cost `ukrai` its answer.
    //
    // The trie itself is not built here. `place` below is a module constant, so
    // this runs at import time for every consumer, and `PlaceCompleter` defers
    // to the first keystroke.
    completions: new PlaceCompleter(COUNTRIES, opts.cities).completions,
    ops: [distance],
    format: formatPlace,
  });
}

/**
 * The T0 build, and what `import { place } from "@smartput/geo"` still gets:
 * countries only, byte-for-byte the behaviour M6.1 shipped.
 */
export const place: Kind = definePlace();
