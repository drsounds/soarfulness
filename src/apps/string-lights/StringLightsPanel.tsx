import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { EdgeLightsPanel } from "./EdgeLightsPanel";
import {
  STRING_LIGHTS_MAX_EMITTERS,
  STRING_LIGHTS_MAX_BULBS,
  STRING_LIGHTS_MAX_STRINGS,
  STRING_LIGHT_ANIMS,
  STRING_LIGHT_BULBS,
  STRING_LIGHT_CURVES,
  STRING_LIGHT_MAX_CUSTOM_COLORS,
  STRING_LIGHT_PALETTE_IDS,
  STRING_LIGHT_PATTERNS,
  newStringLightId,
  setSceneStrings,
  setStringLights,
  stringInFrontOfView,
  stringLightColors,
  stringLightsView,
  stringsForScene,
  useStringLights,
  type StringLight,
} from "./stringLights";

// LJUSSLINGOR settings (MILJÖ tab, under NEON). Self-contained: it reads and
// writes the string-lights store directly (apps/string-lights/stringLights.ts), so the
// settings panel only has to mount it. Strings belong to the current scene.

type NumKey = {
  [K in keyof StringLight]: StringLight[K] extends number ? K : never;
}[keyof StringLight];

const btnClass =
  "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";
const colorLabel =
  "flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md";
const colorInput = "h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0";

