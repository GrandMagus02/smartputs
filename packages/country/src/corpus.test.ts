import { ADMIN1, CITIES } from "@smartput/city";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { Corpora } from "@smartput/core/testing";
import { length } from "@smartput/length";
import lengthEn from "@smartput/length/locale/en";
import { number } from "@smartput/number";
import placeEn from "./locale/en";
import { definePlace } from "./place";

// `length` is registered because the distance op resolves to it, and `number`
// because length's generated scaling ops name it.
//
// The fully loaded kind rather than the T0 `place`: the corpus is what this
// package answers when a consumer has taken everything it publishes, and half
// the rows below are cities. That the T0 build is a working package on its own —
// same country readings, no city — is place.test.ts's claim, asserted there
// against both builds side by side rather than implied by which import this
// file happens to use.
const engine = createEngine({
  // `lengthEn` because a distance's answer is spelled: the corpus records
  // "878.399 kilometres", and words now arrive as a vocabulary rather than off
  // the kind. `placeEn` for the same reason and one more — a `place` no
  // language has spoken for is indexed under its own unit keys, so leaving it
  // out would put the alpha-2 codes in the global index and make "10 km"
  // ambiguous between a kilometre and Comoros.
  locales: [composeLocale(en, [lengthEn, placeEn])],
  kinds: [number, length, definePlace({ cities: CITIES, admin1: ADMIN1 })],
});
const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine,
  },
  {
    id: "uk",
    pending:
      "a place's words are its names, and the shipped gazetteer carries the English ones; a Ukrainian corpus needs a Ukrainian name column in `@smartput/city`, which is data this package does not have",
  },
]);

corpora.evaluate();
