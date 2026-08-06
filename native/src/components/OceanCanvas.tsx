// Mounts the react-native-webgpu Canvas, boots a THREE.WebGPURenderer bound
// to it, and drives the OceanScene's render loop. See
// src/three/webgpuRenderer.ts and src/three/scene.ts.
//
// UNVERIFIED: this has not been run on a real device/simulator (no GPU in
// this sandbox) — see NATIVE_APP.md.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useDevice, type CanvasRef } from "react-native-webgpu";
import type { NavInput, LookInput } from "@/three/scene";
import { OceanScene } from "@/three/scene";
import { createWebGPURenderer, sizeCanvasToLayout } from "@/three/webgpuRenderer";

export type OceanSceneHandle = {
  setNav: (v: NavInput) => void;
  setLook: (v: LookInput) => void;
  getScene: () => OceanScene | null;
};

export function OceanCanvas({ onReady }: { onReady?: (handle: OceanSceneHandle) => void }) {
  const { device } = useDevice();
  const canvasRef = useRef<CanvasRef>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const navRef = useRef<NavInput>({ x: 0, y: 0 });
  const lookRef = useRef<LookInput>({ x: 0, y: 0 });
  const sceneRef = useRef<OceanScene | null>(null);

  useEffect(() => {
    onReady?.({
      setNav: (v) => {
        navRef.current = v;
      },
      setLook: (v) => {
        lookRef.current = v;
      },
      getScene: () => sceneRef.current,
    });
  }, [onReady]);

  useEffect(() => {
    if (!device || layout.width === 0 || layout.height === 0) return;

    let cancelled = false;
    let raf = 0;
    let renderer: Awaited<ReturnType<typeof createWebGPURenderer>> | null = null;

    (async () => {
      const context = canvasRef.current?.getContext("webgpu");
      if (!context) return;

      renderer = await createWebGPURenderer(context, device);
      if (cancelled) return;

      const sceneObj = new OceanScene(layout.width, layout.height);
      sceneRef.current = sceneObj;
      let last = performance.now();

      const frame = () => {
        if (cancelled || !renderer || !sceneObj) return;
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 1 / 20);
        last = now;

        sizeCanvasToLayout(context);
        sceneObj.resize(layout.width, layout.height);
        sceneObj.update(dt, navRef.current, lookRef.current);
        renderer.render(sceneObj.scene, sceneObj.camera);
        context.present();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [device, layout.width, layout.height]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} />
    </View>
  );
}
