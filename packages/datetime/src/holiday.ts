import type { Kind, LiteralMatcher, MatchCtx } from "@smartput/core";
import {
  type FindHolidayOptions,
  findHoliday,
  type HolidayMatch,
  type HolidayPlace,
  type HolidayType,
} from "@smartput/holiday";
import { accepts, parseDateTime } from "./chrono-bridge";
import { createDatetime } from "./datetime";
import { Temporal } from "./temporal";
import { DATETIME_KIND, wrap } from "./value";

/**
 * The opt-in half of this package: "next easter", "day before christmas",
 * "closest bank holiday". The only module in the repo that imports both
 * `@smartput/datetime` and `@smartput/holiday`, and it is a subpath so that
 * importing `@smartput/datetime` never reaches `date-holidays` — a 768 KB rule
 * table nobody typing "today + 3 d" asked to download.
 *
 * **Why the matcher owns the offset grammar and core takes no change.** "day
 * before christmas" could be `christmas - 1 d` if `before` were an `OpSymbol`,
 * and the repo has just paid that price once for `off | percent | K` on the
 * grounds that it "earned it by not being an alias for anything". This has not
 * earned it: a `LiteralMatcher` may already claim any span it likes and return a
 * finished value, which is exactly how "next friday" works today through chrono.
 * An `OpSymbol` for a phrase one plugin can claim would put date vocabulary into
 * the Pratt parser, which is the thing M4 exists to prove unnecessary.
 *
 * **One reading, never several.** The comment above `dateLiteral` in
 * `datetime.ts` gives the reason and it applies here unchanged: a place name has
 * homonyms and a date does not. When `findHoliday` ranks several occurrences
 * above `minScore`, the offset grammar picks exactly one of them and the rest
 * are gone. Not `targetable` either, for `dateLiteral`'s reason: "3pm in
 * christmas" is not a conversion.
 *
 * The grammar it claims:
 *
 * ```
 * phrase   := shift? selector? subject
 * shift    := count? durationWord ("before" | "after")
 * selector := "closest" | "nearest" | "next" | "last" | "this"
 * subject  := typeNoun | holidayName
 * typeNoun := typeWord? ("holiday" | "holidays")
 * typeWord := "public" | "bank" | "school" | "optional" | "observance"
 * count    := digits | "a" | "an"
 * durationWord := day(s) | week(s) | month(s) | year(s)
 * ```
 *
 * The plan left "day before next public holiday" — a shift *and* a selector over
 * a nameless subject — as support-or-refuse-cleanly. It is supported: the two
 * halves answer different questions ("which occurrence" and "how far from it"),
 * refusing the pair would mean the grammar could express each alone but not
 * both, and a user who can write "day before christmas" and "next public
 * holiday" will write their composition without expecting to be turned down.
 *
 * What is refused is a *stack* of shifts — `shift?`, not `shift*`. "day before 2
 * weeks after christmas" parses in principle and means nothing anyone types; one
 * shift keeps the claim's span bounded and the reading obvious.
 */
type Selector = "closest" | "next" | "last" | "this";

/**
 * "closest" and "nearest" are the same word here, and neither is a synonym for
 * "next": they take the smallest gap between `now` and the holiday's local
 * midnight (see `pick`) in *either* direction, so on the 26th of December
 * "closest holiday" reaches back to Christmas while "next holiday" walks forward
 * to New Year's Day.
 */
const SELECTORS: Record<string, Selector> = {
  closest: "closest",
  nearest: "closest",
  next: "next",
  last: "last",
  this: "this",
};

/**
 * Absent selector means `closest`, for both subject shapes. A bare "holiday" has
 * no other sensible reading, and a bare "christmas" typed in January means the
 * one three weeks behind rather than the one eleven months ahead — which is the
 * same rule, not a second one.
 */
const DEFAULT_SELECTOR: Selector = "closest";

const TYPE_WORDS: Record<string, HolidayType> = {
  public: "public",
  bank: "bank",
  school: "school",
  optional: "optional",
  observance: "observance",
};

const TYPE_NOUNS = new Set(["holiday", "holidays"]);

/**
 * Calendar units only, which is what makes the shift arithmetic go through
 * `Temporal` rather than through milliseconds: "3 weeks before christmas" across
 * a DST boundary is still midnight, and the plan's duration words happen to
 * contain nothing smaller than a day.
 */
type ShiftUnit = "days" | "weeks" | "months" | "years";

