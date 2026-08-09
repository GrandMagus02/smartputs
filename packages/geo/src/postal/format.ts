import type { MatchCtx } from "@smartput/core";
import { createPostalLiteral } from "./literal";
import type { PostalCountry } from "../kind/types";

/**
 * Spec §10, M6.4: postal format validation and normalization — the question
 * `literal.ts` answers while parsing, asked directly.
 *
 * **Which layer to reach for.** `PostalFormat` is the door. `PostalFormat.of(row)`
 * hands back a frozen instance that knows one country's format, and `validate`,
 * `normalize` and `shape` are what a form field, a CSV importer or an address
 * book actually want. `PostalFormats` is that door with a table behind it, so
 * `POSTAL_FORMATS.for("GB")` — `@smartput/country`'s, over the shipped
 * gazetteer — is the shortest path to one. Reach past both to `postalAccepts` /
 * `normalizePostal` only when you already hold the row, and to `isBacktrackRisk`
 * only if you are screening patterns of your own.
 *
 * **There is exactly one definition of "a valid GB postcode" in this package and
 * it is not in this file.** Everything here routes through the literal matcher
 * `literal.ts` builds, so the de-anchoring, the case-insensitivity and the
 * empty-pattern guard in that file's `compile` are the only reading of
 * `PostalCountry.postalRegex` there is. Re-spelling `compile` here was the obvious
 * alternative and is the defect this file exists to avoid: GeoNames' column is
 * irregular enough — Canada's trailing space, Ireland's missing `$`, the United
 * Kingdom's `^A|B$` — that two spellings would disagree within a release, and
 * the one that disagrees silently is the parser's.
 *
 * `literal.ts` does not export `compile`, so the reuse is by *driving* the
 * matcher rather than by calling into it: one country per matcher, its aliases
 * stripped, the code offered as the entire input. Stripping the aliases is what
 * makes the answer a format decision and not a phrase decision — with them,
 * `literal.ts`'s qualifier branch reads "de 12345" as Germany's `12345` and would
 * report a bare country code as part of a valid German postcode. What survives
 * the stripping is precisely `compile(row.postalRegex).test(code)`, verified
 * against the raw column for all 178 formats in the tests beside this.
 *
 * **What this file does decide**, because `literal.ts` has no opinion on it: where
 * the separator goes. See `normalizePostal`.
 */

/**
 * Refused before any pattern is offered a character.
 *
 * The longest code any shipped format can match is Portugal's, at 34
 * (`\d{4}-\d{3}\s?[a-zA-Z]{0,25}`), so nothing real is turned away. The point is
 * the untrusted-pattern one: backtracking cost is a function of input length, so
 * an unbounded input is the difference between a slow regex and a hung process.
 * A cap plus `isBacktrackRisk` below is the whole mitigation, and the honest
 * limit of it is stated there.
 */
export const MAX_CODE_LENGTH = 40;

/**
 * True when `pattern` has the shape catastrophic backtracking needs: an
 * unbounded quantifier applied to a group that itself contains a quantifier or
 * an alternation. `(a+)+`, `(?:a|aa)+`.
 *
 * `PostalCountry.postalRegex` is vendored data. It is regenerated from
 * countryInfo.txt by a script, so it is not user input, but it is not *this
 * package's* code either and a regeneration can change it without anyone reading
 * the diff — 252 rows of regex is exactly the diff nobody reads. A pattern that
 * takes exponential time is then a hang in whatever process calls `evaluate`,
 * and JavaScript has no regex timeout to fall back on.
 *
 * Deliberately conservative and deliberately structural: it screens the pattern
 * for a *shape*, and never asks what the pattern matches — that question has one
 * answer in this package and it belongs to `literal.ts`. All 178 shipped formats
 * pass, which the tests assert, so the screen is not quietly deleting countries.
 *
 * **What it does not buy.** It is a heuristic over the two shapes that account
 * for essentially every reported ReDoS, not a proof, and the length cap bounds
 * the work rather than eliminating it. A pattern that is exponential in some
 * third way still costs 2^40 in the worst case. The real defence against that is
 * that a format reaching here has been through the generator and the body hash;
 * this is the second line, sized accordingly. Rejected alternative: running the
 * match on a worker with a deadline, which turns a synchronous `evaluate()` into
 * an async one for a risk the vendored table does not currently carry.
 */
