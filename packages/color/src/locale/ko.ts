import { notationVocabulary } from "./shared";

/**
 * Korean. 색 and 색상 are both everyday; 색조 is the narrower hue sense.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("ko", {
  hexForms: { one: "hex", other: "hex" },
  name: ["이름", "색이름"],
  nameForms: { one: "이름", other: "이름" },
  cues: {
    색: 3,
    색상: 3,
    색조: 2,
    팔레트: 2,
    배경: 1,
  },
});
