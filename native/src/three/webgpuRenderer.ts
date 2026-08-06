// Bootstraps a THREE.WebGPURenderer bound to a react-native-webgpu canvas
// context. See:
// https://wcandillon.github.io/react-native-webgpu/docs/integrations/three-js
import * as THREE from "three/webgpu";
import { PixelRatio } from "react-native";
import type { RNCanvasContext } from "react-native-webgpu";

export function sizeCanvasToLayout(context: RNCanvasContext) {
  const canvas = context.canvas as unknown as HTMLCanvasElement;
  canvas.width = canvas.clientWidth * PixelRatio.get();
  canvas.height = canvas.clientHeight * PixelRatio.get();
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

export async function createWebGPURenderer(context: RNCanvasContext, device: GPUDevice) {
  sizeCanvasToLayout(context);

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: "opaque",
  });

  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    canvas: context.canvas as unknown as HTMLCanvasElement,
    context: context as unknown as GPUCanvasContext,
  });
  await renderer.init();
  return renderer;
}
