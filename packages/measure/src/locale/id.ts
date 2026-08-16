import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Indonesian words for the typographic units — the same six `en`, `uk` and `nl`
 * name, with the same answer to "does this unit have words at all?": all six do.
 *
 * **One `forms` key per unit, and that is the entire grammar of this file.**
 * `indonesian.selectForm` is the constant `() => "other"`. This is the kind
 * where Dutch keeps its measure rule and its exception side by side — `12 punt`
 * measured out beside `1920 pixels` counted — and Indonesian has neither, because
 * there is no grammatical number to divide: "satu piksel", "1920 piksel" and
 * "dalam piksel" are one word in three positions. No gender, no case, no
 * article, so a conversion target needs no row of its own either.
 * `Intl.PluralRules("id")` declares the single category `"other"`, so rule 6's
 * "exactly the keys `selectForm` can produce" is one row per unit, where
 * `@smartput/measure/locale/de` needs four cells to hold the dative "in Pixeln".
 *
 * **`piksel` and `inci` are the two units Indonesian genuinely nativised**, and
 * both are KBBI headwords: Indonesian respells a loan to its own orthography
 * rather than keeping the English spelling, so `pixel` becomes `piksel` and
 * `inch` becomes `inci`. Both English spellings come from `units.ts` and stay
 * listed for reading; only the Indonesian ones are printed.
 *
 * **`poin` is the typographic point, and it is a score first.** Indonesian
 * respells the loan the same way (`point` → `poin`) and uses it for type size —
 * "ukuran huruf 12 poin" — as readily as for a point on a scoreboard. That is
 * the polysemy English `point` already carries, and it is resolved the same way:
 * a bare `poin` with no numeral in front of it is not a quantity at all, and
 * nothing else in this engine claims the word. The native `titik` is
 * deliberately **not** listed: it means a dot or a full stop, not a unit of type,
 * and a reader who writes it is not measuring anything.
 *
 * **`pica` keeps its English spelling, and `pika` is the reason.** Indonesian
 * typography borrows the word unchanged; the respelled `pika` that Indonesian
 * orthography would produce is already taken by the eating disorder, which is
 * what a dictionary lookup returns and what a search box would be full of.
 * Listing it would claim a word Indonesian uses for something else in a kind
 * that has no way to tell the two apart. This is `@smartput/measure/locale/nl`'s
 * ruling about `cicero` and `augustijn` arriving from the other direction: there
 * the near-synonym named a *different unit* (twelve Didot points) and had to
 * stay out; here it names a different *thing* entirely.
 *
 * **`milimeter` and `sentimeter` are the Indonesian spellings.** Indonesian took
 * its metric vocabulary through Dutch and simplified the doubled consonant, so a
 * millimetre has one `l`; it also writes the Latin `c` of *centi-* as the `s` it
 * is pronounced with, where Dutch keeps the `c` and German writes `Zentimeter`.
 * Both are added beside the English spellings `units.ts` declares.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in an Indonesian engine
 * and the micro path (`parseMeasure`) cannot drift from it.
 *
 * **There is no stripper behind these aliases.** `indonesian.analyze` is
 * `identity()` alone — Indonesian affixation is derivational and never lands on
 * a measure noun after a numeral — so a form this file prints and forgets to
 * list is unreachable, with nothing to recover it at a penalty. No folding is
 * needed on either side of that check: Indonesian capitalises no noun.
 *
 * `symbol` follows `uk`'s and `nl`'s split for their reason. The three
 * typographic units keep their Latin abbreviations — `pt`, `pc` and `px` are
 * what an Indonesian designer writes in a stylesheet, and inventing an
 * Indonesian short form would be a word this file made up rather than one
 * anybody types. The two metric units get the SI abbreviations Indonesian itself
 * writes. The inch gets `inci`, its own noun: Indonesian abbreviates it with a
 * double prime (`5″`) which `lex` cannot read, so the spelled word is the only
 * short form that round-trips — R8 wants an explicit symbol on every unit, never
 * an unreadable one.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/id` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "id",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "inci"],
      symbol: "inci",
      forms: { other: "inci" },
    },
    mm: {
      aliases: [...alias("mm"), "milimeter"],
      symbol: "mm",
      forms: { other: "milimeter" },
    },
    cm: {
      aliases: [...alias("cm"), "sentimeter"],
      symbol: "cm",
      forms: { other: "sentimeter" },
    },
    pt: {
      aliases: [...alias("pt"), "poin"],
      symbol: "pt",
      forms: { other: "poin" },
    },
    // `pika` is deliberately absent; see the header. The English spelling comes
    // from `units.ts` and is what an Indonesian typesetter writes, so this entry
    // adds no word of its own — only the decision that this is the one printed.
    pc: {
      aliases: [...alias("pc")],
      symbol: "pc",
      forms: { other: "pica" },
    },
    px: {
      aliases: [...alias("px"), "piksel"],
      symbol: "px",
      forms: { other: "piksel" },
    },
  },
});
