// Standard HSV -> RGB, used to turn the water color picker's hue slider
// (0-360°, full saturation/value) into an actual, vivid RGB color — see
// WaterColorPicker in SettingsPanel.tsx. Values are 0..1 per channel.
export function hsvToRgb(hueDeg: number, s: number, v: number): [number, number, number] {
  const h = ((hueDeg % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

export function tintToCss(rgb: readonly [number, number, number], alpha: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${c(rgb[0])}, ${c(rgb[1])}, ${c(rgb[2])}, ${alpha})`;
}