export function StringLightsPanel() {
  const { t } = useTranslation();
  const [state, sceneKey] = useStringLights();
  const [selRaw, setSel] = useState(0);
  const [section, setSection] = useState(0);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const strings = stringsForScene(state, sceneKey);
  const sel = Math.max(0, Math.min(selRaw, strings.length - 1));
  const s = strings[sel] as StringLight | undefined;

  const patch = (p: Partial<StringLight>) => {
    if (!s) return;
    setSceneStrings(sceneKey, (list) => list.map((x) => (x.id === s.id ? { ...x, ...p } : x)));
  };
  const setOn = (on: boolean) => {
    setStringLights((st) => ({ ...st, on }));
    // First time on in this scene: hang one string in front of the view.
    if (on && !strings.length) setSceneStrings(sceneKey, () => [stringInFrontOfView()]);
  };

  const num = (
    key: NumKey,
    label: string,
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string,
  ) => {
    if (!s) return null;
    const v = s[key] as number;
    const clamp = (x: number) => Math.max(min, Math.min(max, +x.toFixed(4)));
    return (
      <SettingRow
        key={key}
        label={label}
        mode="number"
        value={fmt(v)}
        rawValue={v}
        min={min}
        max={max}
        step={step}
        onSet={(x) => patch({ [key]: clamp(x) } as Partial<StringLight>)}
        onDec={() => patch({ [key]: clamp(v - step) } as Partial<StringLight>)}
        onInc={() => patch({ [key]: clamp(v + step) } as Partial<StringLight>)}
      />
    );
  };
  const m = (v: number) => `${v.toFixed(2)} m`;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  function cycle<T extends string>(
    key: keyof StringLight,
    label: string,
    list: readonly T[],
    i18n: string,
  ) {
    if (!s) return null;
    const cur = s[key] as T;
    const i = Math.max(0, list.indexOf(cur));
    return (
      <SettingRow
        key={key}
        label={label}
        value={t(`${i18n}.${cur}`)}
        options={list.map((x) => t(`${i18n}.${x}`))}
        selectedIndex={i}
        onSelectIndex={(j) => patch({ [key]: list[j] } as Partial<StringLight>)}
        onDec={() =>
          patch({ [key]: list[(i - 1 + list.length) % list.length] } as Partial<StringLight>)
        }
        onInc={() => patch({ [key]: list[(i + 1) % list.length] } as Partial<StringLight>)}
      />
    );
  }
  const toggle = (key: "visible" | "emitLight", label: string) =>
    s ? (
      <SettingRow
        key={key}
        label={label}
        value={onOff(s[key])}
        onDec={() => patch({ [key]: false })}
        onInc={() => patch({ [key]: true })}
      />
    ) : null;

  const sections = ["placement", "curve", "bulbs", "colors", "animation"] as const;
  const sectionId = sections[section];

  return (
    <>
      <SettingRow
        label={t("stringLights.title")}
        value={onOff(state.on)}
        onDec={() => setOn(false)}
        onInc={() => setOn(true)}
      />
      {state.on && (
        <>
          <SettingRow
            label={t("stringLights.string")}
            value={strings.length ? `${sel + 1} / ${strings.length}` : "—"}
            onDec={() => strings.length && setSel((sel - 1 + strings.length) % strings.length)}
            onInc={() => strings.length && setSel((sel + 1) % strings.length)}
          />
          <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
            <button
              disabled={strings.length >= STRING_LIGHTS_MAX_STRINGS}
              onClick={() => {
                setSceneStrings(sceneKey, (list) => [...list, stringInFrontOfView()]);
                setSel(strings.length);
              }}
              className={btnClass}
            >
              {t("stringLights.addInFront")}
            </button>
            <button
              disabled={!s || strings.length >= STRING_LIGHTS_MAX_STRINGS}
              onClick={() => {
                if (!s) return;
                // The copy hangs a metre further along, so it's visible.
                const yaw = (s.yaw * Math.PI) / 180;
                const copy: StringLight = {
                  ...s,
                  customColors: [...s.customColors],
                  id: newStringLightId(),
                  x: +(s.x - Math.sin(yaw) * 1.5).toFixed(2),
                  z: +(s.z + Math.cos(yaw) * 1.5).toFixed(2),
                };
                setSceneStrings(sceneKey, (list) => [...list, copy]);
                setSel(strings.length);
              }}
              className={btnClass}
            >
              {t("stringLights.duplicate")}
            </button>
            <button
              disabled={!s}
              onClick={() => {
                if (!s) return;
                const fresh = stringInFrontOfView();
                patch({ x: fresh.x, z: fresh.z, yaw: fresh.yaw });
              }}
              className={btnClass}
            >
              {t("stringLights.moveHere")}
            </button>
            <button
              disabled={!s}
              onClick={() => {
                if (!s) return;
                setSceneStrings(sceneKey, (list) => list.filter((x) => x.id !== s.id));
                setSel(Math.max(0, sel - 1));
              }}
              className={btnClass}
            >
              {t("stringLights.remove")}
            </button>
          </div>
          {s && (
            <>
              {toggle("visible", t("stringLights.visible"))}
              <SettingRow
                label={t("stringLights.section")}
                value={t(`stringLights.sections.${sectionId}`)}
                options={sections.map((x) => t(`stringLights.sections.${x}`))}
                selectedIndex={section}
                onSelectIndex={setSection}
                onDec={() => setSection((section - 1 + sections.length) % sections.length)}
                onInc={() => setSection((section + 1) % sections.length)}
              />
              {sectionId === "placement" && (
                <>
                  {num("x", t("stringLights.x"), -500, 500, 0.5, m)}
                  {num("z", t("stringLights.z"), -500, 500, 0.5, m)}
                  {num("yaw", t("stringLights.yaw"), -180, 180, 5, (v) => `${v.toFixed(0)}°`)}
                  {num("span", t("stringLights.span"), 0.5, 200, 0.5, m)}
                  {num("heightA", t("stringLights.heightA"), -2, 60, 0.1, m)}
                  {num("heightB", t("stringLights.heightB"), -2, 60, 0.1, m)}
                </>
              )}
              {sectionId === "curve" && (
                <>
                  {cycle(
                    "curve",
                    t("stringLights.curve"),
                    STRING_LIGHT_CURVES,
                    "stringLights.curves",
                  )}
                  {s.curve !== "straight" && num("sag", t("stringLights.sag"), 0, 30, 0.05, m)}
                  {s.curve === "festoon" &&
                    num("drapes", t("stringLights.drapes"), 1, 12, 1, (v) => `${v}`)}
                  {num("sway", t("stringLights.sway"), 0, 1, 0.05, pct)}
                  <label className={colorLabel}>
                    <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                      {t("stringLights.wireColor")}
                    </span>
                    <input
                      type="color"
                      value={s.wireColor}
                      onChange={(e) => patch({ wireColor: e.target.value })}
                      className={colorInput}
                    />
                  </label>
                </>
              )}
              {sectionId === "bulbs" && (
                <>
                  {num(
                    "bulbCount",
                    t("stringLights.bulbCount"),
                    1,
                    STRING_LIGHTS_MAX_BULBS,
                    1,
                    (v) => `${v} · ${(s.span / Math.max(1, v)).toFixed(2)} m`,
                  )}
                  {cycle(
                    "bulbStyle",
                    t("stringLights.bulbStyle"),
                    STRING_LIGHT_BULBS,
                    "stringLights.bulbs",
                  )}
                  {num(
                    "bulbSize",
                    t("stringLights.bulbSize"),
                    0.01,
                    0.6,
                    0.01,
                    (v) => `${Math.round(v * 100)} cm`,
                  )}
                  {num(
                    "bulbDrop",
                    t("stringLights.bulbDrop"),
                    0,
                    1,
                    0.02,
                    (v) => `${Math.round(v * 100)} cm`,
                  )}
                  {num("brightness", t("stringLights.brightness"), 0, 4, 0.1, pct)}
                  {num("glow", t("stringLights.glow"), 0, 3, 0.1, pct)}
                  {num("glowSize", t("stringLights.glowSize"), 0.2, 4, 0.1, pct)}
                  {toggle("emitLight", t("stringLights.emitLight"))}
                </>
              )}
              {sectionId === "colors" && (
                <>
                  {cycle(
                    "palette",
                    t("stringLights.palette"),
                    STRING_LIGHT_PALETTE_IDS,
                    "stringLights.palettes",
                  )}
                  {s.palette === "custom" && (
                    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
                      {s.customColors.map((c, i) => (
                        <input
                          key={i}
                          type="color"
                          value={c}
                          aria-label={`${t("stringLights.color")} ${i + 1}`}
                          onChange={(e) =>
                            patch({
                              customColors: s.customColors.map((x, j) =>
                                j === i ? e.target.value : x,
                              ),
                            })
                          }
                          className={colorInput}
                        />
                      ))}
                      <button
                        disabled={s.customColors.length >= STRING_LIGHT_MAX_CUSTOM_COLORS}
                        onClick={() =>
                          patch({
                            customColors: [...s.customColors, s.customColors.at(-1) ?? "#ffd9a0"],
                          })
                        }
                        className={btnClass}
                      >
                        +
                      </button>
                      <button
                        disabled={s.customColors.length <= 1}
                        onClick={() => patch({ customColors: s.customColors.slice(0, -1) })}
                        className={btnClass}
                      >
                        −
                      </button>
                    </div>
                  )}
                  {stringLightColors(s).length > 1 &&
                    cycle(
                      "pattern",
                      t("stringLights.pattern"),
                      STRING_LIGHT_PATTERNS,
                      "stringLights.patterns",
                    )}
                  {s.pattern === "blocks" &&
                    stringLightColors(s).length > 1 &&
                    num("blockSize", t("stringLights.blockSize"), 1, 20, 1, (v) => `${v}`)}
                </>
              )}
              {sectionId === "animation" && (
                <>
                  {cycle("anim", t("stringLights.anim"), STRING_LIGHT_ANIMS, "stringLights.anims")}
                  {s.anim !== "steady" && (
                    <>
                      {num("speed", t("stringLights.speed"), 0, 10, 0.1, (v) => `${v.toFixed(1)}×`)}
                      {s.anim !== "colorshift" &&
                        num("animDepth", t("stringLights.animDepth"), 0, 1, 0.05, pct)}
                      {(s.anim === "chase" || s.anim === "pulse" || s.anim === "colorshift") && (
                        <SettingRow
                          label={t("stringLights.direction")}
                          value={t(
                            s.direction > 0 ? "stringLights.forward" : "stringLights.backward",
                          )}
                          onDec={() => patch({ direction: -s.direction })}
                          onInc={() => patch({ direction: -s.direction })}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          <EdgeLightsPanel />
          <SettingRow
            label={t("stringLights.emitters")}
            mode="number"
            value={`${state.emitters}`}
            rawValue={state.emitters}
            min={0}
            max={STRING_LIGHTS_MAX_EMITTERS}
            step={1}
            onSet={(v) =>
              setStringLights((st) => ({
                ...st,
                emitters: Math.round(Math.max(0, Math.min(STRING_LIGHTS_MAX_EMITTERS, v))),
              }))
            }
            onDec={() =>
              setStringLights((st) => ({ ...st, emitters: Math.max(0, st.emitters - 1) }))
            }
            onInc={() =>
              setStringLights((st) => ({
                ...st,
                emitters: Math.min(STRING_LIGHTS_MAX_EMITTERS, st.emitters + 1),
              }))
            }
          />
          <SettingRow
            label={t("stringLights.dayGlow")}
            mode="number"
            value={pct(state.dayGlow)}
            rawValue={state.dayGlow}
            min={0}
            max={1}
            step={0.05}
            onSet={(v) =>
              setStringLights((st) => ({ ...st, dayGlow: Math.max(0, Math.min(1, v)) }))
            }
            onDec={() =>
              setStringLights((st) => ({
                ...st,
                dayGlow: Math.max(0, +(st.dayGlow - 0.05).toFixed(2)),
              }))
            }
            onInc={() =>
              setStringLights((st) => ({
                ...st,
                dayGlow: Math.min(1, +(st.dayGlow + 0.05).toFixed(2)),
              }))
            }
          />
          {/* Where the view is now, to help line strings up by hand. */}
          <p className="w-full text-center text-[9px] font-light tracking-wider ui-ink-muted">
            {t("stringLights.here", {
              x: stringLightsView.x.toFixed(1),
              z: stringLightsView.z.toFixed(1),
            })}
          </p>
        </>
      )}
    </>
  );
}
