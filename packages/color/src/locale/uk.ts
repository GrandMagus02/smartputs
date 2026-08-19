import { notationVocabulary } from "./shared";

/**
 * Ukrainian. The genitive `кольору` is listed beside the nominative, since a cue is matched as a surface and Ukrainian inflects.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("uk", {
  hexForms: { one: "hex", other: "hex" },
  name: ["назва"],
  nameForms: { one: "назва", other: "назви" },
  cues: {
    колір: 3,
    кольори: 3,
    кольору: 3,
    відтінок: 2,
    палітра: 2,
    тло: 1,
  },
});
