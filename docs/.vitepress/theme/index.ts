import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import DemoShell from "./components/DemoShell.vue";
import HeroCalculator from "./components/HeroCalculator.vue";
import PageActions from "./components/PageActions.vue";
import SpComplete from "./components/SpComplete.vue";
import SpConvert from "./components/SpConvert.vue";
import SpCustomKind from "./components/SpCustomKind.vue";
import SpEvaluate from "./components/SpEvaluate.vue";
import SpExplain from "./components/SpExplain.vue";
import SpMoney from "./components/SpMoney.vue";
import SpResult from "./components/SpResult.vue";
import SpSuggest from "./components/SpSuggest.vue";
import SpWeights from "./components/SpWeights.vue";
import "virtual:uno.css";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Copy / download sits above the page title on every doc page.
      "doc-before": () => h(PageActions),
      // The launcher-style calculator replaces the hero's decorative image.
      "home-hero-image": () => h(HeroCalculator),
    });
  },
  enhanceApp({ app }) {
    // Registered globally so Markdown can use them without an import block.
    app.component("DemoShell", DemoShell);
    app.component("SpResult", SpResult);
    app.component("SpEvaluate", SpEvaluate);
    app.component("SpSuggest", SpSuggest);
    app.component("SpExplain", SpExplain);
    app.component("SpWeights", SpWeights);
    app.component("SpConvert", SpConvert);
    app.component("SpCustomKind", SpCustomKind);
    app.component("SpComplete", SpComplete);
    app.component("SpMoney", SpMoney);
  },
} satisfies Theme;
