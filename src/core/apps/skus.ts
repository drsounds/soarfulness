import type { Sku } from "./flags";

// The product editions (SKUs). A SKU is a named set of apps that are on:
// build with VITE_APP_SKU=<id> to ship that edition. Add an edition by
// adding an entry here; list the apps it keeps in `enabled` (dependencies
// come along automatically) or the ones it drops in `disabled`.

export const SKUS: Readonly<Record<string, Sku>> = {
  full: {
    id: "full",
    description: "Every app (the default edition).",
  },
};

export const DEFAULT_SKU = "full";
