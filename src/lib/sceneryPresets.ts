// A "scenery" preset bundles just {sceneId, envId, envEra, envTime,
// surfaceId} — the scene + environment(+era/time) + water-surface reflection
// selection — separate from src/lib/presets.ts's broader, tab-scoped
// settings presets (sceneId/envId/envEra/envTime live under the "miljo" tab
// there and surfaceId under "vatten", so no existing PresetScope covers
// exactly this cross-cutting set). Backs the ScenerySelectorDialog.
//
// Two sources, merged into one list for display:
//  - user-saved presets, kept in localStorage (this file's read/write half,
//    modeled on presets.ts's SavedState)
//  - each installed app's shipped defaults, from its own
//    apps/<appId>/scenary/manifest.json (read-only — not deletable)

export type SceneryData = {
  sceneId: string | null;
  envId: string | null;
  envEra: string | null;
  envTime: string | null;
  surfaceId: string | null;
};

export type SavedSceneryPreset = {
  id: string;
  name: string;
  savedAt: string;
  data: SceneryData;
};

const SAVED_SCENERY_PRESETS_KEY = "aquafulness:sceneryPresets:v1";

export function loadSavedSceneryPresets(): SavedSceneryPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_SCENERY_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedSceneryPresets(list: SavedSceneryPreset[]) {
  try {
    window.localStorage.setItem(SAVED_SCENERY_PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function addSavedSceneryPreset(
  list: SavedSceneryPreset[],
  name: string,
  data: SceneryData,
): SavedSceneryPreset[] {
  const next: SavedSceneryPreset[] = [
    ...list,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      savedAt: new Date().toISOString(),
      data,
    },
  ];
  persistSavedSceneryPresets(next);
  return next;
}

export function removeSavedSceneryPreset(
  list: SavedSceneryPreset[],
  id: string,
): SavedSceneryPreset[] {
  const next = list.filter((p) => p.id !== id);
  persistSavedSceneryPresets(next);
  return next;
}

// Overwrites the whole saved list (e.g. after merging in an imported one).
export function replaceSavedSceneryPresets(list: SavedSceneryPreset[]): SavedSceneryPreset[] {
  persistSavedSceneryPresets(list);
  return list;
}

// A single shipped preset entry from an app's scenary/manifest.json.
export type AppSceneryPreset = {
  id: string;
  name: string;
  appId: string;
  data: SceneryData;
};

type ScenaryManifestEntry = {
  id?: string;
  name: string;
  sceneId?: string | null;
  envId?: string | null;
  envEra?: string | null;
  envTime?: string | null;
  surfaceId?: string | null;
};
type ScenaryManifest = { presets?: ScenaryManifestEntry[] };

async function fetchAppSceneryPresets(appId: string): Promise<AppSceneryPreset[]> {
  try {
    const res = await fetch(`/apps/${encodeURIComponent(appId)}/scenary/manifest.json`);
    if (!res.ok) return [];
    const manifest = (await res.json()) as ScenaryManifest;
    return (manifest.presets ?? []).map((p, i) => ({
      id: p.id ?? `${appId}-${i}`,
      name: p.name,
      appId,
      data: {
        sceneId: p.sceneId ?? null,
        envId: p.envId ?? null,
        envEra: p.envEra ?? null,
        envTime: p.envTime ?? null,
        surfaceId: p.surfaceId ?? null,
      },
    }));
  } catch {
    return [];
  }
}

// Fetches every installed app's shipped scenery presets in parallel and
// flattens them into one list, tagged with the appId each came from.
export async function fetchAllAppSceneryPresets(appIds: string[]): Promise<AppSceneryPreset[]> {
  const lists = await Promise.all(appIds.map(fetchAppSceneryPresets));
  return lists.flat();
}
