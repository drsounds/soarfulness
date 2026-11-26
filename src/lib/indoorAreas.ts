import * as THREE from "three";

export function collectIndoorAreas(root: THREE.Object3D): THREE.Box3[] {
  root.updateMatrixWorld(true);
  const areas: THREE.Box3[] = [];
  root.traverse((object) => {
    if (!/(?:^|[-_])indoors(?:$|[-_])/i.test(object.name)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (!bounds.isEmpty()) areas.push(bounds);
    object.visible = false;
  });
  return areas;
}

export function isInsideIndoorArea(point: THREE.Vector3, areas: readonly THREE.Box3[]): boolean {
  return areas.some((area) => area.containsPoint(point));
}
