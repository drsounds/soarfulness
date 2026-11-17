import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { NEON_MODES, type NeonMode, type NeonSettings } from "./settings";
import { EdgeFilterSettings } from "@/components/EdgeFilterSettings";
import { Findable } from "@/components/settingsNav";

// Neon dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(NEON_DEFAULTS, ...)` in routes/index.tsx).

export function NeonPanel({ neon }: { neon: AppSettingsHandle<NeonSettings> }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    neonOn,
    neonMode,
    neonPrimary,
    neonSecondary,
    neonTint,
    neonTintAmount,
    neonStrength,
    neonWidth,
    neonFrequency,
    neonEdgeFilter,
    neonAccentColor,
  } = neon.values;
  const {
    neonOn: setNeonOn,
    neonMode: setNeonMode,
    neonPrimary: setNeonPrimary,
    neonSecondary: setNeonSecondary,
    neonTint: setNeonTint,
    neonTintAmount: setNeonTintAmount,
    neonStrength: setNeonStrength,
    neonWidth: setNeonWidth,
    neonFrequency: setNeonFrequency,
    neonEdgeFilter: setNeonEdgeFilter,
    neonAccentColor: setNeonAccentColor,
  } = neon.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.neon")}
        value={onOff(neonOn)}
        onDec={() => setNeonOn(false)}
        onInc={() => setNeonOn(true)}
      />
      {neonOn && (
        <>
          <SettingRow
            label={t("dial.env.neonMode")}
            value={t(`dial.env.neonModeValue.${neonMode}`)}
            options={NEON_MODES.map((m) => t(`dial.env.neonModeValue.${m}`))}
            selectedIndex={Math.max(0, NEON_MODES.indexOf(neonMode))}
            onSelectIndex={(i) => setNeonMode(NEON_MODES[i] as NeonMode)}
            onDec={() =>
              setNeonMode(
                (m) =>
                  NEON_MODES[(NEON_MODES.indexOf(m) - 1 + NEON_MODES.length) % NEON_MODES.length],
              )
            }
            onInc={() =>
              setNeonMode((m) => NEON_MODES[(NEON_MODES.indexOf(m) + 1) % NEON_MODES.length])
            }
          />
          <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.env.neonPrimary")}
            </span>
            <input
              type="color"
              value={neonPrimary}
              onChange={(e) => setNeonPrimary(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
            />
          </label>
          {(neonMode === "alternate" || neonMode === "fade") && (
            <>
              <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                  {t("dial.env.neonSecondary")}
                </span>
                <input
                  type="color"
                  value={neonSecondary}
                  onChange={(e) => setNeonSecondary(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                />
              </label>
            </>
          )}
          {neonMode !== "solid" && (
            <>
              <SettingRow
                label={t("dial.env.neonFrequency")}
                mode="number"
                value={`${neonFrequency.toFixed(2)} Hz`}
                rawValue={neonFrequency}
                onSet={(v) => setNeonFrequency(v)}
                min={0.05}
                max={10}
                step={0.05}
                onDec={() => setNeonFrequency((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
                onInc={() => setNeonFrequency((v) => Math.min(10, +(v + 0.05).toFixed(2)))}
              />
            </>
          )}
          <SettingRow
            label={t("dial.env.neonStrength")}
            mode="number"
            value={`${Math.round(neonStrength * 100)}%`}
            rawValue={neonStrength}
            onSet={(v) => setNeonStrength(v)}
            min={0}
            max={3}
            step={0.1}
            onDec={() => setNeonStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
            onInc={() => setNeonStrength((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.neonWidth")}
            mode="number"
            value={`${neonWidth.toFixed(1)}px`}
            rawValue={neonWidth}
            onSet={(v) => setNeonWidth(v)}
            min={0.5}
            max={12}
            step={0.5}
            onDec={() => setNeonWidth((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}
            onInc={() => setNeonWidth((v) => Math.min(12, +(v + 0.5).toFixed(1)))}
          />
          <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.env.neonTint")}
            </span>
            <input
              type="color"
              value={neonTint}
              onChange={(e) => setNeonTint(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
            />
          </label>
          <SettingRow
            label={t("dial.env.neonTintAmount")}
            mode="number"
            value={`${Math.round(neonTintAmount * 100)}%`}
            rawValue={neonTintAmount}
            onSet={(v) => setNeonTintAmount(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setNeonTintAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setNeonTintAmount((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <EdgeFilterSettings value={neonEdgeFilter} onChange={setNeonEdgeFilter} />
        </>
      )}
      <Findable label={t("dial.env.neonAccent")}>
        <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
          <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
            {t("dial.env.neonAccent")}
          </span>
          <input
            type="color"
            value={neonAccentColor}
            onChange={(e) => setNeonAccentColor(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
          />
        </label>
      </Findable>
    </>
  );
}
