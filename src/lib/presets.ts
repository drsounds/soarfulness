import type { SettingsTab } from "@/lib/settingsShared";

// JSON-file (File API) and localStorage-backed preset management for the
// Settings dialog's save/load/export/import feature — see SettingsPanel.tsx
// (UI) and routes/index.tsx (the actual Persisted-settings snapshot/apply
// logic, which owns the real state this module only shuttles around).
// Framework-agnostic: no React here, just plain data + browser File/Blob APIs.

export type PresetScope = "all" | SettingsTab;

const PRESET_FILE_APP = "aquafulness-preset";
const PRESET_FILE_VERSION = 1;

export type PresetFilePayload = {
  app: typeof PRESET_FILE_APP;
  version: typeof PRESET_FILE_VERSION;
  scope: PresetScope;
  savedAt: string;
  data: Record<string, unknown>;
};

export function buildPresetFilePayload(
  scope: PresetScope,
  data: Record<string, unknown>,
): PresetFilePayload {
  return {
    app: PRESET_FILE_APP,
    version: PRESET_FILE_VERSION,
    scope,
    savedAt: new Date().toISOString(),
    data,
  };
}

// Accepts either a wrapped payload (as written by buildPresetFilePayload) or
// a bare settings object, so a hand-edited/plain JSON dump imports cleanly
// too, not just this app's own exports.
export function extractPresetData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.app === PRESET_FILE_APP && obj.data && typeof obj.data === "object") {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

// Triggers a browser download of `obj` as a JSON file — the "export" half of
// the File API preset feature.
export function downloadJsonFile(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Opens the native file picker (a throwaway <input type="file">) and hands
// the chosen file to `onFile` — the "import" half of the File API preset
// feature. Briefly attached to the DOM (hidden) since some browsers refuse
// to show the picker for a detached element's click().
export function pickJsonFile(onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.style.display = "none";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

// Named presets kept in localStorage so users can save/load them in-app
// without downloading/re-uploading a file each time — separate from (but
// sharing the same data shape as) the on-disk export/import above.
export type SavedPreset = {
  id: string;
  name: string;
  scope: PresetScope;
  savedAt: string;
  data: Record<string, unknown>;
};

const SAVED_PRESETS_KEY = "aquafulness:presets:v1";

export function loadSavedPresets(): SavedPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedPresets(list: SavedPreset[]) {
  try {
    window.localStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function addSavedPreset(
  list: SavedPreset[],
  name: string,
  scope: PresetScope,
  data: Record<string, unknown>,
): SavedPreset[] {
  const next: SavedPreset[] = [
    ...list,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      scope,
      savedAt: new Date().toISOString(),
      data,
    },
  ];
  persistSavedPresets(next);
  return next;
}

export function removeSavedPreset(list: SavedPreset[], id: string): SavedPreset[] {
  const next = list.filter((p) => p.id !== id);
  persistSavedPresets(next);
  return next;
}

// "Full state" save/load — a superset of a preset: every settings field
// (like an "all"-scope preset) plus the runtime-only player position/look
// and STRÖM/SVAJ direction vectors, which are deliberately *not* part of
// Persisted (see routes/index.tsx's buildRuntimeSnapshot/applyRuntimeState).
// Kept as its own file "kind" and localStorage list rather than folded into
// PresetScope, since it isn't tab-scoped — it's always everything at once.
const STATE_FILE_APP = "aquafulness-state";
const STATE_FILE_VERSION = 1;

export type StateFilePayload = {
  app: typeof STATE_FILE_APP;
  version: typeof STATE_FILE_VERSION;
  savedAt: string;
  data: Record<string, unknown>;
};

export function buildStateFilePayload(data: Record<string, unknown>): StateFilePayload {
  return {
    app: STATE_FILE_APP,
    version: STATE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    data,
  };
}

export function extractStateData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.app === STATE_FILE_APP && obj.data && typeof obj.data === "object") {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

// The runtime-only half of a full state save — player position/look plus
// the STRÖM (current) and SVAJ (sway) world-space direction vectors. Built/
// applied by routes/index.tsx (which owns the refs these mirror); validated
// here since it round-trips through untrusted JSON on import.
// noclipDriftDir/noclipVertDrift are optional: they're the noclip-mode
// analogue of driftDir/swayDir (see routes/index.tsx's noclipDriftWorldRef/
// vertStickRef), added after the original shape shipped — optional so older
// saved/exported states without them still round-trip fine.
export type RuntimeState = {
  camera: { x: number; y: number; z: number; yaw: number; pitch: number };
  driftDir: { x: number; z: number };
  swayDir: { x: number; z: number };
  noclipDriftDir?: { x: number; z: number };
  noclipVertDrift?: { x: number; y: number };
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isVec2(v: unknown): v is { x: number; z: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return isFiniteNumber(o.x) && isFiniteNumber(o.z);
}

export function isValidRuntimeState(v: unknown): v is RuntimeState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const c = o.camera as Record<string, unknown> | undefined;
  if (
    !c ||
    typeof c !== "object" ||
    !isFiniteNumber(c.x) ||
    !isFiniteNumber(c.y) ||
    !isFiniteNumber(c.z) ||
    !isFiniteNumber(c.yaw) ||
    !isFiniteNumber(c.pitch)
  ) {
    return false;
  }
  if (!isVec2(o.driftDir) || !isVec2(o.swayDir)) return false;
  if (o.noclipDriftDir !== undefined && !isVec2(o.noclipDriftDir)) return false;
  if (o.noclipVertDrift !== undefined) {
    const nv = o.noclipVertDrift as Record<string, unknown>;
    if (!nv || typeof nv !== "object" || !isFiniteNumber(nv.x) || !isFiniteNumber(nv.y)) {
      return false;
    }
  }
  return true;
}

export type SavedState = {
  id: string;
  name: string;
  savedAt: string;
  data: Record<string, unknown>;
};

const SAVED_STATES_KEY = "aquafulness:states:v1";

export function loadSavedStates(): SavedState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_STATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedStates(list: SavedState[]) {
  try {
    window.localStorage.setItem(SAVED_STATES_KEY, JSON.stringify(list));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function addSavedState(
  list: SavedState[],
  name: string,
  data: Record<string, unknown>,
): SavedState[] {
  const next: SavedState[] = [
    ...list,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      savedAt: new Date().toISOString(),
      data,
    },
  ];
  persistSavedStates(next);
  return next;
}

export function removeSavedState(list: SavedState[], id: string): SavedState[] {
  const next = list.filter((s) => s.id !== id);
  persistSavedStates(next);
  return next;
}
