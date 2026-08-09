import {
  type CompleteCtx,
  type Completer,
  EXACT_BONUS,
  type KindCompletion,
  LENGTH_PENALTY,
} from "@smartput/core";
import { MIN_NAME_LENGTH } from "./matcher";
import type { CityRow, CountryRow } from "./types";

/**
 * Prefix completion for places (spec §10, M6.4).
 *
 * Core's own completion path cannot reach a place, twice over: it skips any kind
 * whose value mode is not `ratio`, and a place is opaque — and the names it
 * would have searched are not in the global alias index anyway, because a city
 * is never a unit and a country alias below `MIN_NAME_LENGTH` is never
 * registered (both rulings are `place.ts`'s). `Kind.completions` is the door
 * core left open for a vocabulary in exactly that position, and this file is
 * geo's side of it.
 *
 * What lives here is a second trie, keyed on characters, and not the matcher's,
 * keyed on words. That is not a duplicate of the same structure: an exact walk
 * over "san francisco california" is a walk over words, and completion asks what
 * a half-typed word could become, which is a walk over characters. Sharing the
 * matcher's would have meant testing every key of its root — 6,778 distinct
 * first words — with `startsWith` on every keystroke, which is precisely the
 * linear scan a completer on the keystroke path cannot afford.
 */

/**
 * Spec §6.1's order, rebased so a country tops out at zero.
 *
 * §6.1's own figures are `+3`, `+2` and a capped population scale, and they are
 * the *matcher's*: there they rank one literal claim against another and
 * `RANK_STEP` spaces them afterwards. `complete()` adds this number to a score
 * whose other terms are `prefixQuality` and a weight layer — and the alias
 * index, which is every unit in the engine, contributes nothing in this position
 * at all. So `+3` does not say "a country outranks a city" here, it says "a
 * country outranks the kilogram", and it measurably did: at §6.1's own figures,
 * 56 of the 294 prefixes of a builtin unit alias lost their first row to a
 * place. `me` completed Mesa rather than metre, `ho` Homs rather than hour, and
 * `2 km in mil` Milan rather than mile — which is the corpus row that reported
 * it. `ambiguity.test.ts` holds the sweep and the twelve that legitimately
 * remain.
 *
 * Zero at the top is the two scales sharing an origin. A country now meets a
 * unit as an equal and is separated from it by how much of each is still to be
 * typed, which is the alias path's own rule and the only rule both paths can
 * state; §6.1's spread survives underneath as the ordering among places, which
 * is all this file ever asked of it. Scaling the figures down was the
 * alternative and it pays for the gap to the units by shrinking the gaps between
 * places, which are the ones §6.1 actually decided.
 */
const COUNTRY_WEIGHT = 0;
const CAPITAL_WEIGHT = -1;
/** The population scale spans `[-3, -1]`, so its top still ties a capital. */
const CITY_WEIGHT_FLOOR = -3;
const CITY_WEIGHT_CAP = -1;

/**
 * How many places compete for the list, before core merges them with every other
 * kind's rows and applies its own `limit`.
 *
 * A cap and not a courtesy. Core imposes none, and eight thousand names behind
 * one letter would otherwise all be scored, sorted and offered — so this is the
 * number that keeps the walk bounded rather than the number a launcher shows.
 *
 * Three, because the list is shared. Core's own default is ten rows for all
 * kinds at once, so what this number really sets is how many units a place may
 * push off the end — which only shows once the kind is registered beside the
 * built-ins. At eight it showed badly: `ki` offered eight cities, three of which
 * were Kira, Kita and Kisi, and cost kilobyte and kilometre their place in the
 * ten; across every prefix of every builtin alias, seven of them lost eleven
 * rows between them. At three the same sweep loses one row, and nothing the tier
 * is for goes missing — `united` still lists the three United somethings and
 * `congo` still lists both Congos.
 *
 * A launcher whose list is places wants the longer one and asks: `withLimit`.
 */
export const DEFAULT_LIMIT = 3;

/** Stable identity, so the memo below survives the two-argument call. */
const NO_CITIES: readonly CityRow[] = [];

interface Entry {
  /** The lowercased name the user is typing a prefix of. */
  readonly alias: string;
  /** The display name, which is what the box gets. */
  readonly text: string;
  readonly unit: string;
  readonly key: string;
  readonly weight: number;
  /**
   * How this row ranks against the others, and deliberately the formula
   * `complete()` is about to apply to it again: `prefixQuality` charges
   * `LENGTH_PENALTY` for every character of the alias still untyped, and the
   * fragment is the same length for every candidate of one keystroke, so
   * dropping that constant leaves core's own order.
   *
   * Ranking by §6.1's weight alone was the alternative, and it selects the wrong
   * rows rather than merely ordering them oddly: a capital with a fourteen-letter
   * name would take a slot core would have given "paris", and a row this file
   * drops is a row core never gets to rank.
   */
  readonly rank: number;
}

