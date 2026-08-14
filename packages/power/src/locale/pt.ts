import { aliasesFor, defineVocabulary } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Portuguese words for the power units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` means the Brazilian default, which is what the
 * platform resolves it to as well — group ".", decimal ",". This is the one file
 * of the seven where that ruling changes a *word* rather than a separator, and
 * it is marked where it does (see `w` below).
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `power` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes. `aliases` derives the Latin set from `units.ts` rather
 * than retyping it, so the micro path (`parsePower`) and the engine path agree
 * by construction.
 *
 * **The watt family keeps the eponym**, where Spanish Hispanicises it to
 * `vatio`. ABNT and Brazilian technical prose write "watt", pluralised with the
 * borrowed -s ("dois watts"), and the prefixed forms follow Portuguese's own
 * prefix spelling: "quilowatt", "megawatt", "gigawatt" — a q where the prefix is
 * Portuguese and a w where the eponym is. That mixture looks like a typo and is
 * not; it is the same rule that gives "quilômetro" a q and "watt-hora" a w. The
 * k-spellings are listed beside them because an English datasheet and a keyboard
 * habit both produce them, and `vátio`/`vátios` is listed too — it is a real
 * European Portuguese word, dictionary-attested and essentially absent from
 * Brazilian usage, which is exactly the shape of thing a Brazilian-default
 * locale should *read* and never *print*. Recognition is many-to-one (I6);
 * generation stays on ABNT's word.
 *
 * Symbols are SI's, cased as SI cases them ("W", "kW", "MW", "GW"), where
 * `en.ts` leaves them flat; the registry folds case before indexing, so "MW" and
 * the derived alias "mw" are one key and every symbol reads back as its own
 * unit. `mw` is the megawatt here as it is in `units.ts` — the milliwatt has no
 * spelling in this kind in any language, because "mW" and "MW" fold together.
 *
 * **`hp` is the unit worth the rest of this comment, and Portuguese gets it
 * wrong in a way no test in this repo could see.** The everyday Brazilian word
 * is "cavalo" — "um carro de 150 cavalos" — and its abbreviation is "cv", from
 * *cavalo-vapor*. Neither may appear below, because **cv is not this unit**. The
 * metric *cavalo-vapor* is defined as 75 kgf·m/s = 735,49875 W, while `units.ts`
 * defines `hp` as mechanical horsepower, 550 ft·lbf/s = 745,69987158227022 W.
 * They differ by about 1,4 %, which is small enough to look like rounding and
 * large enough to be wrong: "150 cv" and "150 hp" are two different powers, and
 * registering "cv" as an alias of `hp` would quietly answer one question with
 * the other. Brazil makes this worse than Spain does, not better — a Brazilian
 * spec sheet prints both "cv" and "hp" for the same engine, at different
 * numbers — so the collision is one a reader would actually hit. A `cv` unit
 * belongs in `units.ts` with a ratio of its own if it is ever wanted, and that
 * file is the kind's language-free half, not something a translation may reach
 * into. Reported rather than worked around; `@smartput/power/locale/es` reports
 * the same gap about the same quantity.
 *
 * So `hp` keeps the international abbreviation, which Portuguese also writes
 * whenever it means this unit, and it carries **no `forms`**: the honest
 * Portuguese expansion, "cavalo de força", is three words, and `parse/lex.ts`
 * ends a word token at a space, so it could be printed and never read back.
 * `uk.ts` arrived at the same shape from the same lexer fact ("кінська сила" is
 * two words), and the shape is the right one — a unit whose written form is an
 * abbreviation legitimately has no word forms, while a unit whose printed words
 * cannot be read is broken output. Absent forms keep the renderer on the symbol,
 * so a Portuguese `hp` prints "150hp".
 */
export default defineVocabulary({
  locale: "pt",
  kind: "power",
  units: {
    w: {
      aliases: [...alias("w"), "vátio", "vátios", "vatio", "vatios"],
      symbol: "W",
      forms: { one: "watt", other: "watts" },
    },
    kw: {
      // "kilowatt" and "kilowatts" arrive from `units.ts`, so only the
      // q-spellings are new here.
      aliases: [...alias("kw"), "quilowatt", "quilowatts"],
      symbol: "kW",
      forms: { one: "quilowatt", other: "quilowatts" },
    },
    mw: {
      // Nothing to add: "mega-" and "giga-" are spelled the same in Portuguese
      // as in English, so `units.ts` already carries both spellings of these two
      // and the `forms` values below are aliases by construction.
      aliases: alias("mw"),
      symbol: "MW",
      forms: { one: "megawatt", other: "megawatts" },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "GW",
      forms: { one: "gigawatt", other: "gigawatts" },
    },
    hp: {
      // No Portuguese alias at all, and that is the ruling above rather than an
      // omission: every colloquial Portuguese word for this quantity ("cavalo",
      // "cavalos", "cv") names the *metric* horsepower, which is a different
      // number. The aliases stay the two `units.ts` declares.
      aliases: alias("hp"),
      symbol: "hp",
    },
  },
});
