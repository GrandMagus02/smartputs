import { notationVocabulary } from "./shared";

/**
 * Russian. Same reasoning as Ukrainian: `цвета`/`цвету` are the cases a sentence about colour actually appears in.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("ru", {
  hexForms: { one: "hex", other: "hex" },
  name: ["название"],
  nameForms: { one: "название", other: "названия" },
  cues: {
    цвет: 3,
    цвета: 3,
    цвету: 3,
    оттенок: 2,
    палитра: 2,
    фон: 1,
  },
});
