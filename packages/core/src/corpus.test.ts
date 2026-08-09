import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import { createEngine } from "./engine";
import { composeLocale } from "./locale/compose";
import { Corpora } from "./testing";

/**
 * The engine's own corpus, replayed in both languages it speaks.
 *
 * `corpus/uk.tsv` was already here — `parity.test.ts` next door reads column 0
 * of it for the recorded-snapshot half — but this file only ever opened
 * `corpus/en.tsv`, so the Ukrainian rows were asserted by the parity net and
 * not by the corpus net. They are asserted by both now, which is the point:
 * a snapshot says an output did not change, and these three columns say it was
 * right to begin with.
 */
const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine: createEngine({
      locales: [composeLocale(en, BUILTIN_EN)],
      kinds: BUILTIN_KINDS,
    }),
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, BUILTIN_UK)],
      kinds: BUILTIN_KINDS,
    }),
  },
]);

corpora.evaluate();
