import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { saveFileToDevice } from "@/lib/deviceFiles";
import { pickJsonFile, readJsonFile } from "@/lib/presets";
import { limitMax, useExtremeLimits } from "@/lib/extremeLimits";
import {
  HOOD_CUFF_MATERIALS,
  HOOD_FUR_PATTERNS,
  HOOD_FUR_STYLES,
  HOOD_MAX_LAYERS,
  HOOD_OPENING_HEIGHT_MAX,
  HOOD_MESH_RESOLUTION_MAX,
  HOOD_MESH_RESOLUTION_MIN,
  HOOD_MESH_RESOLUTION_STEP,
  HOOD_MESH_RESOLUTION_VERTICAL_RATIO,
  HOOD_PUFF_HEIGHT_MAX,
  HOOD_PADDED_STYLES,
  HOOD_STYLES,
  hoodLayersFromFile,
  hoodLayersToFile,
  loadSavedHoodLayerSets,
  patchHoodLayers,
  sanitizeHoodMeshResolution,
  storeSavedHoodLayerSets,
  type HoodLayer,
  type SavedHoodLayerSet,
} from "@/apps/hood/hoodLayers";

// HUVA settings (KAMERA tab): the master toggle, a layer picker, the picked
// layer's own settings, and saving / exporting / importing a set of layers.
// Layer 1 is the flat hood* settings, layers 2+ are hoodExtraLayers — see
// apps/hood/hoodLayers.ts.

type NumKey = {
  [K in keyof HoodLayer]: HoodLayer[K] extends number ? K : never;
}[keyof HoodLayer];
type BoolKey = {
  [K in keyof HoodLayer]: HoodLayer[K] extends boolean ? K : never;
}[keyof HoodLayer];

/** Hood-wide settings: the float suit, ROTERA HUVUD, FLYTGRÄNS, buoyancy. */
export type HoodSharedSettings = {
  floatThreshold: number;
  rotateHead: boolean;
  suitColor: string;
  suitLeg: number;
  clothesBuoyancy: boolean;
};

