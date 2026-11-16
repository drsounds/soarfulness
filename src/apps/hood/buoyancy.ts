// KLÄDER PÅVERKAR FLYTFÖRMÅGA: how much the clothes (HUVA layers on top of
// the float suit) move the bather's float line, in metres (+ floats
// higher). HoodRuntime sets it every frame; the host's buoyancy spring in
// routes/index.tsx adds it to its target height. 0 while HUVA is off.

let offset = 0;

export function clothingBuoyancyOffset(): number {
  return offset;
}

export function setClothingBuoyancyOffset(v: number): void {
  offset = Number.isFinite(v) ? v : 0;
}
