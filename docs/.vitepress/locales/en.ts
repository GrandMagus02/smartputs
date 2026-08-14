import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";
import { packagesSidebar } from "./packages-sidebar";

/**
 * The English locale. It is mounted at the site root, so adding a second
 * language means copying this file to `locales/<id>.ts`, translating the
 * strings, and registering it in `config.ts` under its own path prefix — no
 * existing URL moves.
 */
export const en: LocaleSpecificConfig<DefaultTheme.Config> & {
  label: string;
  link?: string;
} = {
  label: "English",
  lang: "en-US",
  link: "/",
  description: "Parse and evaluate human-written expressions: units, durations, math.",

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/", activeMatch: "/guide/" },
      { text: "Packages", link: "/packages/", activeMatch: "/packages/" },
      { text: "API", link: "/api/", activeMatch: "/api/" },
      { text: "Playground", link: "/playground" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is smartputs?", link: "/guide/" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "The pipeline", link: "/guide/pipeline" },
          ],
        },
        // What is left here is what belongs to no single package. Everything
        // that was a page about one — money, datetime, ranges, places, query,
        // math, comparison, the micro path — now lives on that package's page
        // under /packages, with its demo, its unit table and its size budget on
        // the same screen.
        {
          text: "How the engine works",
          items: [
            { text: "Kinds and units", link: "/guide/kinds" },
            { text: "Ambiguity and weights", link: "/guide/weights" },
            { text: "Completion", link: "/guide/completion" },
            { text: "Locales", link: "/guide/locales" },
            { text: "Errors", link: "/guide/errors" },
          ],
        },
        {
          text: "Building with it",
          items: [
            { text: "Inputs and error messages", link: "/guide/inputs" },
            { text: "Defining a kind", link: "/guide/defining-a-kind" },
            { text: "All packages", link: "/packages/" },
            { text: "Roadmap", link: "/guide/roadmap" },
          ],
        },
      ],
      // Generated beside the pages themselves — see scripts/gen-package-pages.ts.
      "/packages/": packagesSidebar,
      "/api/": [
        {
          text: "@smartput/core",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "createEngine", link: "/api/create-engine" },
            { text: "Engine", link: "/api/engine" },
            { text: "Stages", link: "/api/stages" },
            { text: "Printer", link: "/api/printer" },
            { text: "complete", link: "/api/complete" },
            { text: "defineKind", link: "/api/define-kind" },
            { text: "defineLocale", link: "/api/define-locale" },
            { text: "createFacade", link: "/api/facade" },
            { text: "Types", link: "/api/types" },
          ],
        },
        {
          text: "@smartput/shared",
          items: [
            { text: "Overview", link: "/api/validate" },
            { text: "Value classes", link: "/api/value-classes" },
          ],
        },
        {
          text: "@smartput/rate",
          items: [{ text: "Overview", link: "/api/rate" }],
        },
        {
          text: "@smartput/currency",
          items: [{ text: "Overview", link: "/api/currency" }],
        },
        {
          text: "@smartput/math",
          items: [{ text: "Overview", link: "/api/math" }],
        },
      ],
    },

    outline: { level: [2, 3], label: "On this page" },
    docFooter: { prev: "Previous", next: "Next" },
    darkModeSwitchLabel: "Appearance",
    returnToTopLabel: "Return to top",
    sidebarMenuLabel: "Menu",
    lastUpdated: { text: "Last updated" },

    editLink: {
      pattern: "https://github.com/GrandMagus02/smartputs/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 smartputs contributors",
    },
  },
};

export default en;
