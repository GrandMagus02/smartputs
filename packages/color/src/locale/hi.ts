import { notationVocabulary } from "./shared";

/**
 * Hindi. `रंगों` is the oblique plural, which is the form a phrase about colours takes.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("hi", {
  hexForms: { one: "hex", other: "hex" },
  name: ["नाम"],
  nameForms: { one: "नाम", other: "नाम" },
  cues: {
    रंग: 3,
    रंगों: 3,
    छटा: 2,
    पैलेट: 2,
    पृष्ठभूमि: 1,
  },
});
