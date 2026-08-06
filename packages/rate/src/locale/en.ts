import { defineLocalePack } from "@smartput/core";

/**
 * Colloquial English currency vocabulary. The ISO codes and the primary names
 * live on the kind itself; this pack adds what only English speakers say.
 */
export default defineLocalePack({
  locale: "en",
  contributes: {
    money: {
      gbp: ["quid", "sterling"],
      usd: ["buck", "bucks"],
      eur: ["euros"],
    },
  },
});
