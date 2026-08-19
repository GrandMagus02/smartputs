import { expect, test } from "bun:test";
import * as api from "./index";

test("the public surface is what the package promises", () => {
  // No `ZONES` and no `OFFSET_ZONES`: the zone tables live in
  // `@smartput/timezone`, so a form field that needs zone names can have them
  // without chrono and Temporal coming along.
  //
  // `createDatetime` is here and `./holiday`'s matcher is not, which is the
  // whole shape of the opt-in: the factory takes extra literal matchers and
  // costs nothing, while the one matcher that would drag `date-holidays` in
  // behind it is reachable only from the subpath.
  //
  // `addDuration` and the two `TEST_` constants are here because the range
  // packages consume them across a package boundary: `@smartput/date` and
  // `@smartput/time` do date math with the same calendar-aware routine
  // `datetime` uses — a second copy would drift on DST — and every package's
  // tests pin the same clock. Deep-importing `../datetime/src/value` instead
  // would work under bun and break the moment anything reads `dist`.
  //
  // The three ordinal exports are the same kind of cross-package loan.
  // `@smartput/date-range` reads "second week Aug 2027" by counting the way
  // "second monday in Aug 2027" counts here, and the two grammars have to agree
  // about which September "of september" means; `parseMonthScope` and
  // `referenceMonth` stay inside because nothing outside needs a month without
  // an ordinal in front of it.
  expect(Object.keys(api).sort()).toEqual([
    "DATETIME_KIND",
    "LAST_ORDINAL",
    "TEST_NOW",
    "TEST_ZONE",
    "Temporal",
    "addDuration",
    "createDatetime",
    "datetime",
    "nthWeekdayOfMonth",
    "parseDateTime",
    "parseOrdinalPhrase",
    "unwrap",
    "wrap",
  ]);
});
