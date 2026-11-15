import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { saveFileToDevice } from "@/lib/deviceFiles";
import { pickJsonFile, readJsonFile } from "@/lib/presets";
import {
  HOOD_MAX_LAYERS,
  hoodLayersFromFile,
  hoodLayersToFile,
  loadSavedHoodLayerSets,
  storeSavedHoodLayerSets,
  type HoodLayer,
  type SavedHoodLayerSet,
} from "@/lib/hoodLayers";

// HUVA settings (KAMERA tab): the master toggle, a layer picker, the picked
// layer's own settings, and saving / exporting / importing a set of layers.
// Layer 1 is the flat hood* settings, layers 2+ are hoodExtraLayers — see
// lib/hoodLayers.ts.

type NumKey = {
  [K in keyof HoodLayer]: HoodLayer[K] extends number ? K : never;
}[keyof HoodLayer];
type BoolKey = {
  [K in keyof HoodLayer]: HoodLayer[K] extends boolean ? K : never;
}[keyof HoodLayer];

export function HoodSettings({
  hoodOn,
  setHoodOn,
  layer1,
  setLayer1,
  extraLayers,
  setExtraLayers,
}: {
  hoodOn: boolean;
  setHoodOn: Dispatch<SetStateAction<boolean>>;
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

  const layers = [layer1, ...extraLayers];
  const sel = Math.min(selRaw, layers.length - 1);
  const layer = layers[sel];
  const patch = (p: Partial<HoodLayer>) => {
    if (sel === 0) setLayer1(p);
    else setExtraLayers((ls) => ls.map((l, i) => (i === sel - 1 ? { ...l, ...p } : l)));
  };
  const applyLayers = (ls: HoodLayer[]) => {
    setLayer1(ls[0]);
    setExtraLayers(ls.slice(1, HOOD_MAX_LAYERS).map((l) => ({ ...l })));
    setSel(0);
    setHoodOn(true);
  };

  const pct = (key: NumKey, label: string) => (
    <SettingRow
      key={key}
      label={label}
      mode="number"
      value={`${Math.round(layer[key] * 100)}%`}
      rawValue={layer[key]}
      onSet={(v) => patch({ [key]: Math.max(0, Math.min(1, v)) })}
      min={0}
      max={1}
      step={0.05}
      onDec={() => patch({ [key]: Math.max(0, +(layer[key] - 0.05).toFixed(2)) })}
      onInc={() => patch({ [key]: Math.min(1, +(layer[key] + 0.05).toFixed(2)) })}
    />
  );
  const toggle = (key: BoolKey, label: string) => (
    <SettingRow
      key={key}
      label={label}
      value={onOff(layer[key])}
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
            value={`${sel + 1} / ${layers.length}`}
            onDec={() => setSel((sel - 1 + layers.length) % layers.length)}
            onInc={() => setSel((sel + 1) % layers.length)}
          />
          <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
            <button
              disabled={layers.length >= HOOD_MAX_LAYERS}
              onClick={() => {
                // A new layer starts as a copy of the picked one, with a
                // tighter opening so it shows inside it.
                const next = { ...layer, on: true, opening: Math.max(0, layer.opening - 0.15) };
                setExtraLayers((ls) => [...ls, next]);
                setSel(layers.length);
              }}
              className={btnClass}
            >
              {t("dial.camera.hoodAddLayer")}
            </button>
            <button
              disabled={sel === 0}
              onClick={() => {
                setExtraLayers((ls) => ls.filter((_, i) => i !== sel - 1));
                setSel(sel - 1);
              }}
              className={btnClass}
            >
              {t("dial.camera.hoodRemoveLayer")}
            </button>
          </div>
          {sel > 0 && toggle("on", t("dial.camera.hoodLayerOn"))}
          {pct("drop", t("dial.camera.hoodDrop"))}
          {!layer.lowerOn && pct("height", t("dial.camera.hoodHeight"))}
          {pct("opening", t("dial.camera.hoodOpening"))}
          {toggle("lowerOn", t("dial.camera.hoodLower"))}
          {layer.lowerOn && (
            <>
              {pct("lowerHeight", t("dial.camera.hoodLowerHeight"))}
              {toggle("zipperOn", t("dial.camera.hoodZipper"))}
            </>
          )}
          {toggle("waterOn", t("dial.camera.hoodWater"))}
          {layer.waterOn && pct("waterLevel", t("dial.camera.hoodWaterLevel"))}
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
          {pct("darkness", t("dial.camera.hoodDarkness"))}
          {pct("metallic", t("dial.camera.hoodMetallic"))}
          {pct("wrinkles", t("dial.camera.hoodWrinkles"))}
          {pct("motion", t("dial.camera.hoodMotion"))}
          {pct("weight", t("dial.camera.hoodWeight"))}

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