interface PrefixNode {
  /** The character reaching this node, read by the descent. */
  readonly char: string;
  /**
   * Sorted by `ceiling`, descending, so the walk can stop at the first branch it
   * refuses instead of testing the rest.
   */
  kids: PrefixNode[];
  /** Aliases ending exactly here, ranked. Sorted so the same break works. */
  here?: Entry[];
  /**
   * The best `rank` anywhere below, which is the bound the walk prunes on. It is
   * admissible for free: an entry's rank falls as its alias grows, so nothing
   * deeper can beat what this promises.
   */
  ceiling: number;
}

/** Opaque on purpose: what a caller does with it is pass it back. */
export interface PlaceIndex {
  readonly root: PrefixNode;
}

/** Spec §6.1's population scale, as `matcher.ts` computes it, on the origin above. */
function cityWeight(row: CityRow): number {
  if (row.capital) return CAPITAL_WEIGHT;
  if (row.population <= 0) return CITY_WEIGHT_FLOOR;
  return Math.min(Math.log10(row.population) / 3 + CITY_WEIGHT_FLOOR, CITY_WEIGHT_CAP);
}

function childOf(node: PrefixNode, char: string): PrefixNode | undefined {
  for (const kid of node.kids) if (kid.char === char) return kid;
  return undefined;
}

function insert(root: PrefixNode, alias: string, entry: Entry): void {
  // The floor the global alias index applies, applied here by hand.
  //
  // This path never touches that index, so nothing about it is inherited: "km"
  // is Comoros as well as a kilometre and "in" is India as well as an inch, and
  // an offered Comoros outranks the unit whose alias the user was halfway
  // through. The rule is one line and it belongs on the way in, where the table
  // an alias came from cannot matter — the generator already holds city aliases
  // to the same floor, and depending on that promise instead would make this
  // guard a property of the data rather than of the file that needs it.
  if (alias.length < MIN_NAME_LENGTH) return;

  let node = root;
  for (const char of alias) {
    let next = childOf(node, char);
    if (next === undefined) {
      next = { char, kids: [], ceiling: Number.NEGATIVE_INFINITY };
      node.kids.push(next);
    }
    node = next;
  }
  if (node.here === undefined) node.here = [];
  node.here.push(entry);
}

/**
 * Rank ascending is the tie-break core will use, and `key` is the last resort so
 * that two places of one name and one population come out in the same order on
 * every run — core's final sort is stable and falls back to whatever order this
 * file returned, so an unstable order here would be an unstable launcher.
 */
function outranks(a: Entry, aScore: number, b: Entry, bScore: number): boolean {
  if (aScore !== bScore) return aScore > bScore;
  if (a.alias !== b.alias) return a.alias < b.alias;
  return a.key < b.key;
}

/** Bottom-up: ranks each node's own rows and hands its ceiling to its parent. */
function seal(node: PrefixNode): number {
  let ceiling = Number.NEGATIVE_INFINITY;

  const here = node.here;
  if (here !== undefined) {
    here.sort((a, b) => (outranks(a, a.rank, b, b.rank) ? -1 : 1));
    ceiling = (here[0] as Entry).rank;
  }

  for (const kid of node.kids) ceiling = Math.max(ceiling, seal(kid));
  node.kids.sort((a, b) => b.ceiling - a.ceiling);
  node.ceiling = ceiling;

  return ceiling;
}

function entryOf(
  alias: string,
  text: string,
  unit: string,
  geonameId: number,
  weight: number,
): Entry {
  return {
    alias,
    text,
    unit,
    // Every US city shares the unit "us", so the unit cannot be the key core
    // de-duplicates on; the GeoNames id can, and it is already what identifies a
    // place everywhere else in this package (spec §4.2). It is also what keeps
    // "kiev" and "kyiv" one row rather than two of the same city.
    key: String(geonameId),
    weight,
    rank: weight - alias.length * LENGTH_PENALTY,
  };
}

/**
 * Every name of both tiers, in one character trie.
 *
 * Countries are here as well as cities even though a country *is* in the global
 * alias index: the index only completes ratio kinds, so without this the T0
 * build would complete nothing at all.
 *
 * Divisions are not, and `admin1` is not a parameter. A division is deliberately
 * not a place (see `Admin1Row`), so "texas" has no `unit`, no display name and
 * nothing for core to insert; offering one would put a row in the list that
 * evaluates to nothing.
 */
