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
  /**
   * Determiners and imperative verbs that open a request without naming
   * anything — "all customers", "show me the orders", "which orders". Stripped
   * only at the very front of the input, before the first table or column word
   * binds, the same restriction `prepositions` lives under: a schema may
   * declare a column named `all`, and `status is any` is a legal `values`
   * match, so this can never be a filter applied everywhere the word appears.
   */
  readonly leading: readonly string[];
  /**
   * Politeness at the tail — "customers from ukraine please". Stripped once
   * from the end of the input for the same reason `leading` is stripped only
   * from the front: dropped anywhere else, "please" would be free to swallow
   * whatever operand precedes it.
   */
  readonly trailing: readonly string[];
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
  // Exactly the words a person opens a request with and nothing more: no
  // "each"/"every order" reading beyond "every" itself, no synonyms of "show"
  // ("display", "list out") that nobody types first. Each one costs one row in
  // an ambiguity nobody can resolve if it grows past what people actually type.
  leading: [
    "all",
    "the",
    "any",
    "every",
    "show me",
    "show",
    "list",
    "get",
    "find",
    "select",
    "give me",
    "which",
  ],
  // "please" is the one politeness word people actually type at the end of a
  // typed search. Anything more would be guessing at manners nobody asked for.
  trailing: ["please"],
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

/**
 * Ukrainian.
 *
 * A first draft, not a native speaker's pass — worth review before anyone
 * ships it. Two things don't map 1:1 onto English and are handled explicitly
 * rather than papered over:
 *
 * - No article. `leading` has no entry for "the" because Ukrainian has none to
 *   translate; the English list's "the" simply has no counterpart here.
 * - `of` is thin. Ukrainian mostly expresses "of" through the genitive case
 *   ending on the noun itself ("сума замовлень", not a word meaning "of"
 *   sitting between "sum" and "orders"), so `of` carries only the one word
 *   this grammar actually needs a preposition for — "within 50 km *of*
 *   kyiv" — and nothing for the aggregate phrasing, which needs none.
 *
 * `comparisons` sticks to the operators every dialect needs and skips
 * English's niche dimension comparatives ("heavier than", "newer than"):
 * those are exactly the entries most likely to read wrong without native
 * review, and their absence costs nothing — "більше ніж 2 кг" still reaches
 * `>` through the generic comparator.
 */
export const queryUk: QueryVocabulary = {
  id: "uk",
  where: ["де", "у яких", "що мають"],
  and: ["і", "та", "&&"],
  or: ["або", "чи", "||"],
  not: ["не", "без"],
  // "за" is the single-word form and does groupBy's double duty exactly as
  // English's "by" does — the ranking expression after "топ N" and the
  // grouping column everywhere else, told apart the same way: a pending flag,
  // not a second word.
  groupBy: ["згруповано за", "групувати за", "за"],
  orderBy: ["сортувати за", "відсортовано за", "упорядковано за", "відсортовано"],
  ascending: ["за зростанням", "зростання", "від найменшого"],
  descending: ["за спаданням", "спадання", "від найбільшого"],
  top: ["топ"],
  limit: ["ліміт", "перші"],
  between: ["між"],
  is: ["є", "дорівнює", "було"],
  isNot: ["не є", "не дорівнює", "не було"],
  empty: ["порожньо", "невідомо", "не вказано"],
  within: ["в межах", "у межах"],
  of: ["від"],
  distinct: ["унікальні", "різні"],
  contains: ["під час"],
  // "з" is the one that matters most: it is what "клієнти з України" leans
  // on, the exact Ukrainian counterpart of "customers from ukraine".
  prepositions: ["з", "до", "у", "для"],
  leading: [
    "усі",
    "будь-які",
    "покажи мені",
    "покажи",
    "перелічи",
    "отримати",
    "знайти",
    "вибрати",
    "дай мені",
    "які",
  ],
  trailing: ["будь ласка"],
  comparisons: {
    ">": ">",
    більше: ">",
    понад: ">",
    "більше ніж": ">",
    "<": "<",
    менше: "<",
    "менше ніж": "<",
    ">=": ">=",
    "не менше ніж": ">=",
    "<=": "<=",
    "не більше ніж": "<=",
    "=": "=",
    "==": "=",
    "!=": "!=",
    "<>": "!=",
    "не дорівнює": "!=",
    містить: "contains",
    "починається з": "startsWith",
    "закінчується на": "endsWith",
  },
  aggregates: {
    кількість: "count",
    скільки: "count",
    сума: "sum",
    "загальна сума": "sum",
    середнє: "avg",
    "середнє значення": "avg",
    мінімум: "min",
    найменше: "min",
    максимум: "max",
    найбільше: "max",
  },
};

/** Longest phrase in any vocabulary field, in words. Bounds the parser's scan. */
export const MAX_PHRASE_WORDS = 3;
