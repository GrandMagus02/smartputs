export interface Window {
  /** Local hour the window opens, inclusive. */
  start: number;
  /** Local hour it closes, exclusive. */
  end: number;
  /** True when `end <= start` and the span runs through midnight. */
  wraps: boolean;
}

/**
 * Data, not code: a "night" that starts at 21:00 is a configuration change.
 * Overridden through the range kinds' factory options, which spread their
 * overrides over this table — hence the freeze, so an override cannot become a
 * mutation that changes the window for every other engine in the process.
 *
 * `wraps` is stored rather than derived so a consumer reads one flag instead of
 * re-deriving `end <= start` at four call sites; `windows.test.ts` asserts the
 * two never disagree.
 */
export const WINDOWS: Readonly<Record<string, Window>> = Object.freeze({
  morning: Object.freeze({ start: 6, end: 12, wraps: false }),
  afternoon: Object.freeze({ start: 12, end: 18, wraps: false }),
  evening: Object.freeze({ start: 18, end: 22, wraps: false }),
  night: Object.freeze({ start: 22, end: 6, wraps: true }),
  day: Object.freeze({ start: 6, end: 22, wraps: false }),
});