export function isBacktrackRisk(pattern: string): boolean {
  const quantified: string[] = [];
  const open: number[] = [];
  let inClass = false;

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (inClass) {
      if (ch === "]") inClass = false;
      continue;
    }
    if (ch === "[") {
      inClass = true;
      continue;
    }
    if (ch === "(") {
      open.push(i);
      continue;
    }
    if (ch !== ")") continue;

    const start = open.pop();
    // `?` and `{n,m}` are bounded, so the outer quantifier has to be one that
    // can repeat without limit for the inner one to multiply against it.
    if (start !== undefined && /^(?:[*+]|\{\d+,\})/.test(pattern.slice(i + 1)))
      quantified.push(pattern.slice(start + 1, i));
  }

  return quantified.some((body) => {
    // `?:` is the group flavour and not part of what it matches; every other
    // `(?…)` prefix keeps its `?` and trips the test, which is the safe way for
    // a screen this conservative to be wrong.
    const inner = (body.startsWith("?:") ? body.slice(2) : body).replace(/\\./g, "");
    return /[*+?|]/.test(inner) || /\{\d/.test(inner);
  });
}

/**
 * Everything a `LiteralMatcher` may read, with the two fields that matter here
 * pinned to a constant.
 *
 * `now` and `timeZone` are unread by the postal matcher — a postcode is not a
 * date — and `isUnitAlias` is answered `false` on purpose rather than wired to a
 * registry. `literal.ts` asks it to decide whether claiming a span would take a
 * *unit* away from the expression around it, which is a question about a
 * sentence; there is no sentence here, only a code, so "is `1234 kg` a Kerkrade
 * postcode" is yes in this file and no in the parser, and both are right.
 */
const CODE_CTX: MatchCtx = Object.freeze({
  locale: "en",
  now: 0,
  timeZone: "UTC",
  isUnitAlias: () => false,
});

/**
 * One matcher per row, built on first use.
 *
 * Keyed by the row object so a `definePlace()` table pays for its rows and the
 * shipped table pays for the countries anyone actually asks about — 178 matchers
 * eagerly is 178 regex compiles for the one format a caller wanted. `null` marks
 * a row with no usable format, so the miss is cached too.
 */
const testers = new WeakMap<PostalCountry, ((code: string) => boolean) | null>();

function testerFor(row: PostalCountry): ((code: string) => boolean) | null {
  const cached = testers.get(row);
  if (cached !== undefined) return cached;

  const tester = buildTester(row);
  testers.set(row, tester);
  return tester;
}

function buildTester(row: PostalCountry): ((code: string) => boolean) | null {
  // Emptiness, which is a fact about the string and not a reading of the
  // pattern, so it stays on this side of the line the header draws. The two
  // other ways `literal.ts`'s `compile` gives up — the pattern does not compile,
  // or it matches the empty string — cannot be detected from out here without
  // re-spelling `compile`, and a row in that state gets an instance whose
  // `validate` is false for everything rather than no instance at all. No
  // shipped row is in it, which the tests assert against the raw column so that
  // a regeneration that introduces one says so.
  if (row.postalRegex.trim() === "") return null;
  if (isBacktrackRisk(row.postalRegex)) return null;

  // Aliases stripped for the header's reason, and a single-row table so that the
  // digits-only branch — which keeps one country out of the sixty that accept
  // five digits — keeps this one.
  const match = createPostalLiteral([{ ...row, aliases: [] }]);

  return (code: string): boolean => {
    if (code.length === 0 || code.length > MAX_CODE_LENGTH) return false;
    const claimed = match(code, 0, CODE_CTX);
    if (claimed === null) return false;
    // Length, not merely "something was claimed": the matcher walks longest-span
    // first and falls back to a shorter one, so a code with a valid prefix and
    // trailing rubbish comes back as a claim over the prefix.
    return (Array.isArray(claimed) ? claimed : [claimed]).some(
      (r) => r.unit === row.a2 && r.length === code.length,
    );
  };
}

/**
 * Whether the country's format accepts `code` exactly as written — no case
 * folding, no separator repair. The strict question, and the one `normalize`
 * asks over and over.
 *
 * `false` for a country with no postal system, and for one whose pattern the
 * screen refused: a format that cannot be trusted accepts nothing rather than
 * everything, which is the direction a wrong answer here should fail in.
 *
 * One divergence from the raw column, inherited rather than chosen: a code
 * `literal.ts`'s tokenizer cannot walk — three or more words, or a character that
 * is neither a letter, a digit, nor a `-` between two of those — is refused even
 * where the pattern would take it. No shipped format reaches it. It is also the
 * more useful answer of the two: "valid" here means the engine would read this
 * as your country's code, and a code the engine cannot read is not one.
 */
export function postalAccepts(row: PostalCountry, code: string): boolean {
  return testerFor(row)?.(code) ?? false;
}

/** Space and hyphen, the only two separators any shipped format contains. */
const SEPARATORS = /[\s-]+/g;

