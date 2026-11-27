import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// One sidebar for the developer docs. Keep "Architecture" easy to update:
// the plugin-based apps/ refactor will change most of it (see
// architecture/plugin-refactor.md).
const sidebars: SidebarsConfig = {
  main: [
    "intro",
    {
      type: "category",
      label: "Getting started",
      collapsed: false,
      items: [
        "getting-started/repos",
        "getting-started/local-dev",
        "getting-started/deployment",
      ],
    },
    {
      type: "category",
      label: "Architecture",
      collapsed: false,
      items: [
        "architecture/overview",
        "architecture/settings-pipeline",
        "architecture/render-loop",
        "architecture/settings-ui",
        "architecture/hud",
        "architecture/persistence-and-sharing",
        "architecture/content-apps",
        "architecture/i18n",
        "architecture/native-and-offline",
        "architecture/plugin-refactor",
      ],
    },
    {
      type: "category",
      label: "Features",
      link: { type: "doc", id: "features/index" },
      items: [
        "features/movement-modes",
        "features/waves-and-water",
        "features/open-drift",
        "features/roaming",
        "features/gamepad",
        "features/picture-in-picture",
        "features/wind",
        "features/snow",
        "features/rain",
        "features/aurora",
        "features/underwater-fog",
        "features/confetti",
        "features/fireworks",
        "features/time-and-backdrops",
        "features/clouds",
        "features/lighting-and-effects",
        "features/string-lights",
        "features/scenes-and-decorations",
        "features/bather-hood-and-goggles",
        "features/ui-theme",
        "features/limits-and-typed-values",
        "features/defaults",
        "features/phone-tv-and-sessions",
      ],
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/add-a-setting",
        "guides/add-a-scene-effect",
        "guides/add-content",
        "guides/porting-between-repos",
        "guides/testing-and-screenshots",
        "guides/gotchas",
      ],
    },
    {
      type: "category",
      label: "Reference",
      items: ["reference/feature-index", "reference/storage-keys", "reference/glossary"],
    },
  ],
};

export default sidebars;