const DURATION_WORDS: Record<string, ShiftUnit> = {
  day: "days",
  days: "days",
  week: "weeks",
  weeks: "weeks",
  month: "months",
  months: "months",
  year: "years",
  years: "years",
};

const DIRECTIONS: Record<string, -1 | 1> = { before: -1, after: 1 };

/** `count := digits | "a" | "an"` — the wordy halves of it. */
const ARTICLES = new Set(["a", "an"]);

/**
 * Past this a shift is not a date question. `Temporal` throws a RangeError
 * somewhere beyond a hundred thousand years out, and a matcher that throws takes
 * the whole evaluation with it — refusing the count is the same answer as
 * refusing the phrase, and it is the one the fold knows how to handle.
 */
const MAX_COUNT = 10_000;

/** Longer than any phrase this grammar can produce, so the scanner stops early. */
const MAX_WORDS = 10;

/** "Martin Luther King Jr Day" is five, and nothing shipped is longer. */
const MAX_NAME_WORDS = 5;

/** `@smartput/country`'s `MIN_NAME_LENGTH`, borrowed with its argument — see `readName`. */
const MIN_NAME_LENGTH = 4;

/**
 * Generous on purpose, and it costs nothing: `findHoliday` sorts every candidate
 * that clears `minScore` before it slices, so a larger limit is a longer slice
 * of an array that was built either way. It has to hold every occurrence of one
 * type across the three-year window — a country with forty observances a year
 * would otherwise have its far end cut off, and "last observance holiday" would
 * answer with whatever survived the slice.
 */
const POOL_LIMIT = 512;

interface Word {
  text: string;
  /** Absolute index in the input, one past the last character. */
  end: number;
  letters: boolean;
}

/**
 * Words are letters, digits, or letters joined by an apostrophe — "new year's
 * day" is three words here and four tokens to the lexer, which is fine because
 * the fold only checks that the claim *ends* on a token boundary and "year's"
 * ends where the lexer's "s" ends. Splitting it instead would hand the scorer
 * "new year s day", and a stray "s" is a token the name has to cover.
 */
