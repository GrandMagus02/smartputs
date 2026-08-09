import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { Corpora } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datetime } from "./datetime";
import datetimeEn from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const engine = createEngine({
  locales: [composeLocale(coreEn, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine,
  },
  {
    id: "uk",
    pending:
      "@smartput/datetime reads its dates through chrono-node, which parses English; the zone words come from a vocabulary whose Ukrainian half (`@smartput/datetime/locale/uk`) is P3's and does not exist yet",
  },
]);

corpora.evaluate();
