import { notationVocabulary } from "./shared";

/**
 * Portuguese. `cor`/`cores` carry the weight; `tom` is shared with music and is weighted for it.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("pt", {
  hexForms: { one: "hex", other: "hex" },
  name: ["nome"],
  nameForms: { one: "nome", other: "nomes" },
  cues: {
    cor: 3,
    cores: 3,
    tom: 2,
    matiz: 2,
    paleta: 2,
    fundo: 1,
  },
});
