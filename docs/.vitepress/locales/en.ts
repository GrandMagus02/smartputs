import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

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
        {
          text: "Core concepts",
          items: [
            { text: "Kinds and units", link: "/guide/kinds" },
            { text: "Ambiguity and weights", link: "/guide/weights" },
            { text: "Completion", link: "/guide/completion" },
            { text: "Locales", link: "/guide/locales" },
            { text: "Errors", link: "/guide/errors" },
          ],
        },
        {
          text: "Packages",
          items: [{ text: "Money and rates", link: "/guide/money" }],
        },
        {
          text: "Extending",
          items: [
            { text: "Defining a kind", link: "/guide/defining-a-kind" },
            { text: "Roadmap", link: "/guide/roadmap" },
          ],
        },
      ],
      "/api/": [
        {
          text: "@smartput/core",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "createEngine", link: "/api/create-engine" },
            { text: "Engine", link: "/api/engine" },
            { text: "complete", link: "/api/complete" },
            { text: "defineKind", link: "/api/define-kind" },
            { text: "defineLocale", link: "/api/define-locale" },
            { text: "createFacade", link: "/api/facade" },
            { text: "Types", link: "/api/types" },
          ],
        },
        {
          text: "@smartput/rates",
          items: [{ text: "Overview", link: "/api/rates" }],
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
      pattern: "https://github.com/GrandMagus/smartputs/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 smartputs contributors",
    },
  },
};

export default en;
