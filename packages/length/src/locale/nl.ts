import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `es` and `de` next door make, and here it is
 * over-determined exactly as it is in German.
 *
 * Dutch's own conversion keywords are `in` and `naar`
 * (`@smartput/core/locale/nl`), and the first of them is spelled exactly like
 * the English one — `buildKeywords` folds the two into a single entry rather
 * than refusing them. So `lex` emits `in` as a keyword token in a Dutch engine
 * exactly as it does in an English one, and a vocabulary entry for it is
 * unreachable on the engine path. On top of that, `registry.aliasIndex` is one
 * flat map that `MatchCtx.isUnitAlias` reads without consulting a locale, so a
 * Dutch entry would put `in` back in front of `@smartput/datetime`'s
 * accept-gate for any engine speaking both languages and make "in 3 days" an
 * all-units phrase again.
 *
 * A Dutch reader types `inch` or `duim`, so the omission costs this vocabulary
 * nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Dutch words for the length units — the same eight `en`, `uk`, `es` and `de`
 * name, and the same answer to "does this unit have words at all?": all eight
 * do. Dutch writes a length out as readily as English does.
 *
 * **Two `forms` keys, not German's four.** `dutch.selectForm` returns the bare
 * CLDR plural category, so the key set is exactly `one` and `other` (rule 6).
 * Modern Dutch lost its case marking on common nouns centuries ago: `in`, `naar`
 * and `van` govern nothing, so a conversion target is spelled like a bare
 * quantity and "in meter" needs no row of its own. This is the one place a
 * translator arriving from `@smartput/length/locale/de` — which writes "in
 * Metern" with a dative `-n` and needs a second axis to hold it — must not carry
 * the German shape across.
 *
 * **And not one of these eight moves on the number axis, which is the Dutch
 * rule that shapes every table below.** A Dutch measure noun stays singular
 * after a numeral: "tien meter", "vijf kilometer", "drie voet", "vijf mijl". So
 * `one` and `other` hold the same word in all eight tables, and a table that
 * wrote a plural into the `other` row would be inventing Dutch rather than
 * completing it. The free nouns do have plurals — `meters`, `mijlen`, `voeten`,
 * `duimen` — and every one of them is listed as an alias so a reader who types
 * one is understood, but none is ever printed. Reading and printing are separate
 * decisions and only printing has to round-trip.
 *
 * The contrast that makes this a rule rather than a shrug is
 * `@smartput/angle/locale/nl`, where `graad`/`graden` and
 * `omwenteling`/`omwentelingen` do move: Dutch counts angles and measures out
 * lengths, and marks the difference. `@smartput/measure/locale/nl` has the same
 * split inside one kind — `12 punt` beside `1920 pixels`.
 *
 * **Compounds are the reason this language has a splitter at all.**
 * `centimeter`, `kilometer` and `millimeter` are single tokens, and so is
 * `bandmeter`, which no vocabulary would ever list. `compoundSplitter` reads the
 * last element of a Germanic compound — the head, since a Germanic compound is
 * right-headed — at a `-3` penalty, and every word this file lists exactly is an
 * alias at weight 0. That ordering is what makes `10 centimeter` a centimetre
 * rather than the `meter` hiding inside it.
 *
 * **No capitals, and this is the German stress Dutch does not share.** Dutch
 * capitalises no noun: `meter` is lowercase in running text, in a search box and
 * in a printed result alike. `de.ts` next door prints `Meter` and indexes
 * `meter`, and its tests fold both sides to compare them; nothing here needs to,
 * because the two halves of this file are the same strings. A translator who
 * assumes German's rules carry over writes a vocabulary of capitalised nouns
 * that no Dutch reader would type.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Dutch engine and the
 * micro path (`parseLength`) cannot drift from it. That map already carries the
 * US spellings `meter`, `millimeter`, `centimeter` and `kilometer`, which are
 * the Dutch words unchanged — Dutch spells the prefix with a `c`, where German
 * writes `Zentimeter` — so what this file adds is the four imperial nouns and
 * the plurals a reader might type.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Dutch itself writes ("5 km", never "5 kilom."), and the spelled singular
 * on the four imperial ones. Dutch abbreviates none of those: where a short form
 * appears at all it is the English one, which `units.ts` already registers as an
 * alias, so claiming it as the *Dutch* symbol would print `36in` at a reader who
 * wrote `duim` — and `in` is not lexable here anyway, which is the very gap
 * `assertLocaleContract`'s `skipPrintable` exists for in English. R8 wants an
 * explicit symbol on every unit, never an invented one.
 *
 * Like `en`, this file names `length` by **id string** and never imports the
 * kind, which is what lets `@smartput/length/locale/nl` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm")],
      symbol: "mm",
      forms: { one: "millimeter", other: "millimeter" },
    },
    // Dutch writes `centimeter` with a `c`, so `units.ts`'s US spelling is the
    // Dutch word and nothing has to be added — where `@smartput/length/locale/de`
    // has to add `Zentimeter` because German spells the same prefix with a `z`.
    cm: {
      aliases: [...alias("cm")],
      symbol: "cm",
      forms: { one: "centimeter", other: "centimeter" },
    },
    // `de meter`. Both rows are the same word, which is the measure rule and not
    // a table stopping halfway: "tien meter", never "tien meters". The plural
    // `meters` is a real Dutch word — it is what you count tape measures in —
    // and `units.ts` already lists it for reading.
    m: {
      aliases: [...alias("m")],
      symbol: "m",
      forms: { one: "meter", other: "meter" },
    },
    km: {
      aliases: [...alias("km")],
      symbol: "km",
      forms: { one: "kilometer", other: "kilometer" },
    },
    // `de inch` is the everyday Dutch word — screens, pipes and wheels are all
    // sold in it — and `de duim` is the older native one, still current in
    // Belgium and in carpentry. `inch` is printed because it is the spelling a
    // Dutch reader will recognise on sight; `duim` and `duimen` are listed for
    // reading. Note that `@smartput/core/locale/nl` deliberately keeps `duim`
    // out of its compound heads, because a `duim` is a thumb before it is a
    // unit — a head list containing it would read every compound of the body
    // part as a measurement.
    in: {
      aliases: [...alias("in"), "duim", "duimen"],
      symbol: "inch",
      forms: { one: "inch", other: "inch" },
    },
    // `de voet`, invariant after a numeral ("zes voet") and with the ordinary
    // plural `voeten` listed for reading. `voet` is the other head
    // `@smartput/core/locale/nl` leaves out for the body-part reason, so this
    // unit is reachable only through the aliases written here — which is
    // exactly what a vocabulary is for.
    ft: {
      aliases: [...alias("ft"), "voet", "voeten"],
      symbol: "voet",
      forms: { one: "voet", other: "voet" },
    },
    // A loan Dutch keeps unchanged, spelling and all, so `units.ts` has already
    // declared every form this unit needs — including the `-s` plural, which
    // Dutch writes for the free noun but not after a numeral.
    yd: {
      aliases: [...alias("yd")],
      symbol: "yard",
      forms: { one: "yard", other: "yard" },
    },
    // `de mijl`, plural `mijlen`, and invariant after a numeral all the same:
    // "hij liep vijf mijl". `@smartput/length/locale/de` prints `Meilen` in the
    // corresponding row because German's feminine measure nouns do take their
    // plural — the one place these two languages give opposite answers about the
    // same unit.
    mi: {
      aliases: [...alias("mi"), "mijl", "mijlen"],
      symbol: "mijl",
      forms: { one: "mijl", other: "mijl" },
    },
  },
});
