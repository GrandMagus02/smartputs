import type { AggregateFn, CompareOp } from "./ir";

/**
 * The clause words, as data.
 *
 * A locale rather than a set of constants for the reason core's `Locale` is
 * one: the grammar these words drive is the same in every language this package
 * will ever support, and the words are the only part that changes. A second
 * language is a second object, not a second parser.
 *
 * Every field is a list of *phrases*, matched longest-first, so "greater than"
 * beats "greater" without either of them needing to know the other exists.
 */
export interface QueryVocabulary {
  readonly id: string;
  readonly where: readonly string[];
  readonly and: readonly string[];
  readonly or: readonly string[];
  readonly not: readonly string[];
  readonly groupBy: readonly string[];
  readonly orderBy: readonly string[];
  readonly ascending: readonly string[];
  readonly descending: readonly string[];
  readonly top: readonly string[];
  readonly limit: readonly string[];
  readonly between: readonly string[];
  readonly is: readonly string[];
  readonly isNot: readonly string[];
  readonly empty: readonly string[];
  readonly within: readonly string[];
  readonly of: readonly string[];
  readonly distinct: readonly string[];
  /**
   * Containment. One word doing three jobs, resolved by what the operand turns
   * out to be: a range becomes `between`, a list becomes `IN`, anything else
   * becomes equality. Three separate words would push that choice onto the user,
   * who has no way to know which one the schema wants.
   */
  readonly contains: readonly string[];
  /**
   * Words that introduce an operand and mean nothing else — "from ukraine",
   * "to poland". Dropped before the operand is read, because the engine has no
   * reading for "from kyiv" and a very good one for "kyiv".
   */
  readonly prepositions: readonly string[];
  readonly comparisons: Readonly<Record<string, CompareOp>>;
  readonly aggregates: Readonly<Record<string, AggregateFn>>;
}

/**
 * English.
 *
 * The comparison table is where most of the language lives, and it is
 * deliberately generous about dimension-specific comparatives — "heavier than",
 * "longer than", "newer than" — because they cost one row each and they are what
 * people actually type. They carry no dimension of their own: `heavier than 2
 * kg` and `more than 2 kg` produce the same predicate, and the kilogram is what
 * makes it about mass. Teaching the words to check dimensions would be a second
 * type system beside the one the engine already runs.
 *
 * "over" and "under" are here despite `over` being a division keyword in core's
 * English locale. There is no conflict to resolve: this parser owns the clause
 * layer and core never sees the word — a fragment reaching `engine.suggest()`
 * has already had its comparison operator removed.
 */
export const queryEn: QueryVocabulary = {
  id: "en",
  where: ["where", "with", "having", "that have", "who have", "which have"],
  // No comma. It was here as a second spelling of `and` and it cost the list
  // form its separator: `status in pending, paid, shipped` split into three
  // conjuncts, and the second and third read as columns that do not exist. One
  // punctuation mark cannot be both a conjunction and a list separator, and the
  // list is the one that has no other spelling.
  and: ["and", "&&"],
  or: ["or", "||"],
  not: ["not", "without"],
  groupBy: ["group by", "grouped by", "per", "by"],
  orderBy: ["order by", "ordered by", "sorted by", "sort by", "sorted"],
  ascending: ["ascending", "asc", "lowest first", "smallest first"],
  descending: ["descending", "desc", "highest first", "largest first"],
  // "biggest" and "highest" are deliberately absent, though they read as `top`
  // in "biggest order last week". They are already `max` in `aggregates`, and a
  // word in both tables would be decided by whichever lookup ran first — which
  // is how a grammar acquires a rule nobody can state. `top` is unambiguous and
  // the superlatives keep their aggregate meaning.
  top: ["top"],
  limit: ["limit", "first"],
  between: ["between"],
  is: ["is", "are", "equals", "equal to", "was"],
  isNot: ["is not", "isn't", "are not", "aren't", "was not", "wasn't"],
  empty: ["null", "empty", "missing", "unset"],
  within: ["within", "inside"],
  of: ["of"],
  distinct: ["distinct", "unique"],
  contains: ["in", "during"],
  // No "with" and no "on": the first is a `where` word here and the second is a
  // containment word, and a phrase in two tables is a rule nobody can state.
  prepositions: ["from", "to", "at", "for", "into", "toward"],
  comparisons: {
    ">": ">",
    over: ">",
    above: ">",
    after: ">",
    "more than": ">",
    "greater than": ">",
    "larger than": ">",
    "bigger than": ">",
    "heavier than": ">",
    "longer than": ">",
    "newer than": ">",
    "<": "<",
    under: "<",
    below: "<",
    before: "<",
    "less than": "<",
    "fewer than": "<",
    "smaller than": "<",
    "lighter than": "<",
    "shorter than": "<",
    "older than": "<",
    ">=": ">=",
    "≥": ">=",
    "at least": ">=",
    "no less than": ">=",
    "<=": "<=",
    "≤": "<=",
    "at most": "<=",
    "up to": "<=",
    "no more than": "<=",
    "=": "=",
    "==": "=",
    "!=": "!=",
    "<>": "!=",
    "≠": "!=",
    "not equal to": "!=",
    contains: "contains",
    containing: "contains",
    like: "contains",
    "starts with": "startsWith",
    "starting with": "startsWith",
    "begins with": "startsWith",
    "beginning with": "startsWith",
    "ends with": "endsWith",
    "ending with": "endsWith",
  },
  aggregates: {
    count: "count",
    "number of": "count",
    "how many": "count",
    sum: "sum",
    total: "sum",
    "sum of": "sum",
    "total of": "sum",
    average: "avg",
    avg: "avg",
    mean: "avg",
    "average of": "avg",
    min: "min",
    minimum: "min",
    smallest: "min",
    lowest: "min",
    max: "max",
    maximum: "max",
    largest: "max",
    highest: "max",
    biggest: "max",
  },
};

/** Longest phrase in any vocabulary field, in words. Bounds the parser's scan. */
export const MAX_PHRASE_WORDS = 3;
