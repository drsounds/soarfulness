import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paletteEntry } from "./palette";
import type { BlockRecord, ClayData, WatercraftSaveData } from "./types";
import { isWatercraftSaveData } from "./types";

// Everything here runs entirely in the browser: export writes a Blob the
// caller turns into a download link, import reads a File the caller got
// from an <input type="file">. No network round-trip either way.

export interface ExportSceneInputs {
  blocks: BlockRecord[];
  blockOrigin: { x: number; z: number };
  clay: ClayData;
  clayCenter: { x: number; z: number };
  raftMesh: THREE.Mesh;
  pedestalMesh: THREE.Mesh;
}

// Builds a standalone scene (real merged meshes, not InstancedMesh — so any
// glTF viewer renders it correctly) and stamps the full editable save data
// onto its root node's userData, which GLTFExporter serializes to that
// node's `extras`. Re-importing this exact file restores full editability;
// importing a GLB from elsewhere just drops its meshes onto the raft as a
// static decoration (see importWatercraftGlb below).
export async function exportWatercraftGlb(inputs: ExportSceneInputs): Promise<Blob> {
  const root = new THREE.Group();
  root.name = "AquafulnessWatercraft";

  const saveData: WatercraftSaveData = {
    kind: "aquafulness-watercraft",
    version: 1,
    blocks: inputs.blocks,
    clay: inputs.clay,
  };
  root.userData.aquaWatercraft = saveData;

  root.add(inputs.raftMesh.clone());
  root.add(inputs.pedestalMesh.clone());

  const byType = new Map<number, THREE.BufferGeometry[]>();
  for (const [x, y, z, blockType] of inputs.blocks) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(inputs.blockOrigin.x + x + 0.5, y + 0.5, inputs.blockOrigin.z + z + 0.5);
    let list = byType.get(blockType);
    if (!list) {
      list = [];
      byType.set(blockType, list);
    }
    list.push(geo);
  }
  for (const [blockType, geos] of byType) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const entry = paletteEntry(blockType);
    const mat = new THREE.MeshStandardMaterial({
      color: entry.color,
      roughness: entry.roughness,
      metalness: entry.metalness,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `blocks-${entry.name}`;
    root.add(mesh);
  }

  const clayMesh = new THREE.Mesh(
    buildClayGeometry(inputs.clay),
    new THREE.MeshStandardMaterial({
      color: 0xd9c9a8,
      roughness: 0.75,
      side: THREE.DoubleSide,
    }),
  );
  clayMesh.position.set(inputs.clayCenter.x, 0, inputs.clayCenter.z);
  clayMesh.name = "clay-pad";
  root.add(clayMesh);

  const exporter = new GLTFExporter();
  const buffer = (await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: true,
  })) as ArrayBuffer;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });

  return new Blob([buffer], { type: "model/gltf-binary" });
}

// Rebuilds the same flat-grid geometry SculptCanvas uses, purely for
// export — kept independent of the live SculptCanvas instance so a saved
// file's clay dimensions (segX/segZ) don't have to match the current app's.
function buildClayGeometry(clay: ClayData): THREE.BufferGeometry {
  const cols = clay.segX + 1;
  const rows = clay.segZ + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const idx = (ix: number, iz: number) => iz * cols + ix;

  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = idx(ix, iz);
      positions[i * 3] = (ix / clay.segX - 0.5) * clay.width;
      positions[i * 3 + 1] = clay.baseY + (clay.heights[i] ?? 0);
      positions[i * 3 + 2] = (iz / clay.segZ - 0.5) * clay.depth;
      uvs[i * 2] = ix / clay.segX;
      uvs[i * 2 + 1] = iz / clay.segZ;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < clay.segZ; iz++) {
    for (let ix = 0; ix < clay.segX; ix++) {
      const a = idx(ix, iz);
      const b = idx(ix + 1, iz);
      const c = idx(ix, iz + 1);
      const d = idx(ix + 1, iz + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export type ImportResult =
  { kind: "restored"; data: WatercraftSaveData } | { kind: "static"; scene: THREE.Group };

export async function importWatercraftGlb(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, "");

  let found: WatercraftSaveData | null = null;
  gltf.scene.traverse((obj) => {
    if (found) return;
    const candidate = obj.userData?.aquaWatercraft;
    if (isWatercraftSaveData(candidate)) found = candidate;
  });

  if (found) return { kind: "restored", data: found };
  return { kind: "static", scene: gltf.scene };
}
