import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * German words for the duration units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. The shape is `en.ts`'s unit
 * for unit — the same `kind` id string (never an import of the kind), `aliases`
 * derived from `units.ts` rather than retyped, an explicit `symbol` everywhere
 * (ruling R8) — and what differs is the `forms` table.
 *
 * **Four keys, on two axes.** `german.selectForm` answers
 * `` `${case}-${category}` `` over {nom, dat} × {one, other}: the case from the
 * slot, because a conversion target is governed by "in"/"nach"/"zu" and German's
 * locative "in" takes the dative, and the category from
 * `Intl.PluralRules("de")`, which declares exactly two. That is a smaller table
 * than Ukrainian's eight and a bigger one than English's two, and the interest
 * is not in its size but in **which axis moves**:
 *
 * ```
 * nom-one    1        "1 Stunde"     "1 Tag"
 * nom-other  0, 2, 5  "2 Stunden"    "2 Tage"
 * dat-one    1        "in 1 Stunde"  "in 1 Tag"
 * dat-other  0, 2, 5  "in Stunden"   "in Tagen"
 * ```
 *
 * `Tag` is the unit this file exists to get right. It is a strong masculine, so
 * all three of its distinct forms show up in one column: `Tag` in the singular
 * of both cases, `Tage` in the nominative plural, and `Tagen` in the dative
 * plural — the German `-n` that English marks nowhere and Ukrainian marks with a
 * different case entirely. Every other unit here is a feminine (Millisekunde,
 * Sekunde, Minute, Stunde, Woche), and a feminine noun's dative plural is
 * already its nominative plural, so those five have two distinct strings where
 * `Tag` has three. Copying the feminine pattern onto `Tag` would print
 * "in 7 Tage", which is wrong and which no round-trip test can see — both
 * spellings read back to the same unit.
 *
 * **Symbols.** `ms`, `s`, `min`, `h` and `d` are SI's own and are what German
 * writes; each is already a derived alias, so the printed symbol parses back by
 * construction. `wk` is the exception: German has no settled one-token
 * abbreviation for the week — "Wo." and "Wchn" both appear and "KW" is the
 * *calendar* week, a different thing — so ruling R8's fallback applies and the
 * symbol is the spelled nominative singular, `Woche`. Inventing "Wo" to look
 * like an abbreviation would be inventing a symbol, which R8 forbids.
 *
 * **Aliases.** The Latin set is reused from `units.ts` rather than retyped — a
 * German developer types "2 h" as readily as "2 Stunden" — and the German
 * spellings are appended. They are written out in both numbers rather than left
 * to the language's `suffixStripper`: the stripper is what the analyzer falls
 * back *from*, and a form recovered only through its `-2` penalty reads back by
 * accident. `sek` and `std` are the clipped forms German writes with a full stop
 * ("Sek.", "Std."), listed without it because "." is not a letter — `parse/lex.ts`
 * builds a word token from letters plus trailing digits, so "2 Std." arrives as
 * "Std" and the dot is skipped as an unrecognised character.
 *
 * **`tag` is an alias here even though `german` deliberately keeps it out of its
 * compound heads**, and the two facts do not conflict — they are different
 * mechanisms. `compoundSplitter` cuts an unknown word at a known tail, so a head
 * list containing `tag` would read *Montag*, *Dienstag* and the other five
 * weekday names as counts of days; the alias index matches a whole token
 * exactly, so listing "tag" claims "Tag" and claims nothing else. `de.test.ts`
 * pins both halves.
 */
export default defineVocabulary({
  locale: "de",
  kind: "duration",
  units: {
    // The five feminines. `nom-other` and `dat-other` are the same string
    // throughout, because a German feminine forms its plural in `-n` and the
    // dative plural has nowhere further to go — the axis that moves for `Tag`
    // below is inert here, which is the German fact and not a table stopping
    // halfway.
    ms: {
      aliases: [...alias("ms"), "millisekunde", "millisekunden"],
      symbol: "ms",
      forms: {
        "nom-one": "Millisekunde",
        "nom-other": "Millisekunden",
        "dat-one": "Millisekunde",
        "dat-other": "Millisekunden",
      },
    },
    s: {
      aliases: [...alias("s"), "sek", "sekunde", "sekunden"],
      symbol: "s",
      forms: {
        "nom-one": "Sekunde",
        "nom-other": "Sekunden",
        "dat-one": "Sekunde",
        "dat-other": "Sekunden",
      },
    },
    min: {
      aliases: [...alias("min"), "minute", "minuten"],
      symbol: "min",
      forms: {
        "nom-one": "Minute",
        "nom-other": "Minuten",
        "dat-one": "Minute",
        "dat-other": "Minuten",
      },
    },
    h: {
      aliases: [...alias("h"), "std", "stunde", "stunden"],
      symbol: "h",
      forms: {
        "nom-one": "Stunde",
        "nom-other": "Stunden",
        "dat-one": "Stunde",
        "dat-other": "Stunden",
      },
    },
    // The masculine, and the only unit in the kind whose four keys hold three
    // different words. `Tage` is the nominative plural and `Tagen` the dative
    // plural; the dative singular stays bare ("in einem Tag"), so it is `Tag`
    // and not the archaic `Tage` a paradigm table would offer.
    d: {
      aliases: [...alias("d"), "tag", "tage", "tagen"],
      symbol: "d",
      forms: {
        "nom-one": "Tag",
        "nom-other": "Tage",
        "dat-one": "Tag",
        "dat-other": "Tagen",
      },
    },
    wk: {
      aliases: [...alias("wk"), "woche", "wochen"],
      symbol: "Woche",
      forms: {
        "nom-one": "Woche",
        "nom-other": "Wochen",
        "dat-one": "Woche",
        "dat-other": "Wochen",
      },
    },
  },
});
