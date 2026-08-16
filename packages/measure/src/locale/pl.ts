import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Polish words for the typographic units — the same six `en` next door names,
 * with the same answer to "does this unit have words at all?". All six do:
 * Polish declines every one of them.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so "72 pt" keeps working in a Polish engine
 * and the micro path (`parseMeasure`) cannot drift from it. The Polish spellings
 * are appended in every case a reader is plausibly going to type.
 *
 * Eight `forms` keys per unit, because `polish.selectForm` returns
 * `` `${case}-${category}` ``: the case from the slot (locative for a conversion
 * target, which is what `w` governs — "w 72 punktach"), the category from CLDR's
 * four. Three rows are worth naming:
 *
 *   `nom-many` is the 0/5–21/teens row, genitive plural, and it reaches **21**.
 *   Polish writes "21 punktów" where Ukrainian writes "21 пункт": every -1 above
 *   twenty parts the two languages, and a table ported from `uk.ts` prints a
 *   nominative singular there.
 *
 *   `nom-other` is the fractional one, and in Polish that is the genitive
 *   *singular*: "1,5 cala", never "1,5 cali".
 *
 *   `loc-other` is the count-free conversion target ("w calach"), a different
 *   word from `nom-other` and reached from the opposite direction — with no
 *   count rather than with a fractional one.
 *
 * The genitive singular is where these six units stop agreeing with each other,
 * and the split does not follow the metric/typographic line one might expect.
 * `milimetr`, `centymetr`, `cal` and `piksel` take **-a**, which is the ending
 * Polish units of measure take as a class. `punkt` takes **-u** — "1,5 punktu",
 * and "1,5 punkta" is not a word — because it is an ordinary abstract masculine
 * that happens to be used as a unit, and it keeps its own paradigm.
 *
 * Two of the six are not variations on the masculine hard paradigm the metric
 * pair share. `pika` is feminine: its genitive singular and nominative plural
 * coincide ("2 piki", "1,5 piki"), its genitive plural is the bare stem `pik`
 * rather than an -ów ending, and its locative singular takes the k→c
 * alternation, `pice`, which no ending table produces by itself. `piksel` is a
 * soft-stem masculine, so its plural is `piksele`/`pikseli` where `punkt` gives
 * `punkty`/`punktów`.
 *
 * The consonant alternations are the reason every locative singular here is
 * written out rather than left to `polish`'s suffix stripper: `milimetrze` and
 * `centymetrze` take r→rz, `punkcie` takes t→ć, `pice` takes k→c, and `calu` and
 * `pikselu` take the soft -u instead of -e. Not one of them is reachable by
 * removing an ending from the nominative, so a printed form that is not listed
 * here would be a word the engine could not read back.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what a Polish
 * designer writes in a stylesheet, and inventing `pkt` for the typographic point
 * would collide with the abbreviation Polish already uses for a scoring point.
 * The metric two keep their SI symbols and the inch gets its noun, which is the
 * same choice `@smartput/length/locale/pl` makes for the same reason. Every
 * symbol here is also an alias, which is what `assertLocaleContract` checks: a
 * printed string the engine cannot read back is the failure.
 *
 * Like `en`, this file names `measure` by id string and never imports the kind.
 * `composeLocale` is where the two halves meet — and, as there, a caller has to
 * ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS` because
 * its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/pl` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "measure",
  units: {
    // Soft-stem masculine: `cale` where a hard stem gives `-y`, `cali` where it
    // gives `-ów`, and a locative singular in `-u` rather than `-e`.
    inch: {
      aliases: [
        ...alias("inch"),
        "cal",
        "cala",
        "calowi",
        "calu",
        "calem",
        "cale",
        "cali",
        "calom",
        "calach",
        "calami",
      ],
      symbol: "cal",
      forms: {
        "nom-one": "cal",
        "nom-few": "cale",
        "nom-many": "cali",
        "nom-other": "cala",
        "loc-one": "calu",
        "loc-few": "calach",
        "loc-many": "calach",
        "loc-other": "calach",
      },
    },
    mm: {
      aliases: [
        ...alias("mm"),
        "milimetr",
        "milimetra",
        "milimetrowi",
        "milimetrze",
        "milimetrem",
        "milimetry",
        "milimetrów",
        "milimetrom",
        "milimetrach",
        "milimetrami",
      ],
      symbol: "mm",
      forms: {
        "nom-one": "milimetr",
        "nom-few": "milimetry",
        "nom-many": "milimetrów",
        "nom-other": "milimetra",
        "loc-one": "milimetrze",
        "loc-few": "milimetrach",
        "loc-many": "milimetrach",
        "loc-other": "milimetrach",
      },
    },
    cm: {
      aliases: [
        ...alias("cm"),
        "centymetr",
        "centymetra",
        "centymetrowi",
        "centymetrze",
        "centymetrem",
        "centymetry",
        "centymetrów",
        "centymetrom",
        "centymetrach",
        "centymetrami",
      ],
      symbol: "cm",
      forms: {
        "nom-one": "centymetr",
        "nom-few": "centymetry",
        "nom-many": "centymetrów",
        "nom-other": "centymetra",
        "loc-one": "centymetrze",
        "loc-few": "centymetrach",
        "loc-many": "centymetrach",
        "loc-other": "centymetrach",
      },
    },
    // The one unit here whose genitive singular is -u: "1,5 punktu", never
    // "punkta". Its locative singular takes t→ć on top of that.
    pt: {
      aliases: [
        ...alias("pt"),
        "punkt",
        "punktu",
        "punktowi",
        "punkcie",
        "punktem",
        "punkty",
        "punktów",
        "punktom",
        "punktach",
        "punktami",
      ],
      symbol: "pt",
      forms: {
        "nom-one": "punkt",
        "nom-few": "punkty",
        "nom-many": "punktów",
        "nom-other": "punktu",
        "loc-one": "punkcie",
        "loc-few": "punktach",
        "loc-many": "punktach",
        "loc-other": "punktach",
      },
    },
    // The feminine one, with the k→c alternation in the locative singular that
    // no ending table produces on its own, and a genitive plural that is the
    // bare stem.
    pc: {
      aliases: [
        ...alias("pc"),
        "pika",
        "piki",
        "pice",
        "pikę",
        "piką",
        "pik",
        "pikom",
        "pikach",
        "pikami",
      ],
      symbol: "pc",
      forms: {
        "nom-one": "pika",
        "nom-few": "piki",
        "nom-many": "pik",
        "nom-other": "piki",
        "loc-one": "pice",
        "loc-few": "pikach",
        "loc-many": "pikach",
        "loc-other": "pikach",
      },
    },
    // Soft-stem masculine: `piksele`/`pikseli`, where the hard `punkt` above
    // gives `punkty`/`punktów`.
    px: {
      aliases: [
        ...alias("px"),
        "piksel",
        "piksela",
        "pikselowi",
        "pikselu",
        "pikselem",
        "piksele",
        "pikseli",
        "pikselom",
        "pikselach",
        "pikselami",
      ],
      symbol: "px",
      forms: {
        "nom-one": "piksel",
        "nom-few": "piksele",
        "nom-many": "pikseli",
        "nom-other": "piksela",
        "loc-one": "pikselu",
        "loc-few": "pikselach",
        "loc-many": "pikselach",
        "loc-other": "pikselach",
      },
    },
  },
});
