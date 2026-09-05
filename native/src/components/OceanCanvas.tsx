// Mounts the react-native-webgpu Canvas, boots a THREE.WebGPURenderer bound
// to it, and drives the OceanScene's render loop. See
// src/three/webgpuRenderer.ts and src/three/scene.ts.
//
// UNVERIFIED: this has not been run on a real device/simulator (no GPU in
// this sandbox) — see NATIVE_APP.md.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, useDevice, type CanvasRef } from "react-native-webgpu";
import type { NavInput, LookInput } from "@/three/scene";
import { OceanScene } from "@/three/scene";
import { createWebGPURenderer, sizeCanvasToLayout } from "@/three/webgpuRenderer";

export type OceanSceneHandle = {
  setNav: (v: NavInput) => void;
  setLook: (v: LookInput) => void;
  getScene: () => OceanScene | null;
};

// How long to wait for react-native-webgpu's useDevice() to resolve before
// showing a hint that it might just never resolve on this device, rather
// than leaving the screen silently black with no indication anything is
// wrong. Neither this sandbox nor (per report) the device being tested on
// has LogCat access right now, so this is the only diagnostic signal
// available for that failure mode.
const DEVICE_WAIT_HINT_MS = 6000;

export function OceanCanvas({ onReady }: { onReady?: (handle: OceanSceneHandle) => void }) {
  const { device } = useDevice();
  const canvasRef = useRef<CanvasRef>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [initError, setInitError] = useState<Error | null>(null);
  const [deviceSlow, setDeviceSlow] = useState(false);
  const navRef = useRef<NavInput>({ x: 0, y: 0 });
  const lookRef = useRef<LookInput>({ x: 0, y: 0 });
  const sceneRef = useRef<OceanScene | null>(null);

  useEffect(() => {
    if (device) return;
    const timer = setTimeout(() => setDeviceSlow(true), DEVICE_WAIT_HINT_MS);
    return () => clearTimeout(timer);
  }, [device]);

  useEffect(() => {
    if (!device || layout.width === 0 || layout.height === 0) return;

    let cancelled = false;
    let raf = 0;
    let renderer: Awaited<ReturnType<typeof createWebGPURenderer>> | null = null;

    (async () => {
      try {
        const context = canvasRef.current?.getContext("webgpu");
        if (!context) throw new Error("Canvas getContext('webgpu') returned no context");

        renderer = await createWebGPURenderer(context, device);
        if (cancelled) return;

        const sceneObj = new OceanScene(layout.width, layout.height);
        sceneRef.current = sceneObj;
        // Only now — once there's an actual scene to hand out — does the
        // handle become meaningful to whoever asked for it (HomeScreen's
        // ControlsOverlay reads getScene() off it). Firing onReady any
        // earlier would hand back a handle whose getScene() always returns
        // null, with nothing to prompt the parent to ever re-render and
        // pick up the real scene once it exists.
        onReady?.({
          setNav: (v) => {
            navRef.current = v;
          },
          setLook: (v) => {
            lookRef.current = v;
          },
          getScene: () => sceneRef.current,
        });
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
      } catch (err) {
        if (!cancelled) setInitError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [device, layout.width, layout.height, onReady]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} />
      {initError ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayTitle}>WebGPU init failed</Text>
          <Text style={styles.overlayText}>{initError.message}</Text>
        </View>
      ) : !device && deviceSlow ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayTitle}>Still waiting for a WebGPU device…</Text>
          <Text style={styles.overlayText}>
            react-native-webgpu's useDevice() hasn't resolved after {DEVICE_WAIT_HINT_MS / 1000}s.
            This device/emulator may not support WebGPU.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 60,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayTitle: {
    color: "#ff9c9c",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  overlayText: {
    color: "#e0a0a0",
    fontSize: 11,
  },
});
