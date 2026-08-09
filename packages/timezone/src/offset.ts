import type { ZoneDef } from "./zones";

/**
 * Zones people spell as an offset from UTC — "GMT+3", "utc-05:00", "gmt+5:30".
 *
 * A consumer registers these as units exactly like `Asia/Tokyo`: the key is a
 * string Temporal accepts as a time zone id. What they cannot be is *aliases*.
 * `@smartput/core`'s alias index is keyed by one segmented word, and "gmt+3"
 * lexes as three tokens (word, op, number), so no alias lookup could ever reach
 * it — `parseOffsetZone` is the door, which is why the table below ships every
 * offset with an empty alias list.
 */

/** The range real zones occupy: Baker Island at -12:00, Kiritimati at +14:00. */
const MIN_MINUTES = -12 * 60;
const MAX_MINUTES = 14 * 60;

/**
 * Quarter hours, because that is the granularity zones are actually kept on —
 * :00 everywhere, :30 in India and half a dozen others, :45 in Nepal and the
 * Chatham Islands. Enumerating minute-by-minute would be 1,561 units to serve
 * offsets no country has ever used, and the alternative — resolving a unit
 * lazily — is not something core's registry offers: pass 5 indexes a fixed map.
 */
const STEP_MINUTES = 15;

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutes east of UTC as a Temporal time zone id: 180 -> "+03:00". */
export function offsetZoneId(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * `UTC+03:00`, except at zero, which is written the way `ZONES` writes it.
 * "+00:00" and "UTC" are two units naming one zone — one reached by writing an
 * offset, the other by writing the word — and a formatted result should not
 * tell the user which door they came through.
 */
function symbolFor(minutes: number): string {
  return minutes === 0 ? "UTC" : `UTC${offsetZoneId(minutes)}`;
}

export const OFFSET_ZONES: Record<string, ZoneDef> = {};
for (let minutes = MIN_MINUTES; minutes <= MAX_MINUTES; minutes += STEP_MINUTES) {
  OFFSET_ZONES[offsetZoneId(minutes)] = { aliases: [], symbol: symbolFor(minutes) };
}

/**
 * The three shapes a written offset takes, in the order they have to be tried:
 * `H:MM` first because its colon is unambiguous, then the compact four-digit
 * `HHMM`, then a bare hour. Trying the bare hour first would read "utc+0530" as
 * "+05:00" and silently drop the minutes.
 *
 * Spaces are tolerated around the sign because a user typing "gmt + 3" means
 * the zone, not arithmetic: "gmt" is not a value, so there is no addition it
 * could otherwise be part of.
 *
 * The trailing guard rejects a run that keeps going — "gmt+3x" is not an
 * offset with a suffix, it is something else entirely.
 */
const OFFSET_PATTERN =
  /^(?:gmt|utc)\s*([+-])\s*(?:(\d{1,2})\s*:\s*(\d{2})|(\d{2})(\d{2})|(\d{1,2}))(?![\p{L}\p{N}:])/iu;

export interface OffsetMatch {
  /** A Temporal time zone id, and a key of `OFFSET_ZONES`. */
  zone: string;
  /** Characters consumed from the start of the input. */
  length: number;
}

/**
 * Reads an offset zone anchored at the start of `text`, or returns null.
 *
 * Null for anything outside `OFFSET_ZONES` — out of range, or off the quarter
 * hour. Core's literal fold drops a match naming a unit the kind never
 * registered, so declining here is the same outcome reached without building a
 * value first.
 */
export function parseOffsetZone(text: string): OffsetMatch | null {
  const match = OFFSET_PATTERN.exec(text);
  if (match === null) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? match[4] ?? match[6]);
  const minutes = Number(match[3] ?? match[5] ?? "0");

  const total = sign * (hours * 60 + minutes);
  if (total < MIN_MINUTES || total > MAX_MINUTES) return null;
  if (total % STEP_MINUTES !== 0) return null;

  return { zone: offsetZoneId(total), length: match[0].length };
}