export function HoodPanel({
  hoodOn,
  setHoodOn,
  shared,
  setShared,
  layer1,
  setLayer1,
  extraLayers,
  setExtraLayers,
}: {
  hoodOn: boolean;
  setHoodOn: Dispatch<SetStateAction<boolean>>;
  shared: HoodSharedSettings;
  setShared: (patch: Partial<HoodSharedSettings>) => void;
  layer1: HoodLayer;
  setLayer1: (patch: Partial<HoodLayer>) => void;
  extraLayers: HoodLayer[];
  setExtraLayers: Dispatch<SetStateAction<HoodLayer[]>>;
}) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const [selRaw, setSel] = useState(0);
  const [savedSets, setSavedSets] = useState<SavedHoodLayerSet[]>(() =>
    typeof window === "undefined" ? [] : loadSavedHoodLayerSets(),
  );
  const [savedSel, setSavedSel] = useState("");
  const [extremeLimits] = useExtremeLimits();
  const widthMax = limitMax("hoodOpeningWidth", extremeLimits);
  const heightMax = HOOD_OPENING_HEIGHT_MAX;

  // Layers are stored outermost first (layer 1 = the flat settings, drawn
  // first, so later layers draw over it, closer to the face) but listed
  // innermost first: picker position `sel` 0 is the layer closest to you.
  const layers = [layer1, ...extraLayers];
  const sel = Math.min(selRaw, layers.length - 1);
  const act = layers.length - 1 - sel;
  const layer = layers[act];
  const meshResolution = sanitizeHoodMeshResolution(layer.meshResolution);
  const patch = (p: Partial<HoodLayer>) => {
    if (act === 0) setLayer1(p);
    else setExtraLayers((ls) => ls.map((l, i) => (i === act - 1 ? { ...l, ...p } : l)));
  };
  const patchAllLayers = (p: Partial<HoodLayer>) => {
    const updated = patchHoodLayers(layers, p);
    setLayer1(updated[0]);
    setExtraLayers(updated.slice(1));
  };
  const applyToAll = (p: Partial<HoodLayer>) =>
    layers.length > 1
      ? {
          label: t("dial.camera.hoodApplyAllLayers"),
          onApply: () => patchAllLayers(p),
        }
      : undefined;
  const applyLayers = (ls: HoodLayer[]) => {
    setLayer1(ls[0]);
    setExtraLayers(ls.slice(1, HOOD_MAX_LAYERS).map((l) => ({ ...l })));
    setSel(0);
    setHoodOn(true);
  };
  // Swap the picked layer with its neighbor and keep it picked. `dir` -1
  // moves it inward (toward you, up the innermost-first list).
  const moveLayer = (dir: -1 | 1) => {
    const to = act - dir;
    if (to < 0 || to >= layers.length) return;
    const ls = layers.map((l) => ({ ...l }));
    [ls[act], ls[to]] = [ls[to], ls[act]];
    setLayer1(ls[0]);
    setExtraLayers(ls.slice(1, HOOD_MAX_LAYERS));
    setSel(sel + dir);
  };

  const pct = (key: NumKey, label: string, max = 1) => {
    const min = key === "weight" ? -1 : 0;
    return (
      <SettingRow
        key={key}
        label={label}
        mode="number"
        value={`${Math.round(layer[key] * 100)}%`}
        rawValue={layer[key]}
        onSet={(v) => patch({ [key]: v })}
        applyToAll={applyToAll({ [key]: layer[key] })}
        min={min}
        max={max}
        step={0.05}
        onDec={() => patch({ [key]: Math.max(min, +(layer[key] - 0.05).toFixed(2)) })}
        onInc={() => patch({ [key]: Math.min(max, +(layer[key] + 0.05).toFixed(2)) })}
      />
    );
  };
  const offset = (key: "offsetX" | "offsetY", label: string) => (
    <SettingRow
      key={key}
      label={label}
      mode="number"
      value={`${Math.round(layer[key] * 100)}%`}
      rawValue={layer[key]}
      onSet={(v) => patch({ [key]: Math.max(-1, Math.min(1, v)) })}
      applyToAll={applyToAll({ [key]: layer[key] })}
      min={-1}
      max={1}
      step={0.05}
      onDec={() => patch({ [key]: Math.max(-1, +(layer[key] - 0.05).toFixed(2)) })}
      onInc={() => patch({ [key]: Math.min(1, +(layer[key] + 0.05).toFixed(2)) })}
    />
  );
  const toggle = (key: BoolKey, label: string) => (
    <SettingRow
      key={key}
      label={label}
      value={onOff(layer[key])}
      applyToAll={applyToAll({ [key]: layer[key] })}
      onDec={() => patch({ [key]: false })}
      onInc={() => patch({ [key]: true })}
    />
  );

  const btnClass =
    "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";
  const activeSaved = savedSets.some((s) => s.id === savedSel) ? savedSel : "";

  return (
    <>
      <SettingRow
        label={t("dial.camera.hood")}
        value={onOff(hoodOn)}
        onDec={() => setHoodOn(false)}
        onInc={() => setHoodOn(true)}
      />
      {hoodOn && (
        <>
          <SettingRow
            label={t("dial.camera.hoodLayer")}
            value={`${sel + 1} / ${layers.length}${
              layers.length > 1
                ? ` · ${
                    sel === 0
                      ? t("dial.camera.hoodLayerInnermost")
                      : sel === layers.length - 1
                        ? t("dial.camera.hoodLayerOutermost")
                        : ""
                  }`
                : ""
            }`.replace(/ · $/, "")}
            onDec={() => setSel((sel - 1 + layers.length) % layers.length)}
            onInc={() => setSel((sel + 1) % layers.length)}
          />
          <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
            <button
              disabled={layers.length >= HOOD_MAX_LAYERS}
              onClick={() => {
                // A new layer starts as a copy of the picked one, with a
                // tighter opening so it shows inside it: the new innermost.
                const next = { ...layer, on: true, opening: Math.max(0, layer.opening - 0.15) };
                setExtraLayers((ls) => [...ls, next]);
                setSel(0);
              }}
              className={btnClass}
            >
              {t("dial.camera.hoodAddLayer")}
            </button>
            <button
              disabled={layers.length <= 1}
              onClick={() => {
                const ls = layers.filter((_, i) => i !== act).map((l) => ({ ...l }));
                setLayer1(ls[0]);
                setExtraLayers(ls.slice(1, HOOD_MAX_LAYERS));
                setSel(Math.max(0, sel - 1));
              }}
              className={btnClass}
            >
              {t("dial.camera.hoodRemoveLayer")}
            </button>
            <button disabled={sel === 0} onClick={() => moveLayer(-1)} className={btnClass}>
              {t("dial.camera.hoodLayerMoveIn")}
            </button>
            <button
              disabled={sel >= layers.length - 1}
              onClick={() => moveLayer(1)}
              className={btnClass}
            >
              {t("dial.camera.hoodLayerMoveOut")}
            </button>
          </div>
          {toggle("on", t("dial.camera.hoodLayerOn"))}
          {offset("offsetX", t("dial.camera.hoodOffsetX"))}
          {offset("offsetY", t("dial.camera.hoodOffsetY"))}
          {pct("drop", t("dial.camera.hoodDrop"))}
          {(!layer.lowerOn || layer.separate) && pct("height", t("dial.camera.hoodHeight"))}
          {toggle("lengthOn", t("dial.camera.hoodLengthOn"))}
          {layer.lengthOn && pct("length", t("dial.camera.hoodLength"))}
          {(layer.openingWidth <= 0 || layer.openingHeight <= 0) &&
            pct("opening", t("dial.camera.hoodOpening"))}
          {pct("roundness", t("dial.camera.hoodRoundness"))}
          <SettingRow
            label={t("dial.camera.hoodOpeningWidth")}
            mode="number"
            value={
              layer.openingWidth > 0 ? `${Math.round(layer.openingWidth * 100)}%` : t("common.auto")
            }
            rawValue={layer.openingWidth}
            onSet={(v) => patch({ openingWidth: v })}
            applyToAll={applyToAll({ openingWidth: layer.openingWidth })}
            min={0}
            max={widthMax}
            step={0.05}
            onDec={() =>
              patch({ openingWidth: Math.max(0, +(layer.openingWidth - 0.05).toFixed(2)) })
            }
            onInc={() =>
              patch({
                // From AUTO, start at about the width ÖPPNING gave.
                openingWidth:
                  layer.openingWidth <= 0
                    ? +(0.6 + layer.opening * 0.4).toFixed(2)
                    : Math.min(widthMax, +(layer.openingWidth + 0.05).toFixed(2)),
              })
            }
          />
          <SettingRow
            label={t("dial.camera.hoodOpeningHeight")}
            mode="number"
            value={
              layer.openingHeight > 0
                ? `${Math.round(layer.openingHeight * 100)}%`
                : t("common.auto")
            }
            rawValue={layer.openingHeight}
            onSet={(v) => patch({ openingHeight: v })}
            applyToAll={applyToAll({ openingHeight: layer.openingHeight })}
            min={0}
            max={heightMax}
            step={0.05}
            onDec={() =>
              patch({ openingHeight: Math.max(0, +(layer.openingHeight - 0.05).toFixed(2)) })
            }
            onInc={() =>
              patch({
                openingHeight:
                  layer.openingHeight <= 0
                    ? +(0.6 + layer.opening * 0.38).toFixed(2)
                    : Math.min(heightMax, +(layer.openingHeight + 0.05).toFixed(2)),
              })
            }
          />
          {(!layer.lowerOn || layer.hoodTop) && pct("pullBack", t("dial.camera.hoodPullBack"))}
          {toggle("real3d", t("dial.camera.hoodReal3d"))}
          {layer.real3d && (
            <SettingRow
              label={t("dial.camera.hoodMeshResolution")}
              mode="number"
              value={`${meshResolution} × ${Math.round(meshResolution * HOOD_MESH_RESOLUTION_VERTICAL_RATIO)}`}
              rawValue={meshResolution}
              onSet={(v) => patch({ meshResolution: sanitizeHoodMeshResolution(v) })}
              applyToAll={applyToAll({ meshResolution })}
              min={HOOD_MESH_RESOLUTION_MIN}
              max={HOOD_MESH_RESOLUTION_MAX}
              step={HOOD_MESH_RESOLUTION_STEP}
              onDec={() =>
                patch({
                  meshResolution: Math.max(
                    HOOD_MESH_RESOLUTION_MIN,
                    meshResolution - HOOD_MESH_RESOLUTION_STEP,
                  ),
                })
              }
              onInc={() =>
                patch({
                  meshResolution: Math.min(
                    HOOD_MESH_RESOLUTION_MAX,
                    meshResolution + HOOD_MESH_RESOLUTION_STEP,
                  ),
                })
              }
            />
          )}
          {toggle("lowerOn", t("dial.camera.hoodLower"))}
          {layer.lowerOn && (
            <>
              {pct("lowerHeight", t("dial.camera.hoodLowerHeight"))}
              {toggle("separate", t("dial.camera.hoodSeparate"))}
              {pct("neckBack", t("dial.camera.hoodNeckBack"))}
              {toggle("hoodTop", t("dial.camera.hoodTop"))}
              {toggle("collarUp", t("dial.camera.hoodCollarUp"))}
              {toggle("zipperOn", t("dial.camera.hoodZipper"))}
              {layer.zipperOn && (
                <>
                  {pct("zipperOpen", t("dial.camera.hoodZipperOpen"))}
                  {toggle("zipperFixed", t("dial.camera.hoodZipperFixed"))}
                  {toggle("zipperPullOut", t("dial.camera.hoodZipperPullOut"))}
                </>
              )}
            </>
          )}
          {toggle("waterOn", t("dial.camera.hoodWater"))}
          {layer.waterOn && (
            <>
              {pct("waterLevel", t("dial.camera.hoodWaterLevel"))}
              {pct("waterCalm", t("dial.camera.hoodWaterCalm"))}
              {pct("waterTint", t("dial.camera.hoodWaterTint"))}
            </>
          )}
          <div className="flex items-center justify-center gap-1.5">
            <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.camera.hoodColor")}
              </span>
              <input
                type="color"
                value={layer.color}
                onChange={(e) => patch({ color: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
            {layers.length > 1 && (
              <button onClick={() => patchAllLayers({ color: layer.color })} className={btnClass}>
                {t("dial.camera.hoodApplyAllLayers")}
              </button>
            )}
          </div>
          {pct("darkness", t("dial.camera.hoodDarkness"))}
          <SettingRow
            label={t("dial.camera.hoodStyle")}
            value={t(`dial.camera.hoodStyle_${layer.style}`)}
            applyToAll={applyToAll({ style: layer.style })}
            onDec={() =>
              patch({
                style:
                  HOOD_STYLES[
                    (HOOD_STYLES.indexOf(layer.style) - 1 + HOOD_STYLES.length) % HOOD_STYLES.length
                  ],
              })
            }
            onInc={() =>
              patch({
                style: HOOD_STYLES[(HOOD_STYLES.indexOf(layer.style) + 1) % HOOD_STYLES.length],
              })
            }
          />
          {HOOD_PADDED_STYLES.includes(layer.style) && (
            <>
              {pct("puffSize", t("dial.camera.hoodPuffSize"))}
              {pct("puffHeight", t("dial.camera.hoodPuffHeight"), HOOD_PUFF_HEIGHT_MAX)}
              {toggle("puff3d", t("dial.camera.hoodPuff3d"))}
              {pct("puffThickness", t("dial.camera.hoodPuffThickness"))}
              {pct("puffInflate", t("dial.camera.hoodPuffInflate"))}
            </>
          )}
          {toggle("cuff", t("dial.camera.hoodCuff"))}
          {layer.cuff && (
            <>
              {toggle("cuffTop", t("dial.camera.hoodCuffTop"))}
              {pct("cuffHeight", t("dial.camera.hoodCuffHeight"))}
              {pct("cuffSize", t("dial.camera.hoodCuffSize"))}
              {toggle("cuffCustom", t("dial.camera.hoodCuffCustom"))}
              {layer.cuffCustom && (
                <>
                  <div className="flex items-center justify-center gap-1.5">
                    <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                      <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                        {t("dial.camera.hoodCuffColor")}
                      </span>
                      <input
                        type="color"
                        value={layer.cuffColor}
                        onChange={(e) => patch({ cuffColor: e.target.value })}
                        className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                      />
                    </label>
                    {layers.length > 1 && (
                      <button
                        onClick={() => patchAllLayers({ cuffColor: layer.cuffColor })}
                        className={btnClass}
                      >
                        {t("dial.camera.hoodApplyAllLayers")}
                      </button>
                    )}
                  </div>
                  {pct("cuffMetallic", t("dial.camera.hoodCuffMetallic"))}
                  <SettingRow
                    label={t("dial.camera.hoodCuffMaterial")}
                    value={t(`dial.camera.hoodCuffMaterial_${layer.cuffMaterial}`)}
                    applyToAll={applyToAll({ cuffMaterial: layer.cuffMaterial })}
                    onDec={() =>
                      patch({
                        cuffMaterial:
                          HOOD_CUFF_MATERIALS[
                            (HOOD_CUFF_MATERIALS.indexOf(layer.cuffMaterial) -
                              1 +
                              HOOD_CUFF_MATERIALS.length) %
                              HOOD_CUFF_MATERIALS.length
                          ],
                      })
                    }
                    onInc={() =>
                      patch({
                        cuffMaterial:
                          HOOD_CUFF_MATERIALS[
                            (HOOD_CUFF_MATERIALS.indexOf(layer.cuffMaterial) + 1) %
                              HOOD_CUFF_MATERIALS.length
                          ],
                      })
                    }
                  />
                </>
              )}
            </>
          )}
          {toggle("fur", t("dial.camera.hoodFur"))}
          {layer.fur && (
            <>
              <div className="flex items-center justify-center gap-1.5">
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.camera.hoodFurColor")}
                  </span>
                  <input
                    type="color"
                    value={layer.furColor}
                    onChange={(e) => patch({ furColor: e.target.value })}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
                {layers.length > 1 && (
                  <button
                    onClick={() => patchAllLayers({ furColor: layer.furColor })}
                    className={btnClass}
                  >
                    {t("dial.camera.hoodApplyAllLayers")}
                  </button>
                )}
              </div>
              <SettingRow
                label={t("dial.camera.hoodFurStyle")}
                value={t(`dial.camera.hoodFurStyle_${layer.furStyle}`)}
                applyToAll={applyToAll({ furStyle: layer.furStyle })}
                onDec={() =>
                  patch({
                    furStyle:
                      HOOD_FUR_STYLES[
                        (HOOD_FUR_STYLES.indexOf(layer.furStyle) - 1 + HOOD_FUR_STYLES.length) %
                          HOOD_FUR_STYLES.length
                      ],
                  })
                }
                onInc={() =>
                  patch({
                    furStyle:
                      HOOD_FUR_STYLES[
                        (HOOD_FUR_STYLES.indexOf(layer.furStyle) + 1) % HOOD_FUR_STYLES.length
                      ],
                  })
                }
              />
              <SettingRow
                label={t("dial.camera.hoodFurPattern")}
                value={t(`dial.camera.hoodFurPattern_${layer.furPattern}`)}
                applyToAll={applyToAll({ furPattern: layer.furPattern })}
                onDec={() =>
                  patch({
                    furPattern:
                      HOOD_FUR_PATTERNS[
                        (HOOD_FUR_PATTERNS.indexOf(layer.furPattern) -
                          1 +
                          HOOD_FUR_PATTERNS.length) %
                          HOOD_FUR_PATTERNS.length
                      ],
                  })
                }
                onInc={() =>
                  patch({
                    furPattern:
                      HOOD_FUR_PATTERNS[
                        (HOOD_FUR_PATTERNS.indexOf(layer.furPattern) + 1) %
                          HOOD_FUR_PATTERNS.length
                      ],
                  })
                }
              />
              {pct("furSize", t("dial.camera.hoodFurSize"))}
              {pct("furWidth", t("dial.camera.hoodFurWidth"))}
            </>
          )}
          {pct("metallic", t("dial.camera.hoodMetallic"))}
          {toggle("reflectLight", t("dial.camera.hoodReflectLight"))}
          {pct("wrinkles", t("dial.camera.hoodWrinkles"))}
          {pct("motion", t("dial.camera.hoodMotion"))}
          {pct("weight", t("dial.camera.hoodWeight"))}
          {toggle("hanging", t("dial.camera.hoodHanging"))}
          {toggle("viewShadow", t("dial.camera.hoodViewShadow"))}
          {pct("floating", t("dial.camera.hoodFloating"))}
          {pct("dripping", t("dial.camera.hoodDripping"))}
          {layer.dripping > 0 && pct("dripAmount", t("dial.camera.hoodDripAmount"))}
          {layer.dripping > 0 && pct("dripGrow", t("dial.camera.hoodDripGrow"))}

          {/* Hood-wide: the float suit (always worn innermost), ROTERA HUVUD,
              FLYTGRÄNS and how the clothes change the bather's buoyancy. */}
          <div className="mt-2 mb-1 text-center text-[9px] font-light tracking-[0.28em] ui-ink-faint">
            {t("dial.camera.hoodSuit")}
          </div>
          <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.camera.hoodSuitColor")}
            </span>
            <input
              type="color"
              value={shared.suitColor}
              onChange={(e) => setShared({ suitColor: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
            />
          </label>
          <SettingRow
            label={t("dial.camera.hoodSuitLeg")}
            mode="number"
            value={
              shared.suitLeg < -0.02
                ? `${t("dial.camera.hoodSuitLeotard")} ${Math.round(-shared.suitLeg * 100)}%`
                : shared.suitLeg > 0.02
                  ? `${t("dial.camera.hoodSuitTrunks")} ${Math.round(shared.suitLeg * 100)}%`
                  : "0"
            }
            rawValue={shared.suitLeg}
            onSet={(v) => setShared({ suitLeg: Math.max(-1, Math.min(1, v)) })}
            min={-1}
            max={1}
            step={0.1}
            onDec={() => setShared({ suitLeg: Math.max(-1, +(shared.suitLeg - 0.1).toFixed(2)) })}
            onInc={() => setShared({ suitLeg: Math.min(1, +(shared.suitLeg + 0.1).toFixed(2)) })}
          />
          <SettingRow
            label={t("dial.camera.hoodRotateHead")}
            value={onOff(shared.rotateHead)}
            onDec={() => setShared({ rotateHead: false })}
            onInc={() => setShared({ rotateHead: true })}
          />
          <SettingRow
            label={t("dial.camera.hoodFloatThreshold")}
            mode="number"
            value={`${Math.round(shared.floatThreshold * 100)}%`}
            rawValue={shared.floatThreshold}
            onSet={(v) => setShared({ floatThreshold: Math.max(0, Math.min(1, v)) })}
            min={0}
            max={1}
            step={0.05}
            onDec={() =>
              setShared({ floatThreshold: Math.max(0, +(shared.floatThreshold - 0.05).toFixed(2)) })
            }
            onInc={() =>
              setShared({ floatThreshold: Math.min(1, +(shared.floatThreshold + 0.05).toFixed(2)) })
            }
          />
          <SettingRow
            label={t("dial.camera.hoodClothesBuoyancy")}
            value={onOff(shared.clothesBuoyancy)}
            onDec={() => setShared({ clothesBuoyancy: false })}
            onInc={() => setShared({ clothesBuoyancy: true })}
          />

          {/* Save / export / import the whole set of layers. */}
          <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
              {t("dial.camera.hoodLayers")}
            </span>
            <button
              onClick={() => {
                const name = window.prompt(t("presets.savePromptTitle"));
                if (!name || !name.trim()) return;
                const set: SavedHoodLayerSet = {
                  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                  name: name.trim(),
                  layers: layers.map((l) => ({ ...l })),
                };
                const next = [...savedSets, set];
                setSavedSets(next);
                storeSavedHoodLayerSets(next);
                setSavedSel(set.id);
              }}
              className={btnClass}
            >
              {t("presets.save")}
            </button>
            <button
              onClick={() => {
                const file = hoodLayersToFile(layers);
                const blob = new Blob([JSON.stringify(file, null, 2)], {
                  type: "application/json",
                });
                void saveFileToDevice("huvlager.json", blob);
              }}
              className={btnClass}
            >
              {t("presets.export")}
            </button>
            <button
              onClick={() =>
                pickJsonFile((file) => {
                  readJsonFile(file)
                    .then((data) => {
                      const ls = hoodLayersFromFile(data);
                      if (ls) applyLayers(ls);
                      else window.alert(t("dial.camera.hoodImportFailed"));
                    })
                    .catch(() => window.alert(t("dial.camera.hoodImportFailed")));
                })
              }
              className={btnClass}
            >
              {t("presets.import")}
            </button>
            {savedSets.length > 0 && (
              <>
                <select
                  value={activeSaved}
                  onChange={(e) => setSavedSel(e.target.value)}
                  className="rounded-full border ui-line-1 ui-surface px-2 py-0.5 text-[9px] ui-ink-muted"
                >
                  <option value="" disabled>
                    {t("presets.choosePreset")}
                  </option>
                  {savedSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!activeSaved}
                  onClick={() => {
                    const set = savedSets.find((s) => s.id === activeSaved);
                    if (set) applyLayers(set.layers);
                  }}
                  className={btnClass}
                >
                  {t("presets.load")}
                </button>
                <button
                  disabled={!activeSaved}
                  onClick={() => {
                    if (!activeSaved || !window.confirm(t("presets.deleteConfirm"))) return;
                    const next = savedSets.filter((s) => s.id !== activeSaved);
                    setSavedSets(next);
                    storeSavedHoodLayerSets(next);
                    setSavedSel("");
                  }}
                  className={btnClass}
                >
                  {t("presets.delete")}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
