import { notationVocabulary } from "./shared";

/**
 * Arabic. `اللون` with the article is as common as the bare `لون`, and both are surfaces.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("ar", {
  hexForms: { one: "hex", other: "hex" },
  name: ["اسم"],
  nameForms: { one: "اسم", other: "أسماء" },
  cues: {
    لون: 3,
    ألوان: 3,
    اللون: 3,
    درجة: 2,
    لوحة: 2,
    خلفية: 1,
  },
});