export function createPlaceIndex(
  countries: readonly CountryRow[],
  cities: readonly CityRow[] = NO_CITIES,
): PlaceIndex {
  const root: PrefixNode = { char: "", kids: [], ceiling: Number.NEGATIVE_INFINITY };

  for (const row of countries) {
    for (const alias of row.aliases) {
      insert(
        root,
        alias,
        entryOf(alias, row.name, row.a2, row.geonameId, COUNTRY_WEIGHT),
      );
    }
  }

  const registered = new Set(countries.map((c) => c.a2));
  for (const row of cities) {
    // `KindCompletion.unit` has to name a unit the kind registered, and the kind
    // registers one per country. Core drops a row that names anything else, so a
    // city whose country is absent is dropped here instead, where the reason for
    // it is still in view. Same rule the matcher applies to the same table.
    if (!registered.has(row.country)) continue;
    const weight = cityWeight(row);
    for (const alias of row.aliases) {
      insert(root, alias, entryOf(alias, row.name, row.country, row.geonameId, weight));
    }
  }

  seal(root);
  return { root };
}

/**
 * The best `limit` places whose name begins with what is being typed.
 *
 * Two walks, not one. The descent spends one step per character of the fragment
 * and is what makes an unknown prefix free; the branch-and-bound below it reads
 * only the branches that could still hold a row good enough to be offered, which
 * is why "s" costs the same order as "kyiv" despite standing over 909 names.
 * Collecting the whole subtree and sorting it was the alternative, and it is 60
 * times slower on the worst fragment — a keystroke budget spent on names the
 * user will never see.
 */
export function completePlaces(
  index: PlaceIndex,
  ctx: CompleteCtx,
  limit: number = DEFAULT_LIMIT,
): readonly KindCompletion[] {
  // A number in front of the fragment says the word is a unit: "10 k" is asking
  // about kilometres, and there is no such thing as ten Kyivs. Core cannot know
  // that — it hands the count over precisely so a kind can rule on it — and the
  // cost of not ruling is measurable: an unfiltered gazetteer pushes a real
  // temperature row out of the list of ten on "10 k".
  if (ctx.count !== undefined) return [];
  if (limit <= 0 || ctx.fragment.length === 0) return [];

  // Longest first, so "san fran" is tried as one name before it is tried as
  // "fran" — the whole reason a completer is given the input and not just the
  // fragment. Descending is one step per character and stops at the first
  // unknown one, so the discarded attempts cost a handful of map lookups.
  let node: PrefixNode | undefined;
  let start = ctx.span.start;
  for (const search of searches(ctx)) {
    let at: PrefixNode | undefined = index.root;
    for (const char of search.text) {
      at = at === undefined ? undefined : childOf(at, char);
      if (at === undefined) break;
    }
    if (at !== undefined) {
      node = at;
      start = search.start;
      break;
    }
  }
  if (node === undefined) return [];

  const top: Entry[] = [];
  const scores: number[] = [];
  let floor = Number.NEGATIVE_INFINITY;

  const offer = (entry: Entry, score: number): void => {
    // One place, one row, even though "kenia" and "kenya" are two names for it
    // and both stand under "k". Core de-duplicates on `key` too and would keep
    // the better of them, but not before the worse one had taken a slot here —
    // and a slot spent twice on Kenya is a place the user never sees.
    const seen = top.findIndex((e) => e.key === entry.key);
    if (seen !== -1) {
      if (!outranks(entry, score, top[seen] as Entry, scores[seen] as number)) return;
      top.splice(seen, 1);
      scores.splice(seen, 1);
    } else if (
      top.length === limit &&
      !outranks(entry, score, top[limit - 1] as Entry, scores[limit - 1] as number)
    ) {
      return;
    }

    let i = top.length;
    top.push(entry);
    scores.push(score);
    while (
      i > 0 &&
      outranks(entry, score, top[i - 1] as Entry, scores[i - 1] as number)
    ) {
      top[i] = top[i - 1] as Entry;
      scores[i] = scores[i - 1] as number;
      i -= 1;
    }
    top[i] = entry;
    scores[i] = score;

    if (top.length > limit) {
      top.pop();
      scores.pop();
    }
    // Falls back when a duplicate leaves the list, which only ever prunes less.
    floor =
      top.length === limit ? (scores[limit - 1] as number) : Number.NEGATIVE_INFINITY;
  };

  const walk = (at: PrefixNode, exact: boolean): void => {
    const here = at.here;
    if (here !== undefined) {
      for (const entry of here) {
        // The bonus core would give this row anyway, applied early so that the
        // row it will rank first is not the row this file drops for being one
        // character longer than a heavier rival: "beni" is a city of the Congo
        // and "benin" is a country, and on weight alone the country leads.
        // Only the node the descent stopped at can hold an exact match.
        const score = exact ? entry.weight + EXACT_BONUS : entry.rank;
        if (!exact && top.length === limit && score < floor) break;
        offer(entry, score);
      }
    }
    for (const kid of at.kids) {
      if (top.length === limit && kid.ceiling < floor) break;
      walk(kid, false);
    }
  };

  walk(node, true);

  // Two places of one name stay two rows here. Ukraine has two Kyivskyi and the
  // US has three Springfields, and they are different places — a picker asking
  // this function directly wants all of them, and `key` is what tells them
  // apart. Core collapses rows that would *insert* the same string, because a
  // list of completions is a list of insertions; that is a display question and
  // it is answered where the display list is built.
  return top.map((entry) => ({
    text: entry.text,
    alias: entry.alias,
    unit: entry.unit,
    weight: entry.weight,
    key: entry.key,
    start,
  }));
}