/**
 * The canonical spelling of `code` for `row`, or `null` when no spelling of it
 * is valid.
 *
 * **Normalization is not one rule and this file does not contain the four.**
 * `SW1A1AA` → `SW1A 1AA`, `m5v3l9` → `M5V 3L9`, `1234ab` → `1234 AB` and
 * `902101234` → `90210-1234` are four different rules, and a table of them would
 * be the second reading of the column the header refuses. So the placement is
 * *searched* instead: strip every separator, then offer the country's own format
 * each single-separator reinsertion until one is accepted. The format already
 * knows where its separator goes — Japan's `\d{3}-\d{4}$` admits exactly one
 * hyphen position — and asking it is how that knowledge stays in one place.
 *
 * The order is: the code as given if it is already separated and valid, then
 * spaces left to right, then hyphens left to right, then the bare core. Keeping
 * a valid separated code as written is what makes `1234-567 LISBOA` survive; a
 * single reinsertion cannot rebuild a two-separator code, and Portugal's is the
 * only shipped format that has one, so `1234567LISBOA` normalizes to
 * `1234-567LISBOA` and the tests say so. Leftmost-first because a format's
 * separator sits where an earlier group ends, and the earlier groups are the
 * ones the pattern pins: across every country and every probe, no other position
 * was ever also valid.
 *
 * Upper-cased throughout, which is the canonical form for every postal
 * administration that uses letters at all. Portugal's optional trailing locality
 * is upper-cased with the rest of it — the alternative is a per-country casing
 * table, which is the table this function exists not to have.
 *
 * The search costs at most `2·(n-1)+2` accepts, `n` bounded by
 * `MAX_CODE_LENGTH`, so 80 regex tests on strings of 41 characters is the
 * ceiling for the worst input anyone can hand it.
 */
export function normalizePostal(row: PostalCountry, code: string): string | null {
  const accepts = testerFor(row);
  if (accepts === null) return null;

  const given = code.trim().replace(/\s+/g, " ").toUpperCase();
  if (given.length === 0 || given.length > MAX_CODE_LENGTH) return null;

  const core = given.replace(SEPARATORS, "");
  if (core.length === 0) return null;

  if (given !== core && accepts(given)) return given;

  for (const sep of [" ", "-"]) {
    for (let at = 1; at < core.length; at += 1) {
      const candidate = `${core.slice(0, at)}${sep}${core.slice(at)}`;
      if (accepts(candidate)) return candidate;
    }
  }

  return accepts(core) ? core : null;
}

/**
 * A code's shape: `@` for a letter, `#` for a digit, everything else verbatim.
 * `SW1A 1AA` is `@@#@ #@@`.
 *
 * This is the shape of one *code*, not of a country's format, and the difference
 * is the one deviation from M6.4's brief worth naming. The brief expected a
 * `pattern` field carrying countryInfo.txt's column 13 — GeoNames' own `@# #@@`
 * string — and that column is not generated: `scripts/geo/build.ts` takes column
 * 14, the regex, and `PostalCountry` has no field for the other one. Deriving a
 * country-wide mask from the regex would mean reading the pattern for a second
 * purpose, which is what this file refuses everywhere else; carrying the real
 * column means a generator change, a new `PostalCountry` field and a new body hash,
 * none of which are this task's files. So the honest thing that is available is
 * the mask of a code that already validated, and `PostalFormat.shape` is how a
 * caller gets one.
 */
export function postalShape(code: string): string {
  let out = "";
  for (const ch of code) {
    if (ch >= "0" && ch <= "9") out += "#";
    else if (/[A-Za-z]/.test(ch)) out += "@";
    else out += ch;
  }
  return out;
}

/** Keyed by row rather than by code so `of()` and `for()` share one instance. */
const instances = new WeakMap<PostalCountry, PostalFormat>();

/**
 * One country's postal format, as something you can hold.
 *
 * ```ts
 * import { POSTAL_FORMATS } from "@smartput/country";
 *
 * const gb = POSTAL_FORMATS.for("GB");
 * gb?.validate("sw1a1aa");     // true
 * gb?.normalize("sw1a1aa");    // "SW1A 1AA"
 * POSTAL_FORMATS.for("AQ");    // null — Antarctica has no postal system
 * ```
 *
 * Frozen, and every method returns a new value rather than mutating one. There
 * is no public constructor: a `PostalFormat` for a country with no usable format
 * is a format that accepts nothing, which is a worse thing to hand a caller than
 * `null` — they check once at the door instead of discovering it a hundred codes
 * later — so `of` is the only way in and it may refuse.
 *
 * Reaching one *by code* takes a table, and this package ships none: the
 * gazetteer is `@smartput/country`'s, and a postal format is a fact about a row
 * rather than about a two-letter string. `PostalFormats` below is that lookup,
 * and `@smartput/country` exports it bound to `COUNTRIES` as `POSTAL_FORMATS`.
 */
