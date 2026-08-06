import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { OceanCanvas, type OceanSceneHandle } from "@/components/OceanCanvas";
import { Joystick, type StickValue } from "@/components/Joystick";
import { ControlsOverlay } from "@/components/ControlsOverlay";
import type { OceanScene } from "@/three/scene";

export function HomeScreen() {
  const handleRef = useRef<OceanSceneHandle | null>(null);
  const [, forceRerender] = useState(0);

  const onReady = useCallback((handle: OceanSceneHandle) => {
    handleRef.current = handle;
    forceRerender((n) => n + 1);
  }, []);

  const onNav = useCallback((v: StickValue) => handleRef.current?.setNav(v), []);
  const onLook = useCallback((v: StickValue) => handleRef.current?.setLook(v), []);

  const getScene = (): OceanScene | null => handleRef.current?.getScene() ?? null;

  return (
    <View style={styles.root}>
      <OceanCanvas onReady={onReady} />
      <Joystick label="NAV" onChange={onNav} style={styles.navStick} />
      <Joystick label="LOOK" onChange={onLook} style={styles.lookStick} />
      <ControlsOverlay scene={getScene()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#032033",
  },
  navStick: {
    position: "absolute",
    left: 24,
    bottom: 24,
  },
  lookStick: {
    position: "absolute",
    right: 24,
    bottom: 24,
  },
});
