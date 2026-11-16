import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// KHR_node_visibility: exporters (Godot among them) write hidden nodes into
// the file with `visible: false` instead of leaving them out — CSG helper
// shapes, alternative versions of a prop, and so on. three.js's GLTFLoader
// doesn't know the extension yet and draws them all, so they show up as
// stray geometry and cast shadows over the parts that are meant to be seen
// (Strandpark2 has 148 of them). Hide them after loading; a hidden node
// hides its whole subtree, as the extension specifies.
type NodeJson = { extensions?: { KHR_node_visibility?: { visible?: boolean } } };

export function applyNodeVisibility(gltf: GLTF): number {
  const parser = gltf.parser as unknown as {
    json?: { nodes?: NodeJson[] };
    associations?: Map<THREE.Object3D, { nodes?: number }>;
  };
  const nodes = parser.json?.nodes;
  const assoc = parser.associations;
  if (!nodes || !assoc) return 0;
  let hidden = 0;
  gltf.scene.traverse((o) => {
    const idx = assoc.get(o)?.nodes;
    if (idx === undefined) return;
    if (nodes[idx]?.extensions?.KHR_node_visibility?.visible === false) {
      o.visible = false;
      hidden++;
    }
  });
  return hidden;
}
