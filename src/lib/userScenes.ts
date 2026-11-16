import { Capacitor } from "@capacitor/core";

// EGNA SCENER: .glb files the player imports from their own device, kept as
// "shortcuts" in the scene list across restarts. The model itself is copied
// into this device's IndexedDB (a file handle/URI from the picker doesn't
// survive a restart in the browser or the Android app's WebView, so the
// bytes have to be stored), with the small name/size list kept in a separate
// object store so listing scenes never has to pull every model into memory.
//
// User scenes are mixed into the regular scene list as AppSceneEntry rows
// tagged with USER_SCENE_APP_ID, and their ids carry USER_SCENE_ID_PREFIX so
// a persisted sceneId can be told apart from a catalog scene before the
// IndexedDB list has loaded.

export const USER_SCENE_APP_ID = "__user__";
export const USER_SCENE_ID_PREFIX = "user:";

// Largest file accepted. Inside the Android app the picked file crosses the
// native bridge as one base64 string (see deviceFiles.ts), which costs about
// 4× the file size in memory at its peak, so the app's cap is much lower
// than the browser's.
export const USER_SCENE_MAX_BYTES_WEB = 300 * 1024 * 1024;
export const USER_SCENE_MAX_BYTES_NATIVE = 64 * 1024 * 1024;
export function userSceneMaxBytes(): number {
  return Capacitor.isNativePlatform() ? USER_SCENE_MAX_BYTES_NATIVE : USER_SCENE_MAX_BYTES_WEB;
}

export type UserSceneMeta = { id: string; name: string; size: number; addedAt: string };

export type UserSceneErrorCode =
  | "empty"
  | "tooLarge"
  | "notGlb"
  | "unsupportedVersion"
  | "corrupt"
  | "storageFull"
  | "storageUnavailable";

export class UserSceneError extends Error {
  constructor(
    readonly code: UserSceneErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "UserSceneError";
  }
}

export function isUserSceneId(id: string | null | undefined): id is string {
  return typeof id === "string" && id.startsWith(USER_SCENE_ID_PREFIX);
}

// ---- GLB validation -------------------------------------------------------

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const GLB_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

// Checks a binary glTF 2.0 container without parsing the whole model: the
// 12-byte header (magic, version, total length) and the leading JSON chunk,
// which must parse and declare asset.version 2.x. Throws a UserSceneError
// with the reason. Exported for tests.
export function validateGlb(buffer: ArrayBuffer): void {
  if (buffer.byteLength === 0) throw new UserSceneError("empty");
  if (buffer.byteLength < GLB_HEADER_BYTES + CHUNK_HEADER_BYTES) {
    throw new UserSceneError("notGlb");
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new UserSceneError("notGlb");
  const version = view.getUint32(4, true);
  if (version !== 2) throw new UserSceneError("unsupportedVersion");
  const length = view.getUint32(8, true);
  if (length > buffer.byteLength || length < GLB_HEADER_BYTES + CHUNK_HEADER_BYTES) {
    throw new UserSceneError("corrupt", "truncated file");
  }
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  const jsonStart = GLB_HEADER_BYTES + CHUNK_HEADER_BYTES;
  if (jsonType !== CHUNK_JSON || jsonStart + jsonLength > length) {
    throw new UserSceneError("corrupt", "missing JSON chunk");
  }
  let json: { asset?: { version?: unknown } };
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, jsonStart, jsonLength)));
  } catch {
    throw new UserSceneError("corrupt", "unreadable JSON chunk");
  }
  const assetVersion = json?.asset?.version;
  if (typeof assetVersion !== "string" || !assetVersion.startsWith("2")) {
    throw new UserSceneError("unsupportedVersion");
  }
}

// "My Beach.glb" → "My Beach". Falls back to a generic name for files with
// no usable name (some Android providers hand back only an id).
export function sceneNameFromFile(filename: string, fallback = "GLB"): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const name = base.replace(/\.(glb|gltf)$/i, "").trim();
  return (name || fallback).slice(0, 60);
}

// ---- IndexedDB storage ----------------------------------------------------
//
// One "GLB library" per IndexedDB database: a `meta` store with the small
// name/size rows and a `data` store with the model bytes. EGNA SCENER uses
// the one below; DEKORATIONER (src/apps/decorations/decorations.ts) has its own library
// built from the same factory so the two lists never mix.

export type GlbLibrary<M extends UserSceneMeta = UserSceneMeta> = {
  list(): Promise<M[]>;
  get(id: string): Promise<ArrayBuffer | null>;
  add(file: File): Promise<M>;
  remove(id: string): Promise<void>;
};

