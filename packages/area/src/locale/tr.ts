import { aliasesFor, defineVocabulary } from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Turkish words for the area units — the same five `en`, `uk` and `de` name, and
 * **a different answer for three of them than `en`, `uk`, `nl` and `id` give.**
 *
 * **The squared units carry `forms` here, and Turkish reaches that the same way
 * German does.** The reason `en` and `uk` refuse a table was never that the unit
 * is unspeakable; it is that the spoken name is a *phrase* — "square metres",
 * "квадратних метрів" — and `lex` ends a word token at a space, so no analyzer
 * is ever handed the whole thing and `assertLocaleContract` fails a printed
 * phrase by name. Turkish writes the concept as a single closed token:
 * `metrekare`, `santimetrekare`, `kilometrekare` are all headwords of TDK's
 * spelling guide, written solid, and "yüz metrekare daire" is the ordinary way a
 * Turkish flat is measured. So the phrase problem simply does not arise, the
 * three words are listed as aliases below, and they round-trip.
 *
 * The mechanism is worth distinguishing from German's, because it looks
 * identical and is not. `Quadratmeter` is a *compound* and
 * `@smartput/area/locale/de` has to list it explicitly to beat its own
 * `compoundSplitter`, which reads the compound by its head and would otherwise
 * answer a length for every area a German typed. Turkish forms these by
 * juxtaposition rather than by compounding, and `turkish.analyze` has no
 * splitter at all — only `identity`, the suffix stripper and the case folds — so
 * nothing here is competing with the alias. The listing is load-bearing for the
 * plain reason instead: without it, "100 metrekare" reaches no reading at all,
 * because a stripper only removes endings and can never remove `kare` from the
 * front of nothing.
 *
 * Note also what the qualifier does *not* do: Turkish puts it after the head
 * ("metre" + "kare"), which is where Indonesian's `meter persegi` also puts it —
 * and Indonesian still cannot have a table, because it leaves the space in.
 * Closing the space is orthography, not word order, and it is the whole
 * difference.
 *
 * **One `forms` key per unit, keyed `other`.** `turkish.selectForm` is the
 * constant `() => "other"`: Turkish does not agree a counted noun with its
 * numeral, so "bir hektar", "beş hektar" and "1,5 hektar" are one word in three
 * numerals, and there is no gender or article for a preposition to govern
 * either. The dative that marks a conversion target ("hektara çevir") is left
 * off the axis deliberately — see `@smartput/core/locale/tr`, which rejects it
 * because vowel harmony derives the ending mechanically and a symbol target
 * takes it through an apostrophe ("ha'ya") that a `forms` table cannot spell.
 * So rule 6's "exactly the keys `selectForm` can produce" is one row per unit
 * here, against German's four.
 *
 * **`dönüm` is the trap, and it is left unclaimed.** Turkey measures land in
 * `dönüm` — the modern one is exactly 1000 m², a decare — and it is the unit a
 * Turkish reader is most likely to type in this kind. This kind declares no
 * 1000 m² unit, so `dönüm` has nothing correct to resolve to; pointing it at
 * the hectare would answer ten times the truth, and pointing it at the acre four
 * times. It is therefore left out entirely, and an engine that meets it raises
 * `NoCandidateError` — "this engine does not know dönüm" says something, where a
 * tenfold error says nothing at all. That is `@smartput/area/locale/id`'s ruling
 * about `are` and `@smartput/measure/locale/nl`'s about `cicero`, arriving here
 * from a unit that is *more* common than either.
 *
 * **`akre` is the acre, borrowed and respelled.** TDK records it, Turkish land
 * writing uses it for the English unit and nothing else, and it collides with
 * nothing in this kind. `units.ts`'s own `acre`/`acres` stay listed for reading.
 *
 * **Everything is lowercase**, because Turkish capitalises no common noun — so
 * the string this table prints is the string the alias index holds, and rule 5
 * needs none of the folding `de.test.ts` does. That is deliberate in this
 * language rather than incidental: `buildRegistry` folds alias keys with
 * `toLocaleLowerCase("tr")`, under which `I` becomes `ı` and not `i`, so a
 * capital in an alias would be indexed under a different letter than the reader
 * typed. Incoming capitals are `turkish.analyze`'s `caseFolds` to handle.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Turkish engine and
 * the micro path (`parseArea`) cannot drift from it. That map already carries
 * the superscripts `m²`, `cm²` and `km²`, which Turkish writes exactly as
 * English does, and their digit-2 twins for a keyboard that cannot produce one.
 *
 * `symbol` is what Turkish itself writes: the SI superscripts on the three
 * squared units, `ha` on the hectare, and the spelled `akre` on the one unit
 * Turkish has no abbreviation for. R8 wants an explicit symbol on every unit,
 * never an invented one.
 *
 * Like `en`, this file names `area` by **id string** and never imports the kind,
 * which is what lets `@smartput/area/locale/tr` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "area",
  units: {
    m2: {
      aliases: [...alias("m2"), "metrekare"],
      symbol: "m²",
      forms: { other: "metrekare" },
    },
    // `santimetrekare` follows `santimetre`'s spelling of *centi-* with an `s`,
    // and closes up the same way. It is the rarest of the three in running text
    // and is written solid whenever it appears at all.
    cm2: {
      aliases: [...alias("cm2"), "santimetrekare"],
      symbol: "cm²",
      forms: { other: "santimetrekare" },
    },
    km2: {
      aliases: [...alias("km2"), "kilometrekare"],
      symbol: "km²",
      forms: { other: "kilometrekare" },
    },
    hectare: {
      aliases: [...alias("hectare"), "hektar"],
      symbol: "ha",
      forms: { other: "hektar" },
    },
    // `dönüm` is deliberately absent; see the header. `akre` is the borrowing
    // Turkish uses for this unit and for nothing else.
    acre: {
      aliases: [...alias("acre"), "akre"],
      symbol: "akre",
      forms: { other: "akre" },
    },
  },
});
