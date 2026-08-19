import { notationVocabulary } from "./shared";

/**
 * Dutch. `tint` is the Dutch cue and the English word for the same idea, and both are here.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("nl", {
  hexForms: { one: "hex", other: "hex" },
  name: ["naam", "kleurnaam"],
  nameForms: { one: "naam", other: "namen" },
  cues: {
    kleur: 3,
    kleuren: 3,
    tint: 2,
    palet: 2,
    achtergrond: 1,
  },
});