/** How many words in front of the fragment a name may reach back over. */
const MAX_LOOKBACK = 3;

/**
 * The fragment, then the fragment with one preceding word, then two, then
 * three — longest first, and each one folded the way core folds a fragment so
 * the trie sees the same shape either way.
 *
 * Bounded at three because the matcher bounds a claim at four words, and the two
 * have to agree: offering a name that the matcher would then refuse to read back
 * is a completion that breaks the expression it completed.
 */
function searches(ctx: CompleteCtx): readonly { text: string; start: number }[] {
  const out = [{ text: ctx.fragment, start: ctx.span.start }];
  let at = ctx.span.start;

  for (let n = 0; n < MAX_LOOKBACK; n += 1) {
    let end = at;
    while (end > 0 && ctx.input[end - 1] === " ") end -= 1;
    if (end === at || end === 0) break;
    let begin = end;
    while (begin > 0 && ctx.input[begin - 1] !== " ") begin -= 1;
    at = begin;
    out.push({
      text: ctx.input
        .slice(begin, ctx.span.end)
        .normalize("NFKC")
        .toLocaleLowerCase(ctx.locale)
        .replace(/\s+/g, " "),
      start: begin,
    });
  }

  return out.reverse();
}

/**
 * Memoized on the identity of the tables, which are module constants, so it dies
 * with them and two engines built from `CITIES` share one trie.
 *
 * Built on the first keystroke and not in the constructor. `definePlace()` runs
 * at import time — `place` is a module-level constant — and a 45,000-node trie
 * is not something a consumer who never completes anything should pay for. A
 * lazy field on the instance was the alternative: instances are frozen, and
 * `withLimit` could not then share the built index without bypassing the
 * constructor to hand the cell over.
 */
const INDEXES = new WeakMap<object, WeakMap<object, PlaceIndex>>();

function indexFor(
  countries: readonly CountryRow[],
  cities: readonly CityRow[],
): PlaceIndex {
  let byCities = INDEXES.get(countries);
  if (byCities === undefined) {
    byCities = new WeakMap();
    INDEXES.set(countries, byCities);
  }

  let index = byCities.get(cities);
  if (index === undefined) {
    index = createPlaceIndex(countries, cities);
    byCities.set(cities, index);
  }
  return index;
}

/**
 * What a kind registers to complete places. The call site is `place.ts`:
 *
 *     completions: new PlaceCompleter(COUNTRIES, opts.cities).completions,
 *
 * so the tier is decided the same way it is for the matcher — by whether the
 * gazetteer was handed over — and `definePlace()` with no options completes
 * countries and not one city.
 *
 * `completions` is a bound field rather than a method because that is the name
 * the `Kind` gives it, and a door you can hand over whole is worth more than one
 * the call site has to wrap in an arrow to keep its `this`.
 */
export class PlaceCompleter {
  /** Rows offered per keystroke, before core merges and cuts. */
  readonly limit: number;
  readonly completions: Completer;

  readonly #countries: readonly CountryRow[];
  readonly #cities: readonly CityRow[];

  /**
   * `limit` is here so that `withLimit` has something to hand to, and reads
   * worse than it does: prefer `new PlaceCompleter(COUNTRIES, CITIES).withLimit(5)`.
   */
  constructor(
    countries: readonly CountryRow[],
    cities: readonly CityRow[] = NO_CITIES,
    limit: number = DEFAULT_LIMIT,
  ) {
    this.#countries = countries;
    this.#cities = cities;
    this.limit = limit;
    this.completions = (ctx) => completePlaces(indexFor(countries, cities), ctx, limit);
    Object.freeze(this);
  }

  /** A new completer over the same index — which is why this is not expensive. */
  withLimit(limit: number): PlaceCompleter {
    return new PlaceCompleter(this.#countries, this.#cities, limit);
  }
}
