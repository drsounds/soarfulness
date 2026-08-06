// A deliberately small subset of the web app's ~2000-line SettingsPanel —
// just enough live-tunable dials to prove the uniform-wiring path end to
// end. See NATIVE_APP.md for the full list of settings that aren't exposed
// here yet.
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { OceanScene } from "@/three/scene";

function Stepper({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
  max = 3,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Pressable style={styles.btn} onPress={() => onChange(Math.max(min, value - step))}>
        <Text style={styles.btnText}>-</Text>
      </Pressable>
      <Text style={styles.value}>{value.toFixed(2)}</Text>
      <Pressable style={styles.btn} onPress={() => onChange(Math.min(max, value + step))}>
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

export function ControlsOverlay({ scene }: { scene: OceanScene | null }) {
  const [open, setOpen] = useState(false);
  const [amp, setAmp] = useState(1);
  const [freq, setFreq] = useState(1);
  const [realistic, setRealistic] = useState(false);

  if (!open) {
    return (
      <Pressable style={styles.toggle} onPress={() => setOpen(true)}>
        <Text style={styles.toggleText}>VÅGOR</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <Pressable style={styles.close} onPress={() => setOpen(false)}>
        <Text style={styles.toggleText}>×</Text>
      </Pressable>
      <Stepper
        label="VÅG"
        value={amp}
        onChange={(v) => {
          setAmp(v);
          if (scene) scene.waveAmp = v;
        }}
      />
      <Stepper
        label="FREKVENS"
        value={freq}
        min={0.2}
        max={3}
        onChange={(v) => {
          setFreq(v);
          if (scene) scene.waveFreq = v;
        }}
      />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>REALISTISKA VÅGOR</Text>
        <Switch
          value={realistic}
          onValueChange={(v) => {
            setRealistic(v);
            if (scene) scene.realistic = v;
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  toggleText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    letterSpacing: 2,
  },
  panel: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 220,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    gap: 8,
  },
  close: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  rowLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    letterSpacing: 1,
    flex: 1,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  btnText: {
    color: "white",
    fontSize: 14,
  },
  value: {
    color: "white",
    fontSize: 11,
    width: 36,
    textAlign: "center",
  },
});
