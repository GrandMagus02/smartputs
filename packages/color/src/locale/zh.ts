import { notationVocabulary } from "./shared";

/**
 * Chinese. 颜色 and the bare 色 are both cues, the second weaker for the same reason Japanese's is.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("zh", {
  hexForms: { one: "hex", other: "hex" },
  name: ["名称", "颜色名"],
  nameForms: { one: "名称", other: "名称" },
  cues: {
    颜色: 3,
    色: 3,
    色相: 2,
    调色板: 2,
    背景: 1,
  },
});
