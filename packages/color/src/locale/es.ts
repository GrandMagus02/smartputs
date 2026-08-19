import { notationVocabulary } from "./shared";

/**
 * Spanish. `color` is spelled as in English, so the cue is the same string and means the same thing.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("es", {
  hexForms: { one: "hex", other: "hex" },
  name: ["nombre"],
  nameForms: { one: "nombre", other: "nombres" },
  cues: {
    color: 3,
    colores: 3,
    tono: 2,
    matiz: 2,
    paleta: 2,
    fondo: 1,
  },
});
