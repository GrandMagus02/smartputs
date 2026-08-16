import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Indonesian words for the area units — the same five `en`, `uk` and `nl` name,
 * and the same per-unit answer to "does this unit have words at all?" that `en`,
 * `uk` and `nl` give, **against** the one `de` gives.
 *
 * **The three squared units carry no `forms`, and Indonesian has less room to
 * escape that than any language here.** English and Ukrainian refuse a table
 * because the spoken name is a *phrase* — "square metres", "квадратних метрів"
 * — and `lex` ends a word token at a space, so a printed phrase is text no
 * single analyzer is ever handed and `assertLocaleContract` fails it by name.
 * German escapes it by writing the concept as one token, `Quadratmeter`; Dutch
 * does not, because `vierkante meter` is an inflected adjective plus a noun.
 * Indonesian is further out than Dutch on both counts: the name is `meter
 * persegi`, the qualifier *follows* the head as every Indonesian modifier does,
 * and the language does not compound at all — so unlike `nl.ts`, which can list
 * the closed-up `vierkantemeter` as a spelling a reader really produces in a
 * search box, there is no plausible single token here to list for reading
 * either. `meterpersegi` is not a word anybody types, and inventing it would be
 * inventing Indonesian. So these three units are reachable exactly through what
 * `units.ts` already gives — `m²`, `m2`, `sqm` and their siblings — and they
 * render through their symbol.
 *
 * **Which is where this language's one deliberate cost lands.**
 * `@smartput/core/locale/id` ships no `renderQuantity`, and argues it can afford
 * not to because `defaultRenderQuantity` sets a symbol tight while every unit of
 * a translated Indonesian vocabulary has a `forms` row and so takes the spaced
 * word branch. These three units are the exception that argument did not have in
 * view: with no `forms` to print, an Indonesian engine answers "10m²" where
 * Indonesian typography, following SI, writes "10 m²". It is the same string
 * English produces and the same one Ukrainian produces, so nothing is *worse*
 * here than in the languages that shipped before — but a reader arriving from
 * `@smartput/area/locale/nl`, where `dutch.renderQuantity` spaces a symbol and
 * the answer is "10 m²", should know the difference is the language file and not
 * this one. Adding a `renderQuantity` to `id` for a space on three units of one
 * kind would spend the claim that file exists to make; the honest record is this
 * paragraph.
 *
 * **`hektare` is spelled with a `k`, and it is the unit Indonesia actually
 * measures land in.** `hektar` is the equally current shorter spelling and is
 * listed beside it; only `hektare`, the KBBI headword, is printed. `ha` comes
 * from `units.ts` and is the symbol.
 *
 * **The acre is the loan kept unchanged, and `are` is the trap next to it.**
 * Indonesian has a live unit spelled `are` — 100 m², the hundredth of a hectare,
 * and the very word *hectare* is built from it — which is a different quantity
 * from the acre by a factor of forty. This kind declares no 100 m² unit, so
 * `are` has nothing correct to resolve to and is left unclaimed entirely rather
 * than pointed at the nearest thing: a refusal (`NoCandidateError`) says "this
 * engine does not know *are*", and a fortyfold error says nothing at all. That
 * is `@smartput/measure/locale/nl`'s ruling about `cicero` in a different kind.
 * Indonesian land documents do use the English `acre` when they mean it, and
 * `units.ts` already declares that spelling, so this unit adds no word of its
 * own.
 *
 * **One `forms` key on the two units that have a table.**
 * `indonesian.selectForm` is the constant `() => "other"`: no grammatical
 * number, no gender, no case, so "dua hektare", "1,5 hektare" and "dalam
 * hektare" are one word in three positions. `Intl.PluralRules("id")` declares
 * the single category `"other"` (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in an Indonesian engine
 * and the micro path (`parseArea`) cannot drift from it. That map already
 * carries the superscripts `m²`, `cm²` and `km²`, which Indonesian writes
 * exactly as English does, and their digit-2 twins for a keyboard that cannot
 * produce one.
 *
 * **There is no stripper behind these aliases.** `indonesian.analyze` is
 * `identity()` alone, so a form this file prints and forgets to list is
 * unreachable, with nothing to recover it at a penalty. No folding is needed on
 * either side of that check: Indonesian capitalises no noun.
 *
 * Like `en`, this file names `area` by **id string** and never imports the kind,
 * which is what lets `@smartput/area/locale/id` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "id",
  kind: "area",
  units: {
    m2: { aliases: [...alias("m2")], symbol: "m²" },
    cm2: { aliases: [...alias("cm2")], symbol: "cm²" },
    km2: { aliases: [...alias("km2")], symbol: "km²" },
    hectare: {
      aliases: [...alias("hectare"), "hektare", "hektar"],
      symbol: "ha",
      forms: { other: "hektare" },
    },
    // `are` is deliberately absent; see the header. The English spelling comes
    // from `units.ts` and is what an Indonesian land document writes when it
    // means this unit, so this entry adds no word of its own.
    acre: {
      aliases: [...alias("acre")],
      symbol: "acre",
      forms: { other: "acre" },
    },
  },
});
