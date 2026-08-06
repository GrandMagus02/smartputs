/**
 * One function for two question shapes, because they differ only in whether the
 * name half of the score has anything to work with.
 *
 * A **named** query ("christmas", "chrismas", "xmas day") ranks on how near the
 * phrase is to each holiday's name, with proximity separating the occurrences
 * of the one holiday — which is the normal case, since the same name recurs
 * every year. A **nameless** query ("closest holiday") gives every surviving
 * candidate a `nameScore` of 1, so the ranking falls entirely to proximity.
 * That is not a branch in the scorer; it is what the same two terms do when the
 * first one carries no information.
 *
 * **Ruling — the type default differs by shape.** A nameless query defaults to
 * `"public"`: "closest holiday" means the one people get off work for, and
 * including observances would answer with some flag day nobody marks. A named
 * query applies no type filter unless one is given: the user named the holiday,
 * so they have already said which one they mean, and filtering by an assumed
 * type would refuse a correct match — "Boxing Day" is `bank` in some countries
 * and `public` in others.
 *
 * **Ruling — the type filter never widens.** `type: "bank"` against the US
 * returns nothing, because the US has no `bank` holiday; so does `"school"`,
 * and Britain's "Early May bank holiday" is `public` with the words in its
 * name. A filter that silently dropped itself when it emptied the set would
 * turn "closest bank holiday" into "closest holiday" and answer a different
 * question than the one asked. A caller that wants that fallback can see the
 * empty array and ask again without the type, which is a decision it is better
 * placed to make than this function is.
 */

import { nameScore, proximityPenalty } from "./score";
import { DEFAULT_COUNTRY, occurrences, resolvePlace } from "./source";
import type {
  FindHolidayOptions,
  HolidayMatch,
  HolidayPlace,
  HolidayQuery,
  HolidayType,
} from "./types";

const DEFAULT_LIMIT = 5;

/** Below this it is not a match, it is a guess. */
const DEFAULT_MIN_SCORE = 0.6;

/**
 * Three years, not one. "next easter" typed in December has to reach next
 * year's, and "last christmas" typed in January has to reach the previous
 * year's, so the window is `year(now) - 1 … year(now) + 1` in every query and
 * the ranking decides which end of it wins.
 *
 * The year is taken in UTC to match how `source.ts` anchors `start`. Reading it
 * in the host's zone would make the candidate set depend on where the process
 * runs, for one day either side of New Year.
 */
function candidateYears(now: number): number[] {
  const year = new Date(now).getUTCFullYear();
  return [year - 1, year, year + 1];
}

export function findHoliday(
  query: HolidayQuery,
  place?: HolidayPlace,
  opts: FindHolidayOptions = {},
): HolidayMatch[] {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
  const where = resolvePlace(place, opts.defaultCountry ?? DEFAULT_COUNTRY);

  const typed = (query.name ?? "").trim();
  const nameless = typed === "";
  const type = query.type ?? (nameless ? "public" : undefined);

  const matches: HolidayMatch[] = [];
  for (const year of candidateYears(query.now)) {
    for (const occurrence of occurrences(year, where)) {
      if (type !== undefined && occurrence.type !== type) continue;
      const similarity = nameless ? 1 : nameScore(typed, occurrence.name);
      const score = similarity - proximityPenalty(occurrence.start, query.now);
      if (score < minScore) continue;
      matches.push({ ...occurrence, score, nameScore: similarity });
    }
  }

  matches.sort(comparator(nameless));
  return matches.slice(0, limit);
}

/**
 * How much of the country stops, most first. The signal is already in the data,
 * so ranking on it needs no list of words and no notion of which holidays are
 * "major" — the country has already said so by typing them `public` rather than
 * `observance`.
 *
 * `school` sits below `bank` and above `optional` on the same reading: schools
 * closing is narrower than banks and offices closing, and wider than a day an
 * employer may or may not grant. Nothing observable turns on it — sweeping all
 * 206 countries finds no query where a `school` holiday ties a nameScore against
 * an `optional` one — so this is written down as a ruling rather than defended
 * as a measurement.
 */
const TYPE_RANK: Record<HolidayType, number> = {
  public: 0,
  bank: 1,
  school: 2,
  optional: 3,
  observance: 4,
};

