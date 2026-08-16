import angleId from "@smartput/angle/locale/id";
import areaId from "@smartput/area/locale/id";
import datarateId from "@smartput/datarate/locale/id";
import datasizeId from "@smartput/datasize/locale/id";
import durationId from "@smartput/duration/locale/id";
import energyId from "@smartput/energy/locale/id";
import type { Vocabulary } from "@smartput/kind/types";
import lengthId from "@smartput/length/locale/id";
import massId from "@smartput/mass/locale/id";
import numberId from "@smartput/number/locale/id";
import percentId from "@smartput/percent/locale/id";
import powerId from "@smartput/power/locale/id";
import speedId from "@smartput/speed/locale/id";
import temperatureId from "@smartput/temperature/locale/id";
import tempoId from "@smartput/tempo/locale/id";
import volumeId from "@smartput/volume/locale/id";

/**
 * Every built-in `id` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `indonesian`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(indonesian, BUILTIN_ID)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/id` one subpath at a time — the same caveat
 * the `./validate` and `./class` barrels next door carry.
 *
 * The array is ordered by kind id, and order is not load-bearing:
 * `composeLocale` refuses two vocabularies for one kind outright, so there is
 * no last-one-wins for the ordering to decide.
 *
 * It is `BUILTIN_EN`'s twin down to the import list, and deliberately so: the
 * barrel is the one file where a language that had been translated for fourteen
 * kinds and forgotten for the fifteenth would show up as a missing line, so the
 * two barrels being diffable against each other is the check.
 *
 * `id` is the bare tag with nothing behind it to choose — `pt` had to pick a
 * regional default and `zh` a script, while Indonesian has one standardised
 * orthography (EYD) and no second register to spell a unit noun differently in.
 * The old ISO 639-1 code `in` is the only trap, and it is a naming one rather
 * than a data one: `Intl` canonicalises it away, and this engine's `in`
 * conversion keyword makes the superseded spelling unusable as a filename here
 * anyway.
 *
 * What the barrel inherits from the language half is one shape and one gap.
 * The shape: `indonesian.selectForm` is the constant `"other"`, so every
 * `forms` table under this array is exactly one row deep, keyed `"other"` and
 * nothing else — the cheapest a translated vocabulary gets anywhere in this
 * repo, and the reason each of the files below is mostly aliases.
 *
 * The gap is worth reading before adding a word to any of them. `indonesian`
 * ships no `renderQuantity`, and its argument for not spending one is that
 * every translated unit carries that single `forms` row, so `formatValue`
 * always takes the branch that already spaces the word. **That premise does not
 * hold across this barrel**, where 27 of the 76 units have no `forms` at all,
 * and the reasons they have none pull in opposite directions.
 *
 * Eighteen of them have none because the Indonesian name is a *phrase* rather
 * than a word — "meter persegi", "meter kubik", "kilowatt-jam", "tenaga kuda",
 * "kilometer per jam". Indonesian puts the qualifier after the head and does
 * not compound, so unlike Dutch or German there is not even a closed-up token
 * to list, and rule 6 is satisfied by an empty key set rather than by an
 * unreachable row. Those units fall through to `defaultRenderQuantity`'s tight
 * symbol branch and print "10m²", "2kWh", "100km/jam" where Indonesian
 * typography, following SI, wants the space. It is the same string `en` and
 * `uk` produce, so nothing regressed; it is still wrong for this language. The
 * repair is one field in `@smartput/core/locale/id`, not a space guessed at in
 * each vocabulary below, and the affected files pin the current output as a
 * string so the day that field arrives the pins fail and get rewritten.
 *
 * The other eight — `temperature` and `tempdelta`'s three units each, plus
 * `percent` and `number`'s single unit — have none because the symbol *is* the
 * written form, and there the tight output is the correct one: "20°C" and "20%"
 * are what Indonesian writes. Do not "fix" those by giving them a row when the
 * `renderQuantity` above arrives; `temperature/locale/id` argues the point at
 * length, and its case is the strongest version of it in the repo, since even
 * at one row per unit — the cheapest a table can be — the spelled output would
 * still be wrong.
 *
 * The twenty-seventh is `mass`'s ounce, and it is neither: it is a refusal.
 * Indonesian *ons* means 100 g — the live wet-market hectogram — not the
 * 28.35 g avoirdupois ounce, so claiming it would be a 3.5x error in the
 * commonest register, and no second Indonesian noun exists to claim instead.
 * The unit prints "oz" and "2 ons" throws. Two more words are refused the same
 * way and for the same reason, each argued in its own file rather than left to
 * look like an oversight: `area`'s *are* (100 m², 40x off the acre, and this
 * kind defines no 100 m² unit) and `power`'s *PK* / *daya kuda*, which name the
 * metric horsepower, 735.5 W, where this kind's `hp` is the mechanical
 * 745.7 W. All three would have been silent numeric errors inside a single
 * kind, with nothing for the solver to rank and no test that would have caught
 * them — which is also why the last one is reported upward rather than fixed
 * here: a `ps`/`pk` row is `power`'s `units.ts` to add, not a vocabulary's.
 */
const BUILTIN_ID: readonly Vocabulary[] = [
  angleId,
  areaId,
  datarateId,
  datasizeId,
  durationId,
  energyId,
  lengthId,
  massId,
  numberId,
  percentId,
  powerId,
  speedId,
  // The one package that defines two kinds, so the one entry that spreads:
  // `temperature` and `tempdelta` ship as an array from a single subpath.
  ...temperatureId,
  tempoId,
  volumeId,
];
export default BUILTIN_ID;
