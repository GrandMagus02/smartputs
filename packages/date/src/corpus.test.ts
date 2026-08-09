import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { Corpora } from "@smartput/core/testing";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { date } from "./date";

const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, date],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/**
 * Every row is read with the candidate set narrowed to these two kinds.
 *
 * `datetime` is registered in the engine above but excluded here on purpose:
 * the date reading is weighted -5 precisely so that an unnarrowed "today" keeps
 * answering as a datetime, which `date.test.ts` pins. This file asserts the
 * *other* reading — the one the range kinds are built on — so it has to ask for
 * it. `duration` rides along because the arithmetic rows need a right operand.
 */
const KINDS = ["date", "duration"];

const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine,
    evaluate: { kinds: KINDS },
  },
  {
    id: "uk",
    pending:
      "@smartput/datetime reads its dates through chrono-node, which parses English; the zone words come from a vocabulary whose Ukrainian half (`@smartput/datetime/locale/uk`) is P3's and does not exist yet",
  },
]);

corpora.evaluate();
