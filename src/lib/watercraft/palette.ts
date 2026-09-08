// Block palette for build mode — deliberately small (a Minecraft "creative
// hotbar" feel) rather than a full block catalogue, since this is meant to
// be picked up in a few seconds while floating on the ocean.
export interface PaletteEntry {
  id: number;
  name: string;
  color: number;
  roughness: number;
  metalness: number;
}

export const BLOCK_PALETTE: PaletteEntry[] = [
  { id: 0, name: "Timber", color: 0x8a5a34, roughness: 0.85, metalness: 0 },
  { id: 1, name: "Sail", color: 0xf4efe1, roughness: 0.9, metalness: 0 },
  { id: 2, name: "Coral", color: 0xff7a68, roughness: 0.6, metalness: 0 },
  { id: 3, name: "Kelp", color: 0x3f8f5c, roughness: 0.7, metalness: 0 },
  { id: 4, name: "Sand", color: 0xe4cd8f, roughness: 0.95, metalness: 0 },
  { id: 5, name: "Stone", color: 0x8b93a0, roughness: 0.8, metalness: 0.05 },
  { id: 6, name: "Glass", color: 0x8fd7e8, roughness: 0.15, metalness: 0 },
  { id: 7, name: "Gold", color: 0xd8b34a, roughness: 0.35, metalness: 0.7 },
];

export function paletteEntry(id: number): PaletteEntry {
  return BLOCK_PALETTE[id] ?? BLOCK_PALETTE[0];
}
