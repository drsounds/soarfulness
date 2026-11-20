// Hood settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import {
  HOOD_MESH_RESOLUTION_DEFAULT,
  type HoodCuffMaterial,
  type HoodLayer,
  type HoodStyle,
} from "./hoodLayers";

export type HoodSettings = {
  // HUVA: a hoodie hood around the bather (apps/hood/Hood.ts), off by
  // default. hoodHeight = where its sides end, from the bottom of the view
  // up (0..1); hoodOpening = face opening tight..wide (0..1); hoodMetallic =
  // matte cloth..wet metallic sheen (0..1); hoodMotion = sway/flutter (0..1).
  hoodOn: boolean;
  hoodHeight: number;
  hoodOpening: number;
  hoodColor: string;
  hoodMetallic: number;
  hoodMotion: number;
  // MUN OCH HALS: also cover the mouth and neck (hoodLowerHeight = how high
  // up the view that cover reaches, 0..1), optionally with a BLIXTLÅS zipper.
  hoodLowerOn: boolean;
  hoodLowerHeight: number;
  hoodZipperOn: boolean;
  // VATTEN I HUVAN: water runs in inside the hood below the waterline, like
  // swimming in clothes; hoodWaterLevel (0..1) raises it above the sea outside.
  hoodWaterOn: boolean;
  hoodWaterLevel: number;
  // HUVHÖJD (hoodDrop), VÅTA VECK (hoodWrinkles) and MÖRKHET (hoodDarkness)
  // for layer 1 are 0..1; TYNGD (hoodWeight) is -1..1. Layers 2+ live in
  // hoodExtraLayers (apps/hood/hoodLayers.ts).
  // ÖPPNINGSBREDD for layer 1, in screen widths; 0 = AUTO (follow ÖPPNING).
  hoodOpeningWidth: number;
  hoodDrop: number;
  hoodWeight: number;
  hoodWrinkles: number;
  hoodDarkness: number;
  // RUNDHET, STIL (+ PUFFSTORLEK/PUFFHÖJD) and MUDD (+ MUDDHÖJD/RIBBSTORLEK)
  // for layer 1 — see HoodLayer in apps/hood/hoodLayers.ts.
  hoodRoundness: number;
  hoodStyle: HoodStyle;
  hoodPuffSize: number;
  hoodPuffHeight: number;
  hoodCuffOn: boolean;
  hoodCuffHeight: number;
  hoodCuffSize: number;
  hoodDripAmount: number;
  hoodDripGrow: number;
  hoodReal3d: boolean;
  hoodMeshResolution: number;
  hoodSeparate: boolean;
  hoodWaterTint: number;
  hoodDripping: number;
  hoodPullBack: number;
  hoodNeckBack: number;
  hoodLengthOn: boolean;
  hoodLength: number;
  hoodPuff3d: boolean;
  hoodLayer1On: boolean;
  hoodFloatThreshold: number;
  hoodRotateHead: boolean;
  hoodSuitColor: string;
  hoodSuitLeg: number;
  hoodClothesBuoyancy: boolean;
  hoodZipperOpen: number;
  hoodFloating: number;
  hoodTopPart: boolean;
  hoodCollarUp: boolean;
  // SKUGGA PÅ VYN: the hood shades the view behind it (off by default).
  hoodViewShadow: boolean;
  hoodCuffCustom: boolean;
  hoodCuffColor: string;
  hoodCuffMetallic: number;
  hoodCuffMaterial: HoodCuffMaterial;
  hoodHanging: boolean;
  hoodWaterCalm: number;
  hoodCuffTop: boolean;
  hoodZipperFixed: boolean;
  hoodZipperPullOut: boolean;
  hoodReflectLight: boolean;
  hoodPuffThickness: number;
  hoodPuffInflate: number;
  hoodExtraLayers: HoodLayer[];
};

export const HOOD_DEFAULTS: HoodSettings = {
  // HUVA: off by default — see apps/hood/Hood.ts.
  hoodOn: false,
  hoodHeight: 0.3,
  hoodOpening: 0.5,
  hoodColor: "#2b3a55",
  hoodMetallic: 0.5,
  hoodMotion: 0.5,
  hoodLowerOn: false,
  hoodLowerHeight: 0.45,
  hoodZipperOn: false,
  hoodWaterOn: false,
  hoodWaterLevel: 0.3,
  hoodOpeningWidth: 0,
  hoodDrop: 0,
  hoodWeight: 0.4,
  hoodWrinkles: 0,
  hoodDarkness: 0,
  hoodRoundness: 0.85,
  hoodStyle: "classic" as HoodStyle,
  hoodPuffSize: 0.4,
  hoodPuffHeight: 0.5,
  hoodCuffOn: false,
  hoodCuffHeight: 0.3,
  hoodCuffSize: 0.5,
  hoodDripAmount: 0.7,
  hoodDripGrow: 0.5,
  hoodReal3d: false,
  hoodMeshResolution: HOOD_MESH_RESOLUTION_DEFAULT,
  hoodSeparate: false,
  hoodWaterTint: 0,
  hoodDripping: 0,
  hoodPullBack: 0,
  hoodNeckBack: 0,
  hoodLengthOn: false,
  hoodLength: 0.6,
  hoodPuff3d: false,
  hoodLayer1On: true,
  hoodFloatThreshold: 0.35,
  hoodRotateHead: false,
  hoodSuitColor: "#e0602a",
  hoodSuitLeg: 0,
  hoodClothesBuoyancy: true,
  hoodZipperOpen: 0,
  hoodFloating: 0,
  hoodTopPart: true,
  hoodCollarUp: false,
  hoodViewShadow: false,
  hoodCuffCustom: false,
  hoodCuffColor: "#1f2a40",
  hoodCuffMetallic: 0.15,
  hoodCuffMaterial: "knit",
  hoodHanging: true,
  hoodWaterCalm: 0.6,
  hoodCuffTop: true,
  hoodZipperFixed: true,
  hoodZipperPullOut: true,
  hoodReflectLight: true,
  hoodPuffThickness: 0.5,
  hoodPuffInflate: 0,
  hoodExtraLayers: [] as HoodLayer[],
};

/** Every key HoodSettings owns, in declaration order (presets, sharing). */
export const HOOD_SETTING_KEYS = Object.keys(HOOD_DEFAULTS) as (keyof HoodSettings)[];
