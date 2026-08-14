import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * French words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — because the one thing a language may change here is how many
 * keys a `forms` table has, and French needs the same two English does. What it
 * does *not* share with English is where the boundary between them falls.
 *
 * **Singular below two.** `french.selectForm` returns `one` or `other`, and
 * French puts the singular on 0, on 1 and on every fraction under two: "zéro
 * degré", "1,5 degré", where English writes "1.5 degrees". `other` starts at 2
 * and also covers the count-free conversion target (ruling R5), which is what
 * French grammar wants anyway — "1 tour en degrés" names the target in the
 * plural. Ukrainian next door needs eight keys because it composes a
 * grammatical case with a plural category; French composes nothing, so a third
 * row would be a word no count could ever select (rule 6), including the `many`
 * category CLDR declares for French and `fr.ts` deliberately folds into
 * `other`.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts` — "2 rad" and "1 rev" keep working in a
 * French engine — and here the reuse covers more than usual, because two of the
 * four unit names are French words English borrowed without changing a letter:
 * `radian`/`radians` and `revolution`/`revolutions` are already in the index in
 * both numbers, and `gon` is the international name French itself uses. Only
 * the genuinely French spellings are appended, singular and plural both,
 * because every string this file *prints* has to be a string it reads.
 *
 * Three of the four need a word of explanation:
 *
 *   `degré` → `degrés` moves nothing and adds the ordinary `-s`, but the acute
 *   is on both, and NFKC folding leaves a precomposed `é` as `é` rather than
 *   stripping it. The accent-free spellings a keyboard without dead keys
 *   produces are therefore different strings to the alias index and are
 *   declared beside them rather than hoped for — `@smartput/core/locale/fr`'s
 *   own cardinal table declares "zero" beside "zéro" for exactly this reason.
 *
 *   The gradian is `grade` in French — a false friend of the English "grade",
 *   and the reason `gon` exists as an international name at all. Both are read;
 *   `gon` is the symbol, because that is the written short form, and `grade` is
 *   what is printed, because it is the French noun.
 *
 *   `tour` is what a person says ("deux tours complets") and `révolution` what a
 *   machine's datasheet says ("tours par minute" is in fact the French for RPM,
 *   which is `tour` again). Both are read; `tour` is printed, because the
 *   printer has to pick one and the everyday word is the one an unqualified
 *   number is most likely to have meant.
 *
 * `symbol` is what French genuinely writes. `rad` and `gon` are the
 * international symbols, used unchanged. `°` is the only written short form for
 * an angular degree in any Latin-script language, and it is listed as an alias
 * too so a printed `90°` reads back — see the test next door for the one place
 * that promise is not yet kept, which is a gap in core's lexing rather than in
 * this vocabulary. `tour` is the noun: French's own clipping is "tr." with a
 * period, `lex` ends a word token at the period, and R8 wants an explicit
 * symbol, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `angle` by **id string** and never
 * imports the kind, which is what lets `@smartput/angle/locale/fr` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "angle",
  units: {
    // Borrowed into English unchanged, so both numbers arrive from `units.ts`
    // already and this entry adds no alias of its own. The `forms` rows are what
    // make the French printer say them.
    rad: {
      aliases: [...alias("rad")],
      symbol: "rad",
      forms: { one: "radian", other: "radians" },
    },
    deg: {
      aliases: [...alias("deg"), "°", "degré", "degrés", "degre", "degres"],
      symbol: "°",
      forms: { one: "degré", other: "degrés" },
    },
    grad: {
      aliases: [...alias("grad"), "grade", "grades"],
      symbol: "gon",
      forms: { one: "grade", other: "grades" },
    },
    turn: {
      aliases: [...alias("turn"), "tour", "tours", "révolution", "révolutions"],
      symbol: "tour",
      forms: { one: "tour", other: "tours" },
    },
  },
});