/**
 * Name first, then — for a named query only — which holiday, and only then
 * which occurrence of it.
 *
 * The rejected alternative is sorting on `score` — that is, on
 * `nameScore - proximityPenalty` — which is what the single number suggests and
 * which quietly breaks the property the penalty cap exists to protect. The cap
 * is 0.05, but two `nameScore`s can differ by less than that: an averaged token
 * score lands on 0.833 for "easter" against "Easter Sunday" and on 0.75 against
 * "Orthodox Easter (substitute day)", and 0.083 is only a coincidence away from
 * being 0.03. Whenever the gap is under the cap, a nearer date would overturn a
 * strictly better name — the exact failure the cap was chosen to prevent. No
 * value of the cap fixes this, because there is no lower bound on the gap; a
 * lexicographic comparator fixes it for every gap at once.
 *
 * **The type and name keys are why this is not just `nameScore` then `score`.**
 * `nameScore` ties two *different* holidays whenever they share the typed tokens
 * and differ only in a trailing word of equal weight: "Christmas Day" and
 * "Christmas Eve" both score 0.83333 against `christmas`. At equal `nameScore`,
 * `score` is nothing but the proximity penalty — so without these two keys the
 * date the question was asked on decided which of two different holidays it
 * named, and `christmas` answered Christmas Eve for about six and a half months
 * of the year, December included. Sweeping all 206 shipped countries, 201
 * (country, query) pairs changed their answer with the calendar: Easter Sunday
 * against Easter Monday, New Year's Day against New Year's Eve, Midsummer Eve
 * against Midsummer Day, Shrove Monday against Shrove Tuesday. Proximity is
 * scoped to separating the occurrences of *one* holiday; these keys hold it
 * there.
 *
 * The name key is not decoration on top of the type key. Type alone leaves 94 of
 * those 201 pairs still decided by the date, because both sides are `public` —
 * 13 countries make Christmas Eve a public holiday, 9 do the same for New Year's
 * Eve. Between two holidays of one name-score and one type there is no signal
 * left in the data, so the tiebreak is the canonical name: arbitrary, but a
 * fact about the holidays rather than about `now`, which is the whole of what
 * was wrong. It falls out to Christmas Day over Christmas Eve and New Year's Day
 * over New Year's Eve, matching the plan's worked-example table; it also falls
 * out to Easter Monday over Easter Sunday, which is not obviously the better
 * answer and is at least the *same* answer in June as in December.
 *
 * **Why not stop `nameScore` tying Day against Eve.** That is the larger change
 * and the wrong layer. Separating them needs to know that "Day" and "Eve" are
 * contrastive while "Day" and "Sunday" are not, which is a vocabulary list —
 * the thing `score.ts` already refuses for nicknames, with no natural edge and a
 * per-language copy. It would also have to keep working for the 201 pairs above,
 * which include "Independence of Cuenca" against "Independence of Guayaquil" and
 * four Shia martyrdom days that differ only in a name. Ranking on a field the
 * data already carries costs one lookup table and no vocabulary at all.
 *
 * **Why both keys are skipped for a nameless query.** "Closest holiday" is
 * asking proximity to choose between different holidays — that is the question.
 * Every candidate is `nameScore` 1 there, so a name key would sort the answer
 * alphabetically and a type key would be a no-op anyway, since a nameless query
 * is already filtered to a single type. Branching once here beats encoding the
 * distinction as a magic `nameScore`.
 *
 * Each branch is a plain lexicographic tuple, which is what makes this a total
 * order. The rejected shape is the narrower-sounding "apply the type key only
 * across different canonical names": that is not transitive on the shipped data,
 * where one name carries two types in one candidate set — Korea's Constitution
 * Day is `public` in one year and `observance` in another, American Samoa's
 * Christmas Eve is `bank` in one and `optional` in another. With a third
 * candidate ranking between them, `a < b` and `b < c` and `c < a` all hold, and
 * `Array.prototype.sort` is free to answer anything.
 *
 * `score` is still reported and still what `minScore` filters on: within one
 * `nameScore` it is monotonic with proximity, and across name scores it is the
 * honest "how good is this match" number a caller wants to show.
 *
 * The last two keys are not decoration either. Ukraine's 2027 data has two
 * entries named "Christmas Day", same type, same rule, neither flagged as a
 * substitute, on the 25th and the 27th — and with `now` on the 26th they tie on
 * proximity as well. Without a total order, which one `limit` keeps would depend
 * on the sort's implementation.
 */
function comparator(nameless: boolean): (a: HolidayMatch, b: HolidayMatch) => number {
  return (a, b) => {
    if (a.nameScore !== b.nameScore) return b.nameScore - a.nameScore;
    if (!nameless) {
      const rank = TYPE_RANK[a.type] - TYPE_RANK[b.type];
      if (rank !== 0) return rank;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    }
    if (a.score !== b.score) return b.score - a.score;
    if (a.start !== b.start) return a.start - b.start;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  };
}
