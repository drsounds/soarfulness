import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// Developer documentation for Aquafulness / Soarfulness, published to GitHub
// Pages by .github/workflows/docs.yml. The site has two docs instances:
//   - website/docs  -> "/"        how the code works (architecture, features, guides)
//   - ../docs       -> "/theory"  the existing background/theory documents,
//                                  read in place so there is one copy of them.
// The app itself is deployed separately (deploy.yml); nothing here touches it.

const REPO = "https://github.com/drsounds/soarfulness";

const config: Config = {
  title: "Aquafulness developer docs",
  tagline: "How the Soarfulness and Aquafulness apps are built, for people and agents working on them",
  favicon: "img/logo.png",

  url: "https://drsounds.github.io",
  baseUrl: "/soarfulness/",
  organizationName: "drsounds",
  projectName: "soarfulness",
  trailingSlash: false,

  onBrokenLinks: "throw",
  markdown: {
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: "throw" },
  },
  themes: ["@docusaurus/theme-mermaid"],

  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: `${REPO}/edit/main/website/`,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "theory",
        path: "../docs",
        routeBasePath: "theory",
        // docs/architecture/ (the plugin refactor's write-up) is developer
        // documentation, mirrored in website/docs/architecture/plugin-refactor.md.
        exclude: ["architecture/**"],
        sidebarPath: "./sidebarsTheory.ts",
        editUrl: `${REPO}/edit/main/docs/`,
      },
    ],
  ],

  themeConfig: {
    image: "img/logo.png",
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: "Aquafulness docs",
      logo: { alt: "Aquafulness", src: "img/logo.png" },
      items: [
        { type: "docSidebar", sidebarId: "main", position: "left", label: "Developer docs" },
        { to: "/features", label: "Features", position: "left" },
        { to: "/guides/add-a-setting", label: "Add a feature", position: "left" },
        { to: "/theory", label: "Theory", position: "left" },
        { href: REPO, label: "soarfulness", position: "right" },
        { href: "https://github.com/drsounds/aqua-wave-dream", label: "aqua-wave-dream", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Start here", to: "/" },
            { label: "Architecture", to: "/architecture/overview" },
            { label: "Feature index", to: "/reference/feature-index" },
          ],
        },
        {
          title: "Repositories",
          items: [
            { label: "drsounds/soarfulness", href: REPO },
            { label: "drsounds/aqua-wave-dream", href: "https://github.com/drsounds/aqua-wave-dream" },
          ],
        },
      ],
      copyright:
        "Aquafulness is a wellness and relaxation visualization. It makes no medical claims.",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "glsl"],
    },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
  } satisfies Preset.ThemeConfig,
};

export default config;
