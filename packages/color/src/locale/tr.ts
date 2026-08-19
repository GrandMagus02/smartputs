import { notationVocabulary } from "./shared";

/**
 * Turkish. `renginde` is the locative people write ("bu renginde"), and a cue is a surface, so it is listed.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("tr", {
  hexForms: { one: "hex", other: "hex" },
  name: ["ad", "isim"],
  nameForms: { one: "ad", other: "adlar" },
  cues: {
    renk: 3,
    renkler: 3,
    renginde: 3,
    ton: 2,
    palet: 2,
    arkaplan: 1,
  },
});
