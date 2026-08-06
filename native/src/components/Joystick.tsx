// RN port of the web app's on-screen joystick (src/components/Joystick.tsx),
// using PanResponder instead of pointer events. Emits a normalized
// (-1..1, -1..1) vector via onChange while dragged, and snaps back to
// {x:0,y:0} on release (non-sticky).
import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type GestureResponderEvent, type PanResponderGestureState } from "react-native";

export type StickValue = { x: number; y: number };

const RADIUS = 42;
const SIZE = RADIUS * 2 + 24;
const KNOB = 36;

export function Joystick({
  onChange,
  label = "NAV",
  style,
}: {
  onChange: (v: StickValue) => void;
  label?: string;
  style?: object;
}) {
  const knobX = useRef(0);
  const knobY = useRef(0);
  const [, setTick] = useState(0);
  const forceUpdate = useRef(() => setTick((n) => n + 1));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        let dx = gesture.dx;
        let dy = gesture.dy;
        const dist = Math.hypot(dx, dy);
        if (dist > RADIUS) {
          dx = (dx / dist) * RADIUS;
          dy = (dy / dist) * RADIUS;
        }
        knobX.current = dx;
        knobY.current = dy;
        forceUpdate.current();
        onChange({ x: dx / RADIUS, y: -dy / RADIUS });
      },
      onPanResponderRelease: () => {
        knobX.current = 0;
        knobY.current = 0;
        forceUpdate.current();
        onChange({ x: 0, y: 0 });
      },
      onPanResponderTerminate: () => {
        knobX.current = 0;
        knobY.current = 0;
        forceUpdate.current();
        onChange({ x: 0, y: 0 });
      },
    }),
  ).current;

  return (
    <View style={[styles.base, style]} {...panResponder.panHandlers}>
      <View style={styles.ring} pointerEvents="none" />
      <View
        style={[
          styles.knob,
          { transform: [{ translateX: knobX.current }, { translateY: knobY.current }] },
        ]}
        pointerEvents="none"
      />
      <Text style={styles.label} pointerEvents="none">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: SIZE - 24,
    height: SIZE - 24,
    borderRadius: (SIZE - 24) / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  label: {
    position: "absolute",
    top: 6,
    fontSize: 8,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.6)",
  },
});
