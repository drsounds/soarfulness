// Shared types for the "Watercraft" builder (see src/routes/watercraft.tsx):
// a Minecraft-like block editor and a brush-based sculpting pad, both living
// on a raft that bobs on a small animated ocean. Everything here is plain
// data so it can round-trip through a GLB's per-node `extras` (see
// glbIO.ts) without depending on any three.js class.

export type ToolMode = "build" | "sculpt";
export type BuildAction = "place" | "remove";
export type SculptAction = "raise" | "lower";

// One voxel: integer grid cell + which palette entry it's filled with.
export type BlockRecord = readonly [x: number, y: number, z: number, blockType: number];

export interface ClayData {
  width: number;
  depth: number;
  segX: number;
  segZ: number;
  baseY: number;
  heights: number[]; // length (segX + 1) * (segZ + 1)
}

// The full save format, embedded verbatim as `userData.aquaWatercraft` on
// the exported GLB's root node (see glbIO.ts) and read back on import.
export interface WatercraftSaveData {
  kind: "aquafulness-watercraft";
  version: 1;
  blocks: BlockRecord[];
  clay: ClayData;
}

export function isWatercraftSaveData(value: unknown): value is WatercraftSaveData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.kind === "aquafulness-watercraft" &&
    v.version === 1 &&
    Array.isArray(v.blocks) &&
    typeof v.clay === "object" &&
    v.clay !== null
  );
}
