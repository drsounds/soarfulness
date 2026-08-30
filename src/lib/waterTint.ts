// Mirrors the hue-rotation math the ocean shader applies to the water tint
// (see the `hueRotate` GLSL function and its use in routes/index.tsx's
// fragment shader) so the water color picker's live swatch and hue-slider
// gradient (SettingsPanel.tsx) always show the color that will actually
// render, instead of a generic rainbow unrelated to the current preset/
// saturation/brightness.
export function hueRotateTint(
  base: readonly [number, number, number],
  bright: number,
  hueDeg: number,
  sat: number,
): [number, number, number] {
  const angle = (hueDeg * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const oneThird = 1 / 3;
  const root3inv = 0.57735026919;
  const m: [number, number, number][] = [
    [c + oneThird * (1 - c), -root3inv * s + oneThird * (1 - c), root3inv * s + oneThird * (1 - c)],
    [root3inv * s + oneThird * (1 - c), c + oneThird * (1 - c), -root3inv * s + oneThird * (1 - c)],
    [-root3inv * s + oneThird * (1 - c), root3inv * s + oneThird * (1 - c), c + oneThird * (1 - c)],
  ];
  const t: [number, number, number] = [base[0] * bright, base[1] * bright, base[2] * bright];
  const rotated: [number, number, number] = [
    m[0][0] * t[0] + m[0][1] * t[1] + m[0][2] * t[2],
    m[1][0] * t[0] + m[1][1] * t[1] + m[1][2] * t[2],
    m[2][0] * t[0] + m[2][1] * t[1] + m[2][2] * t[2],
  ];
  const gray = rotated[0] * 0.299 + rotated[1] * 0.587 + rotated[2] * 0.114;
  return [
    gray + (rotated[0] - gray) * sat,
    gray + (rotated[1] - gray) * sat,
    gray + (rotated[2] - gray) * sat,
  ];
}

export function tintToCss(rgb: readonly [number, number, number], alpha: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${c(rgb[0])}, ${c(rgb[1])}, ${c(rgb[2])}, ${alpha})`;
}
