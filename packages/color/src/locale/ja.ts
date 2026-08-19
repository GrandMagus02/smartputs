import { notationVocabulary } from "./shared";

/**
 * Japanese. 色 is one character and a very common one, so it is a cue and never an alias.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("ja", {
  hexForms: { one: "hex", other: "hex" },
  name: ["名前", "色名"],
  nameForms: { one: "名前", other: "名前" },
  cues: {
    色: 3,
    色相: 2,
    配色: 2,
    背景: 1,
  },
});
