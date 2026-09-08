import {
  Box,
  Download,
  Eraser,
  Hammer,
  MousePointer2,
  Paintbrush,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { BLOCK_PALETTE } from "@/lib/watercraft/palette";
import type { BuildAction, SculptAction, ToolMode } from "@/lib/watercraft/types";

interface WatercraftHudProps {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  buildAction: BuildAction;
  onBuildActionChange: (action: BuildAction) => void;
  blockType: number;
  onBlockTypeChange: (id: number) => void;
  sculptAction: SculptAction;
  onSculptActionChange: (action: SculptAction) => void;
  brushRadius: number;
  onBrushRadiusChange: (value: number) => void;
  brushStrength: number;
  onBrushStrengthChange: (value: number) => void;
  blockCount: number;
  status: string | null;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onReset: () => void;
  onDone: () => void;
}

const pillBase =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide transition active:scale-95";
const pillOff = "bg-white/10 text-white/70 hover:bg-white/20";
const pillOn = "bg-white text-[#0b3d5c] shadow";

// The "watercraft" camera mode's build/sculpt controls — an overlay on top
// of the main bath's own canvas and NAV/LOOK joysticks, shown only while
// cameraMode === "watercraft" (see routes/index.tsx). Movement/looking stay
// entirely joystick-driven; this HUD only owns tapping/clicking the canvas
// itself (place/remove a block, paint the sculpt brush) plus its own
// buttons/sliders — see the pointer-events-none wrappers below, which let
// clicks pass through to the canvas everywhere except this panel.
export function WatercraftHud(props: WatercraftHudProps) {
  const {
    mode,
    onModeChange,
    buildAction,
    onBuildActionChange,
    blockType,
    onBlockTypeChange,
    sculptAction,
    onSculptActionChange,
    brushRadius,
    onBrushRadiusChange,
    brushStrength,
    onBrushStrengthChange,
    blockCount,
    status,
    onExport,
    onImportFile,
    onReset,
    onDone,
  } = props;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onImportFile(file);
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <button
          type="button"
          onClick={onDone}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/60"
        >
          <X className="h-3.5 w-3.5" /> Done building
        </button>
        <div className="pointer-events-none max-w-[13rem] rounded-full bg-black/35 px-3 py-1.5 text-right text-[10px] font-light leading-snug text-white/80 backdrop-blur-sm sm:max-w-xs">
          {status ?? "Tap the raft to build or sculpt"}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center p-3">
        <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-2.5 rounded-2xl bg-black/45 p-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onModeChange("build")}
                className={`${pillBase} ${mode === "build" ? pillOn : pillOff}`}
              >
                <Box className="h-3.5 w-3.5" /> Build
              </button>
              <button
                type="button"
                onClick={() => onModeChange("sculpt")}
                className={`${pillBase} ${mode === "sculpt" ? pillOn : pillOff}`}
              >
                <Paintbrush className="h-3.5 w-3.5" /> Sculpt
              </button>
            </div>
            <span className="text-[10px] font-light tracking-wide text-white/60">
              {blockCount} blocks
            </span>
          </div>

          {mode === "build" ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onBuildActionChange("place")}
                  className={`${pillBase} ${buildAction === "place" ? pillOn : pillOff}`}
                >
                  <Hammer className="h-3.5 w-3.5" /> Place
                </button>
                <button
                  type="button"
                  onClick={() => onBuildActionChange("remove")}
                  className={`${pillBase} ${buildAction === "remove" ? pillOn : pillOff}`}
                >
                  <Eraser className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BLOCK_PALETTE.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onBlockTypeChange(entry.id)}
                    aria-label={entry.name}
                    title={entry.name}
                    className={`h-7 w-7 rounded-full border-2 transition active:scale-90 ${
                      blockType === entry.id ? "border-white scale-110" : "border-white/20"
                    }`}
                    style={{ backgroundColor: `#${entry.color.toString(16).padStart(6, "0")}` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onSculptActionChange("raise")}
                  className={`${pillBase} ${sculptAction === "raise" ? pillOn : pillOff}`}
                >
                  <MousePointer2 className="h-3.5 w-3.5" /> Raise
                </button>
                <button
                  type="button"
                  onClick={() => onSculptActionChange("lower")}
                  className={`${pillBase} ${sculptAction === "lower" ? pillOn : pillOff}`}
                >
                  <MousePointer2 className="h-3.5 w-3.5 rotate-180" /> Lower
                </button>
              </div>
              <label className="flex items-center gap-2 text-[10px] font-light text-white/70">
                Brush size
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.05}
                  value={brushRadius}
                  onChange={(e) => onBrushRadiusChange(Number(e.target.value))}
                  className="flex-1 accent-white"
                />
              </label>
              <label className="flex items-center gap-2 text-[10px] font-light text-white/70">
                Brush strength
                <input
                  type="range"
                  min={0.02}
                  max={0.4}
                  step={0.01}
                  value={brushStrength}
                  onChange={(e) => onBrushStrengthChange(Number(e.target.value))}
                  className="flex-1 accent-white"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-t border-white/10 pt-2.5">
            <button type="button" onClick={onExport} className={`${pillBase} ${pillOff}`}>
              <Download className="h-3.5 w-3.5" /> Export .glb
            </button>
            <label className={`${pillBase} ${pillOff} cursor-pointer`}>
              <Upload className="h-3.5 w-3.5" /> Import .glb
              <input
                type="file"
                accept=".glb,model/gltf-binary"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <button type="button" onClick={onReset} className={`${pillBase} ${pillOff} ml-auto`}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
