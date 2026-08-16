import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en` next door makes, kept for the same reason `uk`
 * keeps it rather than the one `en` states.
 *
 * In English, `in` is the conversion keyword, so `lex` emits it as a `keyword`
 * token and an `in` alias is unreachable on the engine path. Polish's
 * conversion keywords are `w`/`we`/`na`/`do`, so nothing about a Polish lexer
 * would shadow it — the entry would be perfectly reachable here.
 *
 * It stays out anyway, because `registry.aliasIndex` is one flat map and
 * `MatchCtx.isUnitAlias` reads it without consulting a locale. An engine with
 * both languages installed would therefore have the Polish vocabulary put `in`
 * back into the index that `@smartput/datetime`'s accept-gate consults, and "in
 * 3 days" would read as an all-units phrase again — the exact regression the
 * `en` reservation exists to prevent, reintroduced from the side the
 * reservation does not cover. A Polish reader types `cal`, so the omission
 * costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Polish words for the length units — the same eight units `en` next door
 * names, each with the same answer to "does this unit have words at all?". All
 * eight do: Polish declines every one of them, and nobody writes a length the
 * way they write `30 m²`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Polish engine and
 * the micro path (`parseLength`) cannot drift from it. The Polish spellings are
 * appended, in every case a reader is plausibly going to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper carries `weight: -2` precisely so an exact entry here outranks
 * anything it guesses.
 *
 * Eight `forms` keys per unit, because `polish.selectForm` returns
 * `` `${case}-${category}` ``: the case from the slot (locative for a
 * conversion target, which is what `w` governs — "w 5 metrach", never "w 5
 * metrów"), the category from CLDR's four. Three rows are worth naming:
 *
 *   `nom-many` is the 0/5–21/teens row, genitive plural, and it reaches **21**.
 *   Polish writes "21 metrów" where Ukrainian writes "21 метр": every -1 above
 *   twenty is `many` here and `one` there, so a table ported from `uk.ts` prints
 *   a nominative singular at 21, 101 and 1001 and looks like a typo.
 *
 *   `nom-other` is the **fractional** category, and in Polish that is the
 *   genitive *singular*: "1,5 metra", never "1,5 metrów". A plural there is the
 *   mistake no other test in this repo would catch.
 *
 *   `loc-other` is the count-free conversion target ("w metrach") — a unit word
 *   chosen with no magnitude in hand at all. It holds a different word from
 *   `nom-other` for that reason, and filling both cells from one string is
 *   wrong in both directions.
 *
 * The four metric units and `jard` share one masculine hard paradigm, and even
 * there the locative singular is not a suffix: `metr` takes r→rz and comes out
 * `metrze`, `jard` takes d→dz and comes out `jardzie`. The other three units are
 * each their own paradigm and not a variation on it:
 *
 *   `cal` is a soft-stem masculine, so its nominative plural is `cale` and its
 *   genitive plural `cali` — the -i ending, not the -ów the hard stems take —
 *   and its locative singular is `calu`.
 *
 *   `stopa` is feminine, and its genitive plural is the **bare stem with an
 *   ablaut**: "5 stóp", o→ó, a form no suffix rule can produce and no stem list
 *   would contain unless it were written out. It is listed as an alias for
 *   exactly that reason.
 *
 *   `mila` is feminine too but soft, so its genitive singular (`mili`) and its
 *   nominative plural (`mile`) are *different* strings where `stopa`'s are the
 *   same one (`stopy` for both). Pasting either feminine paradigm over the other
 *   produces forms that look Polish and are wrong.
 *
 * `symbol` is the SI abbreviation where Polish uses one — `mm`, `cm`, `m`, `km`
 * are written exactly as in English — and the spelled nominative singular for
 * the three imperial units, which Polish writes out and has no accepted
 * abbreviation for. R8 wants an explicit symbol on every unit, not an invented
 * one.
 *
 * Like `en`, this file names `length` by id string and never imports the kind,
 * which is what lets `@smartput/length/locale/pl` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "length",
  units: {
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
    // The r→rz alternation in the locative singular, on the shortest stem in the
    // file: "w 1 metrze". Nothing in `polish.analyze` recovers it, because
    // stripping the ending leaves `metrz` and the aliases are built on `metr`.
    m: {
      aliases: [
        ...alias("m"),
        "metr",
        "metra",
        "metrowi",
        "metrze",
        "metrem",
        "metry",
        "metrów",
        "metrom",
        "metrach",
        "metrami",
      ],
      symbol: "m",
      forms: {
        "nom-one": "metr",
        "nom-few": "metry",
        "nom-many": "metrów",
        "nom-other": "metra",
        "loc-one": "metrze",
        "loc-few": "metrach",
        "loc-many": "metrach",
        "loc-other": "metrach",
      },
    },
    km: {
      aliases: [
        ...alias("km"),
        "kilometr",
        "kilometra",
        "kilometrowi",
        "kilometrze",
        "kilometrem",
        "kilometry",
        "kilometrów",
        "kilometrom",
        "kilometrach",
        "kilometrami",
      ],
      symbol: "km",
      forms: {
        "nom-one": "kilometr",
        "nom-few": "kilometry",
        "nom-many": "kilometrów",
        "nom-other": "kilometra",
        "loc-one": "kilometrze",
        "loc-few": "kilometrach",
        "loc-many": "kilometrach",
        "loc-other": "kilometrach",
      },
    },
    // Soft-stem masculine: `cale` where the hard stems give `-y`, `cali` where
    // they give `-ów`, and a locative singular in `-u` rather than `-e`.
    in: {
      aliases: [
        ...alias("in"),
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
    // Feminine hard stem, and the one genitive plural in this package that is a
    // bare stem *plus* a vowel change: "5 stóp". Its genitive singular and its
    // nominative plural are the same string, `stopy`, which is why the 2/3/4 row
    // and the fractional row agree here and diverge on every masculine unit
    // above.
    ft: {
      aliases: [
        ...alias("ft"),
        "stopa",
        "stopy",
        "stopie",
        "stopę",
        "stopą",
        "stóp",
        "stopom",
        "stopach",
        "stopami",
      ],
      symbol: "stopa",
      forms: {
        "nom-one": "stopa",
        "nom-few": "stopy",
        "nom-many": "stóp",
        "nom-other": "stopy",
        "loc-one": "stopie",
        "loc-few": "stopach",
        "loc-many": "stopach",
        "loc-other": "stopach",
      },
    },
    yd: {
      aliases: [
        ...alias("yd"),
        "jard",
        "jarda",
        "jardowi",
        "jardzie",
        "jardem",
        "jardy",
        "jardów",
        "jardom",
        "jardach",
        "jardami",
      ],
      symbol: "jard",
      forms: {
        "nom-one": "jard",
        "nom-few": "jardy",
        "nom-many": "jardów",
        "nom-other": "jarda",
        "loc-one": "jardzie",
        "loc-few": "jardach",
        "loc-many": "jardach",
        "loc-other": "jardach",
      },
    },
    // The soft feminine. `mili` fills the genitive and the locative singular,
    // `mile` the nominative plural and `mil` the genitive plural — three
    // distinct strings where `stopa` above has two, which is the whole reason
    // these two tables are written out separately.
    mi: {
      aliases: [
        ...alias("mi"),
        "mila",
        "mili",
        "milę",
        "milą",
        // "mile" is already in `alias("mi")` — it is English's plural, spelled
        // exactly like the Polish nominative plural — so it is not repeated
        // here. The two languages agreeing on a surface is the ordinary case.
        "mil",
        "milom",
        "milach",
        "milami",
      ],
      symbol: "mila",
      forms: {
        "nom-one": "mila",
        "nom-few": "mile",
        "nom-many": "mil",
        "nom-other": "mili",
        "loc-one": "mili",
        "loc-few": "milach",
        "loc-many": "milach",
        "loc-other": "milach",
      },
    },
  },
});
