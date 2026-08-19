import { notationVocabulary } from "./shared";

/**
 * Indonesian. `warna` does the whole job; Indonesian does not inflect it.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("id", {
  hexForms: { one: "hex", other: "hex" },
  name: ["nama"],
  nameForms: { one: "nama", other: "nama" },
  cues: {
    warna: 3,
    corak: 2,
    palet: 2,
    latar: 1,
  },
});
