import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import type { DecorationControls } from "@/apps/decorations/DecorationPanel";
import { pickFileFromDevice } from "@/lib/deviceFiles";
import {
  DECORATION_MAX_PER_SCENE,
  decorationMaxBytes,
  decorationSceneKey,
  embedDecorationModel,
  importDecorationModel,
  isEmbeddedDecorationSrc,
  newDecoration,
  newDecorationId,
  pruneDecorationLibrary,
  sanitizeDecorations,
  unembedDecorationModel,
  type Decoration,
  type DecorationsByScene,
  type Vec3,
} from "@/apps/decorations/decorations";
import { DecorationLayer, type DecorationGizmoMode } from "@/apps/decorations/DecorationLayer";
import { UserSceneError } from "@/lib/userScenes";

// DEKORATIONER state for routes/index.tsx: the per-scene layout (a Persisted
// settings field), the three.js layer that mirrors it, and the controls
// object the settings section / HUD bar use. Kept out of index.tsx so the
// feature touches that file only at a few anchor points.

const round = (v: number) => Math.round(v * 100) / 100;

export function useDecorations({
  initial,
  sceneId,
  sceneName,
  onPlacingStart,
  extraKeptSrcs,
}: {
  initial: unknown;
  sceneId: string | null;
  sceneName: string;
  // Placement needs the scene visible: the caller closes settings here.
  onPlacingStart: () => void;
  // Local model refs still used by saved presets/states (kept on delete).
  extraKeptSrcs: () => string[];
}) {
  const { t } = useTranslation();
  const [decorations, setDecorations] = useState<DecorationsByScene>(() =>
    sanitizeDecorations(initial),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacingState] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<DecorationGizmoMode>("translate");
  const [gizmoSpace, setGizmoSpace] = useState<"local" | "world">("local");
  const [busy, setBusy] = useState(false);
  const layerRef = useRef<DecorationLayer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const sceneKey = decorationSceneKey(sceneId);
  const list = useMemo(() => decorations[sceneKey] ?? [], [decorations, sceneKey]);
  const listRef = useRef(list);
  listRef.current = list;

  const setList = useCallback(
    (fn: (l: Decoration[]) => Decoration[]) =>
      setDecorations((all) => {
        const next = fn(all[sceneKey] ?? []);
        const out = { ...all };
        if (next.length) out[sceneKey] = next;
        else delete out[sceneKey];
        return out;
      }),
    [sceneKey],
  );

  const update = useCallback(
    (id: string, patch: Partial<Decoration>) =>
      setList((l) => l.map((d) => (d.id === id ? { ...d, ...patch } : d))),
    [setList],
  );

  const updateRef = useRef(update);
  updateRef.current = update;

  // Builds the three.js layer; called from the WebGL setup effect, which owns
  // the scene/camera/canvas. Returns the cleanup.
  const attach = (scene: THREE.Scene, camera: THREE.Camera, dom: HTMLElement) => {
    cameraRef.current = camera;
    const layer = new DecorationLayer(scene, camera, dom, {
      onTransform: (id, tr) => updateRef.current(id, tr),
      onPick: (id) => id && setSelectedId(id),
      onModelError: (id, reason) => {
        const d = listRef.current.find((x) => x.id === id);
        console.warn(`Decoration "${d?.name ?? id}" ${reason}`);
      },
    });
    layerRef.current = layer;
    layer.setDecorations(listRef.current);
    return () => {
      layer.dispose();
      if (layerRef.current === layer) layerRef.current = null;
    };
  };

  useEffect(() => {
    layerRef.current?.setDecorations(list);
  }, [list]);
  useEffect(() => {
    layerRef.current?.select(selectedId);
  }, [selectedId, list]);
  useEffect(() => {
    layerRef.current?.setEditing(placing);
  }, [placing]);
  useEffect(() => {
    layerRef.current?.setMode(gizmoMode);
  }, [gizmoMode]);
  useEffect(() => {
    layerRef.current?.setSpace(gizmoSpace);
  }, [gizmoSpace]);
  // A different scene has its own list: drop the selection, stop placing.
  useEffect(() => {
    setSelectedId(null);
    setPlacingState(false);
  }, [sceneKey]);

  // A spot a few meters in front of the camera, and a yaw facing it.
  const viewSpot = (dist = 5): { position: Vec3; yaw: number } => {
    const cam = cameraRef.current;
    if (!cam) return { position: [0, 0, -dist], yaw: 0 };
    const p = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const at = p.addScaledVector(dir, dist);
    const yaw = (Math.atan2(-dir.x, -dir.z) * 180) / Math.PI;
    return { position: [round(at.x), round(at.y - 1), round(at.z)], yaw: round(yaw) };
  };

  const errorMessage = (err: unknown) => {
    const code = err instanceof UserSceneError ? err.code : "corrupt";
    return t(`userScenes.errors.${code}`, {
      max: Math.round(decorationMaxBytes() / (1024 * 1024)),
    });
  };

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const model = await importDecorationModel(file);
      const spot = viewSpot();
      const d = newDecoration(model, spot.position, spot.yaw);
      // Fit huge (cm-unit) or tiny models to about 2 m on first placement.
      const size = await layerRef.current?.measure(d.src).catch(() => null);
      if (size && (size > 40 || size < 0.05)) {
        const k = +(2 / size).toPrecision(3);
        d.scale = [k, k, k];
      }
      setList((l) => (l.length >= DECORATION_MAX_PER_SCENE ? l : [...l, d]));
      setSelectedId(d.id);
      if (!model.embedded) window.alert(t("decorations.importedLocal"));
    } catch (err) {
      console.error("Importing decoration failed", err);
      window.alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const controls: DecorationControls = {
    list,
    sceneName,
    selectedId: list.some((d) => d.id === selectedId) ? selectedId : (list[0]?.id ?? null),
    setSelectedId,
    update,
    busy,
    importModel: () =>
      pickFileFromDevice(".glb,model/gltf-binary", (file) => void importFile(file), {
        binary: true,
        maxBytes: decorationMaxBytes(),
        onError: (err) => window.alert(errorMessage(err)),
      }),
    duplicate: (id) => {
      const src = list.find((d) => d.id === id);
      if (!src || list.length >= DECORATION_MAX_PER_SCENE) return;
      const copy: Decoration = {
        ...structuredClone(src),
        id: newDecorationId(),
        position: [src.position[0] + 1, src.position[1], src.position[2] + 1],
      };
      setList((l) => [...l, copy]);
      setSelectedId(copy.id);
    },
    remove: (id) => {
      const d = list.find((x) => x.id === id);
      if (!d || !window.confirm(t("decorations.removeConfirm", { name: d.name }))) return;
      let next: DecorationsByScene = {};
      setDecorations((all) => {
        const l = (all[sceneKey] ?? []).filter((x) => x.id !== id);
        next = { ...all };
        if (l.length) next[sceneKey] = l;
        else delete next[sceneKey];
        return next;
      });
      // Free the stored model once nothing refers to it any more.
      if (!isEmbeddedDecorationSrc(d.src)) {
        window.setTimeout(() => void pruneDecorationLibrary(next, extraKeptSrcs()), 0);
      }
    },
    moveToView: (id) => {
      const spot = viewSpot();
      const d = list.find((x) => x.id === id);
      if (!d) return;
      update(id, { position: spot.position, rotation: [d.rotation[0], spot.yaw, d.rotation[2]] });
    },
    toggleEmbed: (id) => {
      const d = list.find((x) => x.id === id);
      if (!d) return;
      setBusy(true);
      (isEmbeddedDecorationSrc(d.src) ? unembedDecorationModel(d) : embedDecorationModel(d.src))
        .then((src) => update(id, { src }))
        .catch((err) => {
          console.error("Changing decoration storage failed", err);
          window.alert(errorMessage(err));
        })
        .finally(() => setBusy(false));
    },
    placing,
    setPlacing: (on) => {
      if (on) onPlacingStart();
      setPlacingState(on);
    },
    gizmoMode,
    setGizmoMode,
    gizmoSpace,
    setGizmoSpace,
  };

  return {
    decorations,
    setDecorations,
    sceneKey,
    controls,
    attach,
    /** The group holding every placed decoration (null before attach). */
    getRoot: () => layerRef.current?.root ?? null,
  };
}
