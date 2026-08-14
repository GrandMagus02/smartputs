import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { Corpora } from "@smartput/core/testing";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "./time";

const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, time],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/**
 * The corpus asserts the *time* reading, which is not the reading that wins.
 *
 * `datetime` is registered above precisely so the engine here is the one a real
 * consumer builds — a `time` reading only exists alongside a `datetime` one —
 * and `kinds` then names the reading each row is about. `duration` rides along
 * because the arithmetic rows need a right operand; it never claims a row's
 * input on its own.
 */
const KINDS = ["time", "duration"];

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