export class PostalFormat {
  /** ISO 3166-1 alpha-2, uppercase — the form a caller passes to `for`. */
  readonly country: string;
  /**
   * GeoNames' pattern, verbatim as `PostalCountry.postalRegex` carries it.
   *
   * Exposed because a caller wiring an HTML `pattern=` attribute or a server-side
   * check in another language needs the source and not this class, and because
   * "which of my 178 formats is that" is otherwise unanswerable from outside.
   * Not compiled and not de-anchored: it is the column, and it is `literal.ts`'s
   * job to say what it means.
   */
  readonly source: string;

  readonly #row: PostalCountry;

  private constructor(row: PostalCountry) {
    this.#row = row;
    this.country = row.a2.toUpperCase();
    this.source = row.postalRegex;
    Object.freeze(this);
  }

  /**
   * The door: a row you brought — a `definePlace()` table, a row off a provider,
   * a country out of `COUNTRIES`.
   *
   * `null` when the row has no usable postal format — 74 of the shipped 252,
   * Antarctica and Tonga and the Cayman Islands among them, where GeoNames'
   * column is empty because there is nothing to put in it. Ireland is *not* one
   * of them and is the near miss worth knowing: the Eircode has been in the
   * column since 2015, so `IE` is a format and `D02 AF30` validates.
   *
   * The same instance comes back for the same row, which is what makes the
   * matcher behind it worth caching.
   */
  static of(row: PostalCountry): PostalFormat | null {
    if (testerFor(row) === null) return null;
    const held = instances.get(row);
    if (held !== undefined) return held;
    const made = new PostalFormat(row);
    instances.set(row, made);
    return made;
  }

  /**
   * Whether `code` is a postal code of this country — as written, or after the
   * case and separator repair `normalize` performs.
   *
   * Defined as `normalize(code) !== null` rather than as a strict match, so that
   * the two never disagree in a form: `validate("902101234")` is `true` and
   * `normalize` turns it into `90210-1234`, and a field that accepted the code
   * then failed to canonicalize it would be the worse of the two answers. The
   * strict question is `postalAccepts(row, code)` in the layer underneath.
   */
  validate(code: string): boolean {
    return normalizePostal(this.#row, code) !== null;
  }

  /** Canonical spacing and case, or `null` when no spelling of `code` is valid. */
  normalize(code: string): string | null {
    return normalizePostal(this.#row, code);
  }

  /**
   * The normalized code's shape — `"SW1A 1AA"` and `"sw1a1aa"` both give
   * `"@@#@ #@@"` — or `null` when the code is not valid here. See `postalShape`
   * for why this is a code's shape rather than the country's format string.
   */
  shape(code: string): string | null {
    const normalized = normalizePostal(this.#row, code);
    return normalized === null ? null : postalShape(normalized);
  }
}

/**
 * A table of countries, asked for one country's format by code.
 *
 * The lookup half of `PostalFormat`, split off because it is the half that needs
 * data: `of` works on any row, `for` needs to know which rows exist. Holding the
 * table as an instance rather than baking one in is what lets this package ship
 * no gazetteer — `@smartput/country` exports `POSTAL_FORMATS`, and a consumer
 * with its own table builds its own.
 *
 * ```ts
 * const formats = new PostalFormats(COUNTRIES);
 * formats.for("GB")?.normalize("sw1a1aa"); // "SW1A 1AA"
 * ```
 *
 * The index is built in the constructor and the instances behind it are still
 * `PostalFormat`'s per-row cache, so two tables over the same rows hand back the
 * same formats.
 */
export class PostalFormats {
  readonly #byCode: Map<string, PostalCountry>;

  constructor(rows: readonly PostalCountry[]) {
    this.#byCode = new Map();
    // Alpha-3 second and never overwriting: no shipped alpha-3 collides with an
    // alpha-2, but a hand-built table is not the shipped one, and a country
    // losing its own two-letter code to somebody else's three is the failure
    // that would be hardest to see.
    for (const row of rows) this.#byCode.set(row.a2, row);
    for (const row of rows) if (!this.#byCode.has(row.a3)) this.#byCode.set(row.a3, row);
    Object.freeze(this);
  }

  /** The row itself, by alpha-2 or alpha-3 in any case. `null` when unknown. */
  row(country: string): PostalCountry | null {
    return this.#byCode.get(country.trim().toLowerCase()) ?? null;
  }

  /**
   * By ISO 3166-1 alpha-2 or alpha-3, in any case. `null` when the code names no
   * row in this table, and when the row it names has no usable format — see
   * `PostalFormat.of`, which this defers to for the second question.
   */
  for(country: string): PostalFormat | null {
    const row = this.row(country);
    return row === null ? null : PostalFormat.of(row);
  }
}
