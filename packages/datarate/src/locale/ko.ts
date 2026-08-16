import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Korean words for the datarate units.
 *
 * `ko` is the bare tag and means what CLDR means by it — modern standard Korean
 * in South Korean orthography. The kind next door names no language at all: it
 * is five ratios, five unit ids, the magnitude bands `typical` records and four
 * bridge signatures naming their operand kinds by string. This file names
 * `datarate` by **id string** rather than importing the kind, which is what lets
 * `@smartput/datarate/locale/ko` be imported without linking the ratio table;
 * `composeLocale` is where the two halves meet.
 *
 * **Korean is spaced, so every one of these words is claimable — and that is the
 * thing a reader arriving from `ja.ts` or `zh.ts` will get wrong.** Those two
 * files spend most of their length on a measurement: Japanese and Chinese are
 * written without spaces, so `lex` hands each letter run to `Intl.Segmenter` and
 * ICU's dictionary decides where a compound breaks, which is why `ja.ts` here can
 * claim ビット and メガビット and must refuse キロビット, ギガビット and テラビット
 * — ICU cuts all three at the SI prefix. Korean has had 띄어쓰기 since the 1896
 * 독립신문, `korean.segment` is undefined, and `lex` has already cut at every
 * space before segmentation would be consulted. So 킬로비트 reaches the resolver
 * as one token because a Korean writer wrote it as one word, and this file lists
 * the whole family where `ja.ts` could list two fifths of it. `ko.test.ts` pins
 * the absence of a segmenter rather than trusting this paragraph.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * Korean reaches by a route of its own — a worse one than English's, in fact.
 * English refuses because "megabits per second" is a phrase and a unit word is
 * one token. Korean's rate expression is 「초당 메가비트」 — "per-second
 * megabits" — where 초당 is not merely a separate word but a *prefix*, arriving
 * before the number, at a position `lex` can never bind a unit label to, since a
 * unit word attaches to the number on its left. The postposed spelling
 * 「메가비트 매초」 exists in standards prose and is two words with a space
 * between them, which is the ordinary refusal. Either way there is nothing a
 * `forms` row could hold that this engine could read back, so the printer stays
 * on the symbol and a Korean rate prints "2,000Mbps" — tight against the number,
 * because `korean.renderQuantity` closes the gap on every branch.
 *
 * **The symbols are Latin, and that is Korean rather than a fallback.** Korea
 * sells and measures bandwidth in exactly the notation the rest of the world
 * does — 「최대 1Gbps」 on a fibre contract, 「100Mbps」 on a switch — and has no
 * native abbreviation for a rate at all. R8 says to use the language's own
 * abbreviation where the language actually abbreviates and never to invent one,
 * and coining 「초당메가비트」 as a symbol would be exactly that. The SI casing
 * (lowercase kilo, capital mega and up) is what a Korean spec sheet prints; the
 * alias index folds case, so "Mbps" and "mbps" are one key and the casing costs
 * nothing.
 *
 * **The five Hangul aliases are the elision Korean already makes.** 비트 is a
 * bit, 메가비트 a megabit, and writing 「5메가비트」 for five megabits *per
 * second* leaves the per-second understood — the same elision English's own
 * "mbps" rests on and Ukrainian's "мбіт". The commoner colloquial form is
 * shorter still: a Korean ISP customer says 「우리 집은 100메가」. Bare 메가 and
 * 기가 are nonetheless **deliberately absent**, and the reason is the flat alias
 * index rather than any doubt about the usage — 「500기가」 is a *file size* as
 * readily as it is a link rate, and `@smartput/datasize`'s `ko.ts` claims
 * 기가바이트 in the same map with no kind in the key. A prefix that means two
 * different kinds depending on what the writer had in mind is not a reading this
 * vocabulary can make; the full compound is unambiguous, so the full compound is
 * what is claimed.
 *
 * 비트 is claimed *here* and not in `@smartput/tempo`, where it is also the
 * ordinary loanword for a musical beat, for the same one-flat-map reason and
 * recorded in both files so the split is visible from either side.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, so the micro path (`parseDatarate`) and the engine
 * path agree by construction, and the Hangul words are appended. Nobody switches
 * input mode to type a unit: 「100메가비트」 and "100 mbps" are the same sentence
 * and a `ko` engine has to take both.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "datarate",
  units: {
    bps: { aliases: [...alias("bps"), "비트"], symbol: "bps" },
    kbps: { aliases: [...alias("kbps"), "킬로비트"], symbol: "kbps" },
    mbps: { aliases: [...alias("mbps"), "메가비트"], symbol: "Mbps" },
    gbps: { aliases: [...alias("gbps"), "기가비트"], symbol: "Gbps" },
    tbps: { aliases: [...alias("tbps"), "테라비트"], symbol: "Tbps" },
  },
});
