import { useTranslation } from "react-i18next";
import { EdgeFilterSettings } from "@/components/EdgeFilterSettings";
import { SettingRow } from "@/components/SettingRow";
import { cloneEdgeFilter, type EdgeFilter } from "@/lib/edgeSelect";
import {
  EDGE_LIGHTS_MAX_BULBS,
  STRING_LIGHT_ANIMS,
  STRING_LIGHT_BULBS,
  STRING_LIGHT_MAX_CUSTOM_COLORS,
  STRING_LIGHT_PALETTE_IDS,
  STRING_LIGHT_PATTERNS,
  setEdgeLights,
  stringLightColors,
  useStringLights,
  type EdgeLights,
} from "./stringLights";

// KANTLJUS settings, inside the LJUSSLINGOR panel: bulbs along the scene's
// mesh edges (see EdgeLightsFx.ts). The edge filter rows are the same ones
// NEON uses (components/EdgeFilterSettings.tsx).

type NumKey = {
  [K in keyof EdgeLights]: EdgeLights[K] extends number ? K : never;
}[keyof EdgeLights];

const btnClass =
  "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";
const colorInput = "h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0";

export function EdgeLightsPanel() {
  const { t } = useTranslation();
  const [state] = useStringLights();
  const e = state.edge;
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const patch = (p: Partial<EdgeLights>) => setEdgeLights((cur) => ({ ...cur, ...p }));

  const toggle = (key: "on" | "includeImported", label: string) => (
    <SettingRow
      key={key}
      label={label}
      value={onOff(e[key])}
      onDec={() => patch({ [key]: false })}
      onInc={() => patch({ [key]: true })}
    />
  );
  const num = (
    key: NumKey,
    label: string,
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string,
  ) => {
    const v = e[key] as number;
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
        onSet={(x) => patch({ [key]: clamp(x) } as Partial<EdgeLights>)}
        onDec={() => patch({ [key]: clamp(v - step) } as Partial<EdgeLights>)}
        onInc={() => patch({ [key]: clamp(v + step) } as Partial<EdgeLights>)}
      />
    );
  };
  function cycle<T extends string>(
    key: "bulbStyle" | "palette" | "pattern" | "anim",
    label: string,
    list: readonly T[],
    i18n: string,
  ) {
    const cur = e[key] as string as T;
    const i = Math.max(0, list.indexOf(cur));
    return (
      <SettingRow
        key={key}
        label={label}
        value={t(`${i18n}.${cur}`)}
        options={list.map((x) => t(`${i18n}.${x}`))}
        selectedIndex={i}
        onSelectIndex={(j) => patch({ [key]: list[j] } as Partial<EdgeLights>)}
        onDec={() =>
          patch({ [key]: list[(i - 1 + list.length) % list.length] } as Partial<EdgeLights>)
        }
        onInc={() => patch({ [key]: list[(i + 1) % list.length] } as Partial<EdgeLights>)}
      />
    );
  }
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const multi = stringLightColors(e).length > 1;

  return (
    <>
      {toggle("on", t("stringLights.edge.title"))}
      {e.on && (
        <>
          {toggle("includeImported", t("stringLights.edge.includeImported"))}
          <EdgeFilterSettings
            value={e.filter}
            onChange={(f: EdgeFilter) => patch({ filter: cloneEdgeFilter(f) })}
          />
          {num(
            "spacing",
            t("stringLights.edge.spacing"),
            0.05,
            20,
            0.05,
            (v) => `${v.toFixed(2)} m`,
          )}
          {num("radius", t("stringLights.edge.radius"), 0, 1000, 5, (v) =>
            v <= 0 ? t("common.off") : `${v} m`,
          )}
          {num(
            "maxBulbs",
            t("stringLights.edge.maxBulbs"),
            10,
            EDGE_LIGHTS_MAX_BULBS,
            50,
            (v) => `${v}`,
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
          {num("brightness", t("stringLights.brightness"), 0, 4, 0.1, pct)}
          {num("glow", t("stringLights.glow"), 0, 3, 0.1, pct)}
          {cycle(
            "palette",
            t("stringLights.palette"),
            STRING_LIGHT_PALETTE_IDS,
            "stringLights.palettes",
          )}
          {e.palette === "custom" && (
            <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
              {e.customColors.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  aria-label={`${t("stringLights.color")} ${i + 1}`}
                  onChange={(ev) =>
                    patch({
                      customColors: e.customColors.map((x, j) => (j === i ? ev.target.value : x)),
                    })
                  }
                  className={colorInput}
                />
              ))}
              <button
                disabled={e.customColors.length >= STRING_LIGHT_MAX_CUSTOM_COLORS}
                onClick={() =>
                  patch({ customColors: [...e.customColors, e.customColors.at(-1) ?? "#ffd9a0"] })
                }
                className={btnClass}
              >
                +
              </button>
              <button
                disabled={e.customColors.length <= 1}
                onClick={() => patch({ customColors: e.customColors.slice(0, -1) })}
                className={btnClass}
              >
                −
              </button>
            </div>
          )}
          {multi &&
            cycle(
              "pattern",
              t("stringLights.pattern"),
              STRING_LIGHT_PATTERNS,
              "stringLights.patterns",
            )}
          {multi &&
            e.pattern === "blocks" &&
            num("blockSize", t("stringLights.blockSize"), 1, 20, 1, (v) => `${v}`)}
          {cycle("anim", t("stringLights.anim"), STRING_LIGHT_ANIMS, "stringLights.anims")}
          {e.anim !== "steady" && (
            <>
              {num("speed", t("stringLights.speed"), 0, 10, 0.1, (v) => `${v.toFixed(1)}×`)}
              {e.anim !== "colorshift" &&
                num("animDepth", t("stringLights.animDepth"), 0, 1, 0.05, pct)}
            </>
          )}
        </>
      )}
    </>
  );
}
