// Two-way sync between the saved lists on this device (presets.ts,
// sceneryPresets.ts) and the user's Spacify account (src/lib/spacify.ts).
// Pure functions only; use-spacify-sync.ts runs them.
//
// Each kind keeps a "synced" map: item id → fingerprint of the version both
// sides last agreed on. Comparing each side against it tells an edit from
// an untouched copy and a deletion from something that's simply new:
//
// | here        | Spacify     | synced map | result                        |
// | ----------- | ----------- | ---------- | ----------------------------- |
// | = Spacify   | = here      | any        | in sync                       |
// | unchanged   | changed     | id         | take Spacify's                |
// | changed     | unchanged   | id         | push ours                     |
// | changed     | changed     | id / none  | Spacify's wins (newer device) |
// | missing     | present     | id         | deleted here: delete there    |
// | missing     | present     | none       | new there: add here           |
// | present     | missing     | id         | deleted there: delete here    |
// | present     | missing     | none       | new here: push                |

export type SyncKind = "state" | "preset" | "scenery";
export const SYNC_KINDS: SyncKind[] = ["state", "preset", "scenery"];

/** The shape every saved list shares (SavedState, SavedPreset, SavedSceneryPreset). */
export type LocalItem = {
  id: string;
  name: string;
  savedAt: string;
  scope?: string;
  data: unknown;
};

/** A save as the app API returns it (spacify's api_soarfulness_save_json). */
export type RemoteSave = {
  local_id: string;
  kind: SyncKind;
  name: string;
  scope: string | null;
  saved_at: string;
  data: Record<string, unknown>;
};

export type SyncedMap = Record<string, string>;

// Postgres' jsonb reorders object keys and timestamps come back in another
// format, so both are normalised before comparing.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function fingerprint(item: LocalItem): string {
  return JSON.stringify(canonical([item.name, item.scope ?? null, time(item.savedAt), item.data]));
}

export function fromRemote<T extends LocalItem>(save: RemoteSave): T {
  const item: LocalItem = {
    id: save.local_id,
    name: save.name,
    savedAt: save.saved_at,
    data: save.data,
  };
  if (save.scope) item.scope = save.scope;
  return item as T;
}

function isEmptyData(data: unknown): boolean {
  return !data || typeof data !== "object" || Object.keys(data).length === 0;
}

/**
 * Merges what Spacify has into the list here. Returns the new list and the
 * synced map; whatever still differs from the map afterwards is for
 * `pendingChanges` to send.
 */
export function mergeRemote<T extends LocalItem>(
  local: T[],
  remote: RemoteSave[],
  synced: SyncedMap,
): { list: T[]; synced: SyncedMap; changed: boolean } {
  const next: SyncedMap = { ...synced };
  const remoteById = new Map(remote.map((r) => [r.local_id, r]));
  const list: T[] = [];
  let changed = false;

  for (const item of local) {
    const save = remoteById.get(item.id);
    if (!save) {
      if (item.id in synced) {
        // Deleted in Spacify (or on another device) since the last sync.
        delete next[item.id];
        changed = true;
      } else {
        list.push(item); // New here; pendingChanges pushes it.
      }
      continue;
    }
    const theirs = fromRemote<T>(save);
    const ours = fingerprint(item);
    const theirsFp = fingerprint(theirs);
    if (ours === theirsFp) {
      next[item.id] = ours;
      list.push(item);
    } else if (ours === synced[item.id] || theirsFp !== synced[item.id]) {
      // Untouched here, or edited on both sides: Spacify's copy wins.
      next[item.id] = theirsFp;
      list.push(theirs);
      changed = true;
    } else {
      list.push(item); // Edited here only; pendingChanges pushes it.
    }
  }

  const localIds = new Set(local.map((i) => i.id));
  for (const save of remote) {
    if (localIds.has(save.local_id)) continue;
    // In the synced map but gone here: deleted on this device while
    // offline, so pendingChanges deletes it there. Otherwise it's new from
    // another device (or Spacify's UI; an empty one isn't loadable).
    if (save.local_id in synced || isEmptyData(save.data)) continue;
    const theirs = fromRemote<T>(save);
    next[save.local_id] = fingerprint(theirs);
    list.push(theirs);
    changed = true;
  }

  if (changed) list.sort((a, b) => time(a.savedAt) - time(b.savedAt));
  return { list, synced: next, changed };
}

/** What to send Spacify so it matches the list here. */
export function pendingChanges<T extends LocalItem>(
  local: T[],
  synced: SyncedMap,
): { puts: T[]; deletes: string[] } {
  const puts = local.filter((item) => synced[item.id] !== fingerprint(item));
  const ids = new Set(local.map((i) => i.id));
  const deletes = Object.keys(synced).filter((id) => !ids.has(id));
  return { puts, deletes };
}
