import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Russian words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — and the one thing that differs is the only thing that is allowed
 * to: how many keys a `forms` table has. English needs two because
 * `Intl.PluralRules("en")` has two categories. Russian needs eight, because
 * `russian.selectForm` composes a grammatical case with a plural category and an
 * angle word inflects for both. The key names are `uk`'s — `loc` for what
 * Russian grammar calls the *prepositional* case — because the two Slavic
 * vocabularies are the ones most likely to be ported one into the other, and
 * `@smartput/core/locale/ru` records that ruling in full.
 *
 * The eight keys, and why each is a different word rather than a stem plus a
 * rule the engine could have applied itself:
 *
 * ```
 * nom-one    1, 21, 101    "1 градус"        nominative singular
 * nom-few    2, 3, 4, 22   "2 градуса"       genitive SINGULAR
 * nom-many   0, 5-20, 100  "5 градусов"      genitive plural
 * nom-other  1,5           "1,5 градуса"     genitive singular again
 * loc-one    1             "в 1 градусе"     prepositional singular
 * loc-few    2, 3, 4       "в 2 градусах"    prepositional plural
 * loc-many   5-20          "в 5 градусах"    prepositional plural
 * loc-other  no count      "в градусах"      prepositional plural
 * ```
 *
 * `nom-few` is where Russian and Ukrainian part company, and it is the reason
 * this file is not `uk.ts` with the stems respelled. Ukrainian puts a
 * *nominative plural* after 2/3/4 ("2 градуси") and so has four distinct
 * nominative rows; Russian puts a genitive singular there, which makes `nom-few`
 * and `nom-other` the same word and `nom-one` and `nom-few` different ones. Copy
 * the Ukrainian grouping across and every fractional angle in the app reads
 * "1,5 градусов".
 *
 * `loc-other` is the row the old one-dimensional `display` table could not
 * express at all: a conversion target names a unit with no magnitude attached to
 * it ("1 оборот в градусах" has nothing to count degrees by), so the count is
 * absent and the case still has to be prepositional — that is what `в` governs.
 *
 * `радиан` is the odd unit here and is odd for a reason worth stating: its
 * genitive plural is the **bare stem**, "5 радиан", not "*5 радианов". Russian
 * puts most technical units of measure in that zero-ending class — ампер, ватт,
 * вольт, ом, герц, радиан — so `nom-one` and `nom-many` hold the same string
 * while `nom-few` differs from both. The other three units in this file are
 * ordinary masculine hard stems and take -ов.
 *
 * Aliases are the Latin ones from `units.ts` — a Russian keyboard types "2 rad"
 * as readily as "2 рад" — with the Cyrillic spellings appended in every
 * inflected form a reader might actually type. This list is what the analyzer
 * falls back *from*: `russian`'s suffix stripper only has to catch the forms
 * nobody thought to write down here, and it is penalised (weight -2) so that an
 * exact entry always wins.
 *
 * `гон` is listed beside `град` as an alias-only synonym. ГОСТ names the unit
 * `град` and that is what this file prints; `гон` is the older term and still
 * turns up, so it reads. Nothing prints it — recognition is many-to-one while
 * generation stays one.
 *
 * Symbols are the ones Russian genuinely uses: `рад`, `°`, `град`, `об` (the
 * `об` of "об/мин"), each also listed as an alias so a printed symbol reads back.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "angle",
  units: {
    rad: {
      aliases: [
        ...alias("rad"),
        "рад",
        "радиан",
        "радиана",
        "радиану",
        "радиане",
        "радианом",
        "радианы",
        "радианов",
        "радианам",
        "радианах",
        "радианами",
      ],
      symbol: "рад",
      forms: {
        "nom-one": "радиан",
        "nom-few": "радиана",
        // The zero-ending genitive plural: "5 радиан", the same string as the
        // nominative singular. "радианов" is listed as an alias above because it
        // is written often enough to have to read, but it is not what prints.
        "nom-many": "радиан",
        "nom-other": "радиана",
        "loc-one": "радиане",
        "loc-few": "радианах",
        "loc-many": "радианах",
        "loc-other": "радианах",
      },
    },
    deg: {
      aliases: [
        ...alias("deg"),
        "°",
        "градус",
        "градуса",
        "градусу",
        "градусе",
        "градусом",
        "градусы",
        "градусов",
        "градусам",
        "градусах",
        "градусами",
      ],
      // "°" and not a letter abbreviation: Russian writes "90°", and the only
      // written short form for an angular degree is the sign. `град.` would be
      // the letter abbreviation, and it is exactly the string `grad` claims
      // below — a symbol nobody could read twice.
      //
      // The alias above does not currently make it readable, and that is worth
      // stating rather than leaving for someone to rediscover: `normalize()`
      // deletes "°" outright (`EditReason` "degree"), so "90°" reaches `lex` as
      // a bare number and evaluates to `number:one`, never to an angle. The
      // alias is therefore inert today and is kept as the declaration of intent
      // — the day the degree sign survives normalization it is already listed —
      // exactly as `fr.ts` and `id.ts` keep theirs. Nothing is lost by it in the
      // meantime: this unit has `forms`, so the renderer prints "90 градусов"
      // and the sign is only ever reached through `Printer`'s `symbols: true`,
      // which `PrintOptions.symbols` already documents as free to break the
      // round trip. Substituting "град" to make it read back is not the fix; it
      // is the string `grad` claims below, and two units answering to one word
      // is worse than a symbol that only prints.
      symbol: "°",
      tight: true,
      forms: {
        "nom-one": "градус",
        "nom-few": "градуса",
        "nom-many": "градусов",
        "nom-other": "градуса",
        "loc-one": "градусе",
        "loc-few": "градусах",
        "loc-many": "градусах",
        "loc-other": "градусах",
      },
    },
    grad: {
      aliases: [
        ...alias("grad"),
        "град",
        "града",
        "граду",
        "граде",
        "градом",
        "грады",
        "градов",
        "градам",
        "градах",
        "градами",
        "гон",
        "гона",
        "гону",
        "гоне",
        "гоном",
        "гоны",
        "гонов",
        "гонам",
        "гонах",
        "гонами",
      ],
      symbol: "град",
      forms: {
        "nom-one": "град",
        "nom-few": "града",
        "nom-many": "градов",
        "nom-other": "града",
        "loc-one": "граде",
        "loc-few": "градах",
        "loc-many": "градах",
        "loc-other": "градах",
      },
    },
    turn: {
      // "оборот" is the Russian word for a full revolution — "об/мин" is the
      // abbreviation every tachometer carries — and it declines as an ordinary
      // masculine hard stem. Ukrainian's "оберт" is the cognate and is not a
      // Russian word; nothing here is a respelling of it.
      aliases: [
        ...alias("turn"),
        "об",
        "оборот",
        "оборота",
        "обороту",
        "обороте",
        "оборотом",
        "обороты",
        "оборотов",
        "оборотам",
        "оборотах",
        "оборотами",
      ],
      symbol: "об",
      forms: {
        "nom-one": "оборот",
        "nom-few": "оборота",
        "nom-many": "оборотов",
        "nom-other": "оборота",
        "loc-one": "обороте",
        "loc-few": "оборотах",
        "loc-many": "оборотах",
        "loc-other": "оборотах",
      },
    },
  },
});