const WORD = /^[ \t]*(\p{L}+(?:['’]\p{L}+)*|\d+)/u;

function scan(input: string, offset: number): Word[] {
  const words: Word[] = [];
  let at = offset;
  while (words.length < MAX_WORDS) {
    const found = WORD.exec(input.slice(at));
    const text = found?.[1];
    if (found === null || text === undefined) break;
    at += found[0].length;
    words.push({ text: text.toLowerCase(), end: at, letters: !/^\d+$/.test(text) });
  }
  return words;
}

interface Shift {
  unit: ShiftUnit;
  /** Signed: negative for "before". */
  amount: number;
  next: number;
}

function readShift(words: readonly Word[], at: number): Shift | null {
  let i = at;
  let count = 1;

  const first = words[i];
  if (first === undefined) return null;
  if (!first.letters) {
    count = Number(first.text);
    if (!Number.isSafeInteger(count) || count > MAX_COUNT) return null;
    i += 1;
  } else if (ARTICLES.has(first.text)) {
    i += 1;
  }

  const unit = DURATION_WORDS[words[i]?.text ?? ""];
  if (unit === undefined) return null;
  const sign = DIRECTIONS[words[i + 1]?.text ?? ""];
  if (sign === undefined) return null;

  return { unit, amount: count * sign, next: i + 2 };
}

function readSelector(
  words: readonly Word[],
  at: number,
): { kind: Selector; next: number } | null {
  const kind = SELECTORS[words[at]?.text ?? ""];
  return kind === undefined ? null : { kind, next: at + 1 };
}

function readTypeNoun(
  words: readonly Word[],
  at: number,
): { type: HolidayType | undefined; next: number } | null {
  const type = TYPE_WORDS[words[at]?.text ?? ""];
  const nounAt = type === undefined ? at : at + 1;
  if (!TYPE_NOUNS.has(words[nounAt]?.text ?? "")) return null;
  return { type, next: nounAt + 1 };
}

interface Subject {
  /** Every occurrence the subject names, earliest first. */
  pool: HolidayMatch[];
  next: number;
}

const byStart = (a: HolidayMatch, b: HolidayMatch) => a.start - b.start;

/**
 * The words of a holiday's *name*, tokenised the way `scan` tokenises input so
 * the two can be compared: "New Year's Day" is `new`, `year's`, `day`, and
 * "Christmas Day (substitute day)" loses its brackets. See `verbatim`.
 */
const NAME_WORD = /\p{L}+(?:['’]\p{L}+)*|\d+/gu;

/** A curly apostrophe and a straight one are the same character to a name. */
const flatten = (word: string) => word.replace(/’/g, "'");

/**
 * Every word of `run` too short to survive the scorer's typo tolerance appears
 * *verbatim* in `name`.
 *
 * `MIN_NAME_LENGTH` used to gate the run rather than the words — only
 * single-word runs were held to it, on the theory that "two words agreeing by
 * accident is a different order of unlikely". They never had to agree by
 * accident: the score is an average over the whole name, so one word landing
 * exactly on "Day" carries whatever stands beside it over `minScore`.
 * `nameScore("may day", "Christmas Day")` is 0.765, and "pay day" and "dry day"
 * score the same, so the US engine answered all three with Christmas — and in
 * Britain, where a May holiday exists, "may day" answered Boxing Day.
 *
 * Verbatim rather than a second length gate, because a length gate cannot tell
 * the "day" of "christmas day" from the "may" of "may day": both are three
 * letters, and gating either would take the shipped names — "christmas day",
 * "new year's day", "christmas eve" — down with the junk. What separates them is
 * that one word is actually in the name and the other is an edit away from being
 * in it, and a word this short is precisely the one whose edits cannot be
 * trusted. Longer words keep the tolerance they were given: "chrismas" still
 * finds Christmas.
 */
function verbatim(run: readonly Word[], name: string): boolean {
  const tokens = new Set((name.toLowerCase().match(NAME_WORD) ?? []).map(flatten));
  return run.every(
    (w) => w.text.length >= MIN_NAME_LENGTH || tokens.has(flatten(w.text)),
  );
}

/**
 * A named subject, claimed greedily: runs are tried longest-first and a longer
 * run only loses to a strictly better `nameScore`, so "christmas day" beats
 * "christmas" (1.0 against 0.833) while "christmas in tokyo" — which scores
 * below `minScore` and is never a candidate — leaves "in tokyo" to the solver.
 *
 * The pool is every occurrence sharing the winner's canonical name, not the top
 * few: the selector below chooses among the *same* holiday's years, and a pool
 * cut by rank rather than by name would let "last christmas" answer with
 * Christmas Eve because it happened to outrank the year we wanted.
 */
function readName(
  words: readonly Word[],
  at: number,
  ctx: MatchCtx,
  place: HolidayPlace | undefined,
  search: FindHolidayOptions,
): Subject | null {
  let best: Subject | null = null;
  let bestScore = 0;

  for (let end = Math.min(at + MAX_NAME_WORDS, words.length); end > at; end -= 1) {
    const run = words.slice(at, end);
    // A holiday's name is words. Letting digits in would have "10" open a run in
    // "10 km + 5 km", which is three findHoliday calls to learn nothing.
    if (!run.every((w) => w.letters)) continue;
    const phrase = run.map((w) => w.text).join(" ");

    // `@smartput/country`'s figure, for its reason (`matcher.ts`'s
    // `MIN_NAME_LENGTH`): a name shorter than this is not a name, it is a word
    // that happens to be near one. The scorer's typo tolerance is a whole edit
    // on a three-letter word, which puts "may" 0.663 from "Christmas Day" and
    // "st" 0.778 from "St. Patrick's Day" — above `minScore` and nowhere near
    // what either user meant. Longer runs are held to the same figure per word
    // by `verbatim` below, which needs the match in hand; this is the half that
    // can be decided without paying for a lookup.
    if (run.length === 1 && phrase.length < MIN_NAME_LENGTH) continue;

    // A word this grammar reads as a duration is a duration, and one alone is
    // never a holiday's name. "year" scores 0.70 against "New Year's Day", and
    // `datetimeWithHolidays()` used to answer bare "year" — and "year + 1 day" —
    // with New Year's Day where plain `datetime` refuses the string outright.
    //
    // Not left to the accept-gate below, which is what the comment here used to
    // claim stopped it: `accepts` refuses a phrase whose every word is a
    // registered unit alias, and this repo has no `year` duration unit, so
    // `isUnitAlias("year")` is false and "year" went straight through. Spelling
    // the rule against `DURATION_WORDS` — the list this file already scans for
    // in "3 years after christmas" — also keeps the answer from flipping on the
    // day a `year` unit does get registered.
    if (run.length === 1 && DURATION_WORDS[phrase] !== undefined) continue;

    // The chrono bridge's accept-gate (plan ruling R4), reused rather than
    // rewritten: the literal fold is destructive, and "days" scores 0.75 against
    // "Christmas Day". Without this, claiming the "days" in "3 days + 2 days"
    // would delete the duration arithmetic before the solver ever ran. It covers
    // more than the line above — "min", "hrs", anything a kind registered — and
    // less, per "year". The shift prefix needs no such gate: it cannot stand
    // without a subject, so no bare quantity reaches here.
    if (!accepts(phrase, ctx.isUnitAlias)) continue;

    const matches = findHoliday({ name: phrase, now: ctx.now }, place, search);
    const top = matches[0];
    if (top === undefined) continue;
    if (!verbatim(run, top.name)) continue;
    if (best !== null && top.nameScore <= bestScore) continue;

    best = { pool: matches.filter((m) => m.name === top.name).sort(byStart), next: end };
    bestScore = top.nameScore;
  }

  return best;
}

function readSubject(
  words: readonly Word[],
  at: number,
  ctx: MatchCtx,
  place: HolidayPlace | undefined,
  search: FindHolidayOptions,
): Subject | null {
  const noun = readTypeNoun(words, at);
  if (noun === null) return readName(words, at, ctx, place, search);

  // No `name` at all, which is what makes this the nameless shape: every
  // surviving candidate scores 1 on the name half and the pool is the whole type
  // filter. An absent `type` is left absent rather than defaulted here —
  // `findHoliday` reads a nameless query with no type as `"public"`, and
  // spelling that default twice is how the two copies drift apart.
  const matches = findHoliday(
    { now: ctx.now, ...(noun.type === undefined ? {} : { type: noun.type }) },
    place,
    search,
  );
  return matches.length === 0 ? null : { pool: matches.sort(byStart), next: noun.next };
}

/**
 * One occurrence out of the pool. `undefined` when the selector has nothing to
 * point at, which the caller turns into a refusal rather than into a near miss.
 *
 * Every candidate is read through `atMidnight` first, because `start` is not an
 * instant: `@smartput/holiday` anchors it to UTC midnight of the local calendar
 * date, so its *fields* spell the date and its epoch is a pseudo-instant up to
 * 14 h away from the moment the day actually begins where the asker stands.
 * Comparing that pseudo-instant to `ctx.now` — which is what `next`, `last` and
 * `closest` used to do — makes a holiday west of Greenwich turn into the past
 * before it has happened: in `America/New_York` at 20:00 on New Year's Eve,
 * "next holiday" skipped New Year's Day and "last holiday" answered with a date
 * in the future. That is the default country's normal case, not an edge one.
 *
 * `this` answers the same either way — `atMidnight` preserves the calendar
 * fields, which is the whole point of it — and goes through the helper anyway so
 * that four neighbouring branches read a candidate one way instead of two. The
 * year of `now` is still read in the engine's zone: that one is a fact about the
 * asker, not about the calendar.
 *
 * Rejected: converting `ctx.now` down to a calendar date and comparing dates.
 * That answers "next holiday" with today's holiday at 23:00 on the day itself,
 * and `next` is documented as strict.
 */
function pick(pool: readonly HolidayMatch[], selector: Selector, ctx: MatchCtx) {
  const local = (m: HolidayMatch) => atMidnight(m.start, ctx.timeZone);
  const at = (m: HolidayMatch) => local(m).epochMilliseconds;

  switch (selector) {
    case "next":
      return pool.find((m) => at(m) > ctx.now);
    case "last":
      return pool.findLast((m) => at(m) < ctx.now);
    case "this": {
      const year = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
        ctx.timeZone,
      ).year;
      return pool.find((m) => local(m).year === year);
    }
    default: {
      // Ties go to the earlier occurrence, which is only reachable when `now`
      // sits exactly between two of them.
      let best: HolidayMatch | undefined;
      let bestGap = Number.POSITIVE_INFINITY;
      for (const m of pool) {
        const gap = Math.abs(at(m) - ctx.now);
        if (gap < bestGap) {
          best = m;
          bestGap = gap;
        }
      }
      return best;
    }
  }
}

/**
 * The holiday's calendar date, rebuilt at midnight in the engine's zone.
 *
 * `start` is UTC midnight of the local date, so its *fields* spell the date and
 * its instant does not. Converting the instant instead — `withTimeZone` — would
 * render Ukrainian Christmas as the 24th for anyone east of it, which is the
 * failure `@smartput/holiday` anchors to UTC to avoid; undoing that here would
 * put it straight back. Midnight, because a date the user did not give a time to
 * is midnight everywhere else in this package too.
 */
function atMidnight(start: number, zone: string): Temporal.ZonedDateTime {
  const utc = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO("UTC");
  return new Temporal.PlainDate(utc.year, utc.month, utc.day).toZonedDateTime(zone);
}

function shifted(zdt: Temporal.ZonedDateTime, shift: Shift): Temporal.ZonedDateTime {
  switch (shift.unit) {
    case "days":
      return zdt.add({ days: shift.amount });
    case "weeks":
      return zdt.add({ weeks: shift.amount });
    case "months":
      return zdt.add({ months: shift.amount });
    default:
      return zdt.add({ years: shift.amount });
  }
}

export interface HolidayLiteralOptions {
  /**
   * Where to ask. Absent means `defaultCountry`, which `@smartput/holiday`
   * defaults to `"US"` — there is no global holiday set to search, and sweeping
   * all 206 countries would answer "labour day" with a dozen different dates.
   */
  readonly place?: HolidayPlace;
  /** Overrides the `"US"` above without having to name a state or a region. */
  readonly defaultCountry?: string;
  /** Below this a name is a guess, not a match. `@smartput/holiday` defaults to 0.6. */
  readonly minScore?: number;
}

/**
 * The matcher. Register it through `datetimeWithHolidays` unless you are
 * building the kind yourself.
 */
export function createHolidayLiteral(opts: HolidayLiteralOptions = {}): LiteralMatcher {
  // Built once rather than per call, and spread conditionally because the repo
  // compiles with `exactOptionalPropertyTypes`: `{ minScore: undefined }` is not
  // an absent `minScore`.
  const search: FindHolidayOptions = {
    limit: POOL_LIMIT,
    ...(opts.minScore === undefined ? {} : { minScore: opts.minScore }),
    ...(opts.defaultCountry === undefined ? {} : { defaultCountry: opts.defaultCountry }),
  };

  return (input, offset, ctx) => {
    const words = scan(input, offset);
    if (words.length === 0) return null;

    let at = 0;
    const shift = readShift(words, at);
    if (shift !== null) at = shift.next;
    const selector = readSelector(words, at);
    if (selector !== null) at = selector.next;

    const subject = readSubject(words, at, ctx, opts.place, search);
    if (subject === null) return null;
    const length = (words[subject.next - 1]?.end ?? offset) - offset;

    // The date literal beside this one wins every span it can read on its own.
    //
    // Not politeness — the fold groups claims that reach the same end and hands
    // the solver all of them, so "monday" scoring 0.833 against "Easter Monday"
    // in Britain turns a weekday that used to evaluate into an `AmbiguityError`,
    // and "next monday" does the same at exactly matched length. A word chrono
    // reads as a date is a date; an edit-distance neighbour of a holiday's name
    // is a guess, and a guess must not cost the reading that was already right.
    // Longer claims are unaffected, which is what keeps "day before christmas"
    // and "2 days after easter" — both of which chrono reads a prefix of — from
    // being handed back.
    //
    // Rejected: refusing only exact-length collisions. That leaves the reading
    // chrono is more certain of losing to a one-word-longer holiday claim, which
    // is the same failure with an extra token in front of it.
    const dated = parseDateTime(input, offset, ctx);
    if (dated !== null && dated.length >= length) return null;

    const chosen = pick(subject.pool, selector?.kind ?? DEFAULT_SELECTOR, ctx);
    // "next christmas" with no occurrence after `now` inside the window, or
    // "this easter" in a year that has none. Refused rather than widened to the
    // nearest: a selector the data cannot honour is a question with no answer,
    // and answering a different one is the failure that matters.
    if (chosen === undefined) return null;

    const base = atMidnight(chosen.start, ctx.timeZone);
    const value = wrap(shift === null ? base : shifted(base, shift));
    return {
      kind: DATETIME_KIND,
      unit: value.unit,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length,
    };
  };
}

/**
 * `datetime` with the holiday matcher behind it. A drop-in replacement for the
 * root export's `datetime` in an engine's `kinds` list — the same kind id, the
 * same units, the same signatures — so register one or the other, never both.
 */
export function datetimeWithHolidays(opts: HolidayLiteralOptions = {}): Kind {
  return createDatetime({ literals: [createHolidayLiteral(opts)] });
}