function isQuotaError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const META_STORE = "meta";
const DATA_STORE = "data";

// Reads a picked file and checks it is a glTF 2.0 binary within `maxBytes`.
// Throws a UserSceneError with the reason. Shared by every GLB library.
export async function readGlbFile(
  file: File,
  maxBytes = userSceneMaxBytes(),
): Promise<ArrayBuffer> {
  if (file.size === 0) throw new UserSceneError("empty");
  if (file.size > maxBytes) throw new UserSceneError("tooLarge");

  // Cheap header check first so a wrong file type fails before reading the
  // whole thing into memory.
  const head = await file.slice(0, GLB_HEADER_BYTES).arrayBuffer();
  if (head.byteLength < GLB_HEADER_BYTES || new DataView(head).getUint32(0, true) !== GLB_MAGIC) {
    throw new UserSceneError("notGlb");
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    throw new UserSceneError("tooLarge", String(err));
  }
  validateGlb(buffer);
  return buffer;
}

export function createGlbLibrary(dbName: string, idPrefix: string): GlbLibrary {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new UserSceneError("storageUnavailable"));
    }
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new UserSceneError("storageUnavailable", String(req.error)));
        req.onblocked = () => reject(new UserSceneError("storageUnavailable", "blocked"));
      });
      // Let a later call retry (e.g. after a private-mode refusal is lifted).
      dbPromise.catch(() => {
        dbPromise = null;
      });
    }
    return dbPromise;
  }

  function newId(): string {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${idPrefix}${rand}`;
  }

  return {
    // Every saved model, oldest first. Never throws: no storage → empty.
    async list() {
      try {
        const db = await openDb();
        const tx = db.transaction(META_STORE, "readonly");
        const all = await request(
          tx.objectStore(META_STORE).getAll() as IDBRequest<UserSceneMeta[]>,
        );
        return all.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
      } catch (err) {
        console.warn(`Couldn't list ${dbName}`, err);
        return [];
      }
    },

    // The stored model bytes, or null if the model is gone.
    async get(id) {
      const db = await openDb();
      const tx = db.transaction(DATA_STORE, "readonly");
      const data = await request(tx.objectStore(DATA_STORE).get(id) as IDBRequest<unknown>);
      if (data instanceof ArrayBuffer) return data;
      if (data instanceof Blob) return data.arrayBuffer();
      return null;
    },

    // Validates and stores a picked .glb. Throws a UserSceneError on any
    // problem (too big, not a glTF 2.0 binary, storage full/unavailable).
    async add(file) {
      const buffer = await readGlbFile(file);

      // Refuse up front when the browser already says it won't fit, rather
      // than letting a half-written transaction fail.
      try {
        const est = await navigator.storage?.estimate?.();
        if (est?.quota && est.usage !== undefined && est.usage + buffer.byteLength > est.quota) {
          throw new UserSceneError("storageFull");
        }
        // Best effort: ask the browser not to evict imported models under
        // storage pressure.
        void navigator.storage?.persist?.().catch(() => undefined);
      } catch (err) {
        if (err instanceof UserSceneError) throw err;
      }

      const meta: UserSceneMeta = {
        id: newId(),
        name: sceneNameFromFile(file.name),
        size: buffer.byteLength,
        addedAt: new Date().toISOString(),
      };
      const db = await openDb();
      try {
        const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
        tx.objectStore(DATA_STORE).put(buffer, meta.id);
        tx.objectStore(META_STORE).put(meta);
        await txDone(tx);
      } catch (err) {
        if (isQuotaError(err)) throw new UserSceneError("storageFull");
        throw new UserSceneError("storageUnavailable", String(err));
      }
      return meta;
    },

    async remove(id) {
      const db = await openDb();
      const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
      tx.objectStore(DATA_STORE).delete(id);
      tx.objectStore(META_STORE).delete(id);
      await txDone(tx);
    },
  };
}

const userSceneLibrary = createGlbLibrary("aquafulness-user-scenes", USER_SCENE_ID_PREFIX);

// Every saved user scene, oldest first. Never throws: no storage → empty.
export const listUserScenes = (): Promise<UserSceneMeta[]> => userSceneLibrary.list();

// The stored model bytes, or null if the scene is gone.
export const getUserSceneData = (id: string): Promise<ArrayBuffer | null> =>
  userSceneLibrary.get(id);

// Validates and stores a picked .glb. Throws a UserSceneError on any problem
// (too big, not a glTF 2.0 binary, storage full/unavailable).
export const addUserScene = (file: File): Promise<UserSceneMeta> => userSceneLibrary.add(file);

export const removeUserScene = (id: string): Promise<void> => userSceneLibrary.remove(id);
