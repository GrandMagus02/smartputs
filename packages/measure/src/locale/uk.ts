import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Ukrainian words for the typographic units — the same six `en` next door
 * names, with the same answer to "does this unit have words at all?". All six
 * do: Ukrainian declines every one of them.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so `72 pt` keeps working in a Ukrainian
 * engine and the micro path (`parseMeasure`) cannot drift from it. The Cyrillic
 * spellings are appended in every case a reader is plausibly going to type.
 *
 * Eight `forms` keys per unit, because `ukrainian.selectForm` returns
 * `` `${case}-${category}` ``: the case from the slot (locative for a
 * conversion target, which is what `в` governs — "в 72 пунктах"), the category
 * from CLDR's four. `nom-other` is the fractional one, and in Ukrainian that is
 * the genitive *singular*: "1,5 дюйма", never "1,5 дюймів".
 *
 * Two of the six are not variations on the masculine paradigm the other four
 * share. `піка` is feminine, so its nominative plural and genitive singular
 * coincide ("2 піки", "1,5 піки") and its genitive plural is the bare stem
 * (`пік`) rather than an `-ів` ending; its locative singular takes the к→ц
 * alternation (`піці`), which no ending table produces by itself. `піксель` is
 * a soft-stem masculine, so its plural is `пікселі` where `пункт` gives
 * `пункти`.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what a
 * Ukrainian designer writes in a stylesheet, and inventing `пкс` would be a
 * word this file made up rather than one anybody types. The metric two get
 * their conventional Cyrillic abbreviations and the inch gets its noun, which
 * is the same choice `@smartput/length/locale/uk` makes for the same reason.
 * Every symbol here is also an alias, which is what `assertLocaleContract`
 * checks: a printed string the engine cannot read back is the failure.
 *
 * Like `en`, this file names `measure` by id string and never imports the kind.
 * `composeLocale` is where the two halves meet — and, as there, a caller has to
 * ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS` because
 * its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/uk` for exactly the reason the kind is absent from
 * the roster.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "measure",
  units: {
    inch: {
      aliases: [
        ...alias("inch"),
        "дюйм",
        "дюйма",
        "дюйму",
        "дюймі",
        "дюйми",
        "дюймів",
        "дюймам",
        "дюймах",
        "дюймом",
        "дюймами",
      ],
      symbol: "дюйм",
      forms: {
        "nom-one": "дюйм",
        "nom-few": "дюйми",
        "nom-many": "дюймів",
        "nom-other": "дюйма",
        "loc-one": "дюймі",
        "loc-few": "дюймах",
        "loc-many": "дюймах",
        "loc-other": "дюймах",
      },
    },
    mm: {
      aliases: [
        ...alias("mm"),
        "мм",
        "міліметр",
        "міліметра",
        "міліметру",
        "міліметрі",
        "міліметри",
        "міліметрів",
        "міліметрам",
        "міліметрах",
        "міліметром",
        "міліметрами",
      ],
      symbol: "мм",
      forms: {
        "nom-one": "міліметр",
        "nom-few": "міліметри",
        "nom-many": "міліметрів",
        "nom-other": "міліметра",
        "loc-one": "міліметрі",
        "loc-few": "міліметрах",
        "loc-many": "міліметрах",
        "loc-other": "міліметрах",
      },
    },
    cm: {
      aliases: [
        ...alias("cm"),
        "см",
        "сантиметр",
        "сантиметра",
        "сантиметру",
        "сантиметрі",
        "сантиметри",
        "сантиметрів",
        "сантиметрам",
        "сантиметрах",
        "сантиметром",
        "сантиметрами",
      ],
      symbol: "см",
      forms: {
        "nom-one": "сантиметр",
        "nom-few": "сантиметри",
        "nom-many": "сантиметрів",
        "nom-other": "сантиметра",
        "loc-one": "сантиметрі",
        "loc-few": "сантиметрах",
        "loc-many": "сантиметрах",
        "loc-other": "сантиметрах",
      },
    },
    pt: {
      aliases: [
        ...alias("pt"),
        "пункт",
        "пункта",
        "пункту",
        "пункті",
        "пункти",
        "пунктів",
        "пунктам",
        "пунктах",
        "пунктом",
        "пунктами",
      ],
      symbol: "pt",
      forms: {
        "nom-one": "пункт",
        "nom-few": "пункти",
        "nom-many": "пунктів",
        "nom-other": "пункта",
        "loc-one": "пункті",
        "loc-few": "пунктах",
        "loc-many": "пунктах",
        "loc-other": "пунктах",
      },
    },
    // The feminine one, and the к→ц alternation in the locative singular that
    // no ending table produces on its own.
    pc: {
      aliases: [
        ...alias("pc"),
        "піка",
        "піки",
        "піці",
        "піку",
        "пікою",
        "пік",
        "пікам",
        "піках",
        "піками",
      ],
      symbol: "pc",
      forms: {
        "nom-one": "піка",
        "nom-few": "піки",
        "nom-many": "пік",
        "nom-other": "піки",
        "loc-one": "піці",
        "loc-few": "піках",
        "loc-many": "піках",
        "loc-other": "піках",
      },
    },
    // Soft-stem masculine: `пікселі`, not `пікселu`-style hard forms.
    px: {
      aliases: [
        ...alias("px"),
        "піксель",
        "пікселя",
        "пікселю",
        "пікселі",
        "пікселів",
        "пікселям",
        "пікселях",
        "пікселем",
        "пікселями",
      ],
      symbol: "px",
      forms: {
        "nom-one": "піксель",
        "nom-few": "пікселі",
        "nom-many": "пікселів",
        "nom-other": "пікселя",
        "loc-one": "пікселі",
        "loc-few": "пікселях",
        "loc-many": "пікселях",
        "loc-other": "пікселях",
      },
    },
  },
});
