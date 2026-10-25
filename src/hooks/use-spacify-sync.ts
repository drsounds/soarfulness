import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  setSpacifySyncHandler,
  setSpacifySyncStatus,
  spacifyApi,
  SpacifySignedOutError,
  useSpacify,
} from "@/lib/spacify";
import {
  fingerprint,
  mergeRemote,
  pendingChanges,
  SYNC_KINDS,
  type LocalItem,
  type RemoteSave,
  type SyncedMap,
  type SyncKind,
} from "@/lib/spacifySync";

const SYNCED_KEY = "aquafulness:spacify:synced:v1";

type SyncedStore = { userId: string; maps: Record<SyncKind, SyncedMap> };

function emptyMaps(): Record<SyncKind, SyncedMap> {
  return { state: {}, preset: {}, scenery: {} };
}

// Per account: signing in as someone else starts over, so their saves and
// this device's aren't mistaken for deletions on either side.
function loadSynced(userId: string): Record<SyncKind, SyncedMap> {
  try {
    const raw = window.localStorage.getItem(SYNCED_KEY);
    const store = raw ? (JSON.parse(raw) as SyncedStore) : null;
    if (store?.userId === userId && store.maps) return { ...emptyMaps(), ...store.maps };
  } catch {
    /* fall through */
  }
  return emptyMaps();
}

function saveSynced(userId: string, maps: Record<SyncKind, SyncedMap>) {
  try {
    window.localStorage.setItem(SYNCED_KEY, JSON.stringify({ userId, maps } satisfies SyncedStore));
  } catch {
    /* quota or privacy mode: the next sync just compares everything again */
  }
}

export type SyncedList<T extends LocalItem> = {
  list: T[];
  setList: Dispatch<SetStateAction<T[]>>;
  /** Persists a whole list (presets.ts' replaceSaved*), returning it. */
  replace: (list: T[]) => T[];
};

/** Adapts one of the saved lists' state + persist function for the hook. */
export function syncedList<T extends LocalItem>(
  list: T[],
  setList: Dispatch<SetStateAction<T[]>>,
  replace: (list: T[]) => T[],
): SyncedList<LocalItem> {
  // The hook only hands back items it got from this list or from Spacify
  // for the same kind, so they're T as far as the list is concerned.
  return { list, setList, replace } as unknown as SyncedList<LocalItem>;
}

/**
 * Keeps the saved states, presets and scenery presets in step with the
 * signed-in Spacify account (see src/lib/spacifySync.ts for the rules).
 * Does nothing while signed out.
 */
export function useSpacifySync(lists: Record<SyncKind, SyncedList<LocalItem>>) {
  const { session } = useSpacify();
  const userId = session?.userId ?? null;
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const mapsRef = useRef<Record<SyncKind, SyncedMap>>(emptyMaps());
  // Pushing before the first pull would treat everything there as deleted.
  const pulledRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback((task: () => Promise<void>) => {
    const run = queueRef.current.then(task).catch((error: unknown) => {
      if (error instanceof SpacifySignedOutError) {
        setSpacifySyncStatus("idle");
        return;
      }
      setSpacifySyncStatus("error", error instanceof Error ? error.message : String(error));
    });
    queueRef.current = run;
    return run;
  }, []);

  const push = useCallback(async (uid: string) => {
    for (const kind of SYNC_KINDS) {
      const { puts, deletes } = pendingChanges(listsRef.current[kind].list, mapsRef.current[kind]);
      for (const item of puts) {
        await spacifyApi(`/soarfulness/saves/${kind}/${encodeURIComponent(item.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            name: item.name,
            scope: item.scope ?? null,
            saved_at: item.savedAt,
            data: item.data,
          }),
        });
        mapsRef.current[kind] = { ...mapsRef.current[kind], [item.id]: fingerprint(item) };
        saveSynced(uid, mapsRef.current);
      }
      for (const id of deletes) {
        await spacifyApi(`/soarfulness/saves/${kind}/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const next = { ...mapsRef.current[kind] };
        delete next[id];
        mapsRef.current[kind] = next;
        saveSynced(uid, mapsRef.current);
      }
    }
  }, []);

  const syncNow = useCallback(() => {
    if (!userId) return Promise.resolve();
    const uid = userId;
    return enqueue(async () => {
      setSpacifySyncStatus("syncing");
      const remote = await spacifyApi<RemoteSave[]>("/soarfulness/saves");
      for (const kind of SYNC_KINDS) {
        const { list, replace, setList } = listsRef.current[kind];
        const merged = mergeRemote(
          list,
          remote.filter((r) => r.kind === kind),
          mapsRef.current[kind],
        );
        mapsRef.current[kind] = merged.synced;
        if (merged.changed) {
          replace(merged.list);
          setList(merged.list);
          // Read by push() below, before React has re-rendered.
          listsRef.current = {
            ...listsRef.current,
            [kind]: { ...listsRef.current[kind], list: merged.list },
          };
        }
      }
      saveSynced(uid, mapsRef.current);
      pulledRef.current = true;
      await push(uid);
      setSpacifySyncStatus("synced");
    });
  }, [userId, enqueue, push]);

  // Sign-in (or a page load while signed in): pull, merge, push.
  useEffect(() => {
    pulledRef.current = false;
    if (!userId) return;
    mapsRef.current = loadSynced(userId);
    void syncNow();
  }, [userId, syncNow]);

  // The "Sync now" button (SpacifyControls in SettingsPanel.tsx).
  useEffect(() => {
    if (!userId) return;
    setSpacifySyncHandler(() => void syncNow());
    return () => setSpacifySyncHandler(null);
  }, [userId, syncNow]);

  // Changes on another device show up when coming back to this one.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", syncNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", syncNow);
    };
  }, [userId, syncNow]);

  // Anything saved, renamed or deleted here goes up shortly after.
  const { state, preset, scenery } = lists;
  useEffect(() => {
    if (!userId || !pulledRef.current) return;
    const uid = userId;
    const timer = window.setTimeout(() => {
      void enqueue(async () => {
        if (!pulledRef.current) return;
        setSpacifySyncStatus("syncing");
        await push(uid);
        setSpacifySyncStatus("synced");
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [userId, state.list, preset.list, scenery.list, enqueue, push]);

  return { syncNow };
}
