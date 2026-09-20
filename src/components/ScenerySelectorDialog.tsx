import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mountain } from "lucide-react";
import type { AppSceneryPreset, SavedSceneryPreset, SceneryData } from "@/lib/sceneryPresets";
import { SettingRow } from "@/components/SettingRow";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// "SCENERY": lets the player freely combine a scene, environment(+era/time)
// and water-surface reflection sourced from ANY installed app (apps are a
// packaging/shipping unit only — see src/lib/appCatalog.ts — not a runtime
// silo, hence "grouped by app" labels below rather than an app-first
// filter), then save that combination as a named preset for one-tap recall.
// Reuses SettingRow for each pick (same drill-down radio-list UI already
// used throughout SettingsPanel.tsx) and the ConfirmDialog/hand-rolled-
// overlay chrome used by TimeTravelDialog.tsx, rather than the shadcn/Radix
// dialog primitives (unused by the rest of the 3D-experience UI — see
// src/components/ConfirmDialog.tsx's header comment).
//
// Prop shapes are local, minimal structural types (id/name(/appId)) rather
// than appCatalog.ts's own types — same decoupling SettingsPanel.tsx already
// uses for its NamedOption/EnvOption props instead of importing
// routes/index.tsx's SceneEntry/EnvironmentEntry — so this component doesn't
// care whether appId is always present (e.g. index.tsx passes the very same
// arrays it already builds for SettingsPanel's own scene/env/surface pickers).
type SceneryApp = { id: string; name: string };
type SceneryOption = { id: string; name: string; appId?: string };
type SceneryEnvTime = { id: string; name: string };
type SceneryEnvEra = { id: string; name: string; times: SceneryEnvTime[] };
type SceneryEnvOption = SceneryOption & { eras: SceneryEnvEra[] };

type ScenerySelectorProps = {
  apps: SceneryApp[];
  scenes: SceneryOption[];
  sceneId: string | null;
  setSceneId: (id: string | null) => void;
  cycleScene: (dir: number) => void;
  environments: SceneryEnvOption[];
  curEnv: SceneryEnvOption | null;
  curEra: SceneryEnvEra | null;
  curTime: SceneryEnvTime | null;
  applyEnv: (id: string | null) => void;
  applyEra: (id: string) => void;
  setEnvTime: (id: string) => void;
  cycleEnv: (dir: number) => void;
  cycleEra: (dir: number) => void;
  cycleTime: (dir: number) => void;
  surfaces: SceneryOption[];
  surfaceId: string | null;
  setSurfaceId: (id: string | null) => void;
  cycleSurface: (dir: number) => void;
  savedSceneryPresets: SavedSceneryPreset[];
  appSceneryPresets: AppSceneryPreset[];
  saveSceneryPresetAs: (name: string) => void;
  loadSceneryPreset: (data: SceneryData) => void;
  deleteSceneryPreset: (id: string) => void;
};

export function ScenerySelectorButton(props: ScenerySelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-line-2 ui-tint-1 ui-ink ui-press flex h-7 w-7 items-center justify-center rounded-full border transition active:scale-95"
        aria-label={t("sceneryPresets.buttonAriaLabel")}
        title={t("sceneryPresets.buttonTitle")}
      >
        <Mountain className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open && <ScenerySelectorDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function appName(apps: SceneryApp[], appId: string | undefined): string {
  if (!appId) return "";
  return apps.find((a) => a.id === appId)?.name ?? appId;
}

// "Name — App" (or just "Name" when there's no owning app, e.g. a future
// entry with no appId) — the label format used throughout this dialog's
// option lists so a scene/environment/surface can be told apart from a
// same-named one shipped by a different app.
function labelWithApp(apps: SceneryApp[], option: SceneryOption): string {
  const app = appName(apps, option.appId);
  return app ? `${option.name} — ${app}` : option.name;
}

function ScenerySelectorDialog({
  onClose,
  apps,
  scenes,
  sceneId,
  setSceneId,
  cycleScene,
  environments,
  curEnv,
  curEra,
  curTime,
  applyEnv,
  applyEra,
  setEnvTime,
  cycleEnv,
  cycleEra,
  cycleTime,
  surfaces,
  surfaceId,
  setSurfaceId,
  cycleSurface,
  savedSceneryPresets,
  appSceneryPresets,
  saveSceneryPresetAs,
  loadSceneryPreset,
  deleteSceneryPreset,
}: ScenerySelectorProps & { onClose: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false);

  const combinedPresets = [
    ...appSceneryPresets.map((p) => ({
      key: `app:${p.appId}:${p.id}`,
      name: `${p.name} — ${appName(apps, p.appId)}`,
      data: p.data,
      deletable: false as const,
      deleteId: null as string | null,
    })),
    ...savedSceneryPresets.map((p) => ({
      key: `user:${p.id}`,
      name: p.name,
      data: p.data,
      deletable: true as const,
      deleteId: p.id,
    })),
  ];
  const activeKey = combinedPresets.some((p) => p.key === selected) ? selected : "";
  const active = combinedPresets.find((p) => p.key === activeKey) ?? null;

  const btnClass =
    "ui-tint-1 ui-ink-muted ui-press rounded-full border ui-line-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider transition active:scale-95 disabled:opacity-30";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("sceneryPresets.title")}
        onClick={(e) => e.stopPropagation()}
        className="ui-surface-solid flex w-full max-w-sm flex-col gap-1 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl"
      >
        <p className="ui-ink mb-2 text-center text-[11px] font-medium tracking-wide">
          {t("sceneryPresets.title")}
        </p>

        <div className="-mx-1 max-h-[50vh] overflow-y-auto px-1">
          {scenes.length > 0 && (
            <SettingRow
              label={t("dial.env.scene")}
              value={
                sceneId
                  ? (() => {
                      const s = scenes.find((s) => s.id === sceneId);
                      return s ? labelWithApp(apps, s) : sceneId;
                    })()
                  : t("common.off")
              }
              options={[t("common.off"), ...scenes.map((s) => labelWithApp(apps, s))]}
              selectedIndex={sceneId ? 1 + scenes.findIndex((s) => s.id === sceneId) : 0}
              onSelectIndex={(i) => setSceneId(i === 0 ? null : (scenes[i - 1]?.id ?? null))}
              onDec={() => cycleScene(-1)}
              onInc={() => cycleScene(1)}
            />
          )}
          {environments.length > 0 && (
            <>
              <SettingRow
                label={t("dial.env.environment")}
                value={curEnv ? labelWithApp(apps, curEnv) : t("common.off")}
                options={[t("common.off"), ...environments.map((e) => labelWithApp(apps, e))]}
                selectedIndex={
                  curEnv ? 1 + environments.findIndex((e) => e.id === curEnv.id) : 0
                }
                onSelectIndex={(i) => applyEnv(i === 0 ? null : (environments[i - 1]?.id ?? null))}
                onDec={() => cycleEnv(-1)}
                onInc={() => cycleEnv(1)}
              />
              {curEnv && curEnv.eras.length > 1 && (
                <SettingRow
                  label={t("dial.env.era")}
                  value={curEra?.name ?? "—"}
                  options={curEnv.eras.map((e) => e.name)}
                  selectedIndex={Math.max(0, curEnv.eras.findIndex((e) => e.id === curEra?.id))}
                  onSelectIndex={(i) => applyEra(curEnv.eras[i].id)}
                  onDec={() => cycleEra(-1)}
                  onInc={() => cycleEra(1)}
                />
              )}
              {curEra && curEra.times.length > 1 && (
                <SettingRow
                  label={t("dial.env.dayTime")}
                  value={curTime?.name ?? "—"}
                  options={curEra.times.map((tm) => tm.name)}
                  selectedIndex={Math.max(0, curEra.times.findIndex((tm) => tm.id === curTime?.id))}
                  onSelectIndex={(i) => setEnvTime(curEra.times[i].id)}
                  onDec={() => cycleTime(-1)}
                  onInc={() => cycleTime(1)}
                />
              )}
            </>
          )}
          {surfaces.length > 0 && (
            <SettingRow
              label={t("dial.water.reflection")}
              value={
                surfaceId
                  ? (() => {
                      const s = surfaces.find((s) => s.id === surfaceId);
                      return s ? labelWithApp(apps, s) : surfaceId;
                    })()
                  : t("common.off")
              }
              options={[t("common.off"), ...surfaces.map((s) => labelWithApp(apps, s))]}
              selectedIndex={surfaceId ? 1 + surfaces.findIndex((s) => s.id === surfaceId) : 0}
              onSelectIndex={(i) => setSurfaceId(i === 0 ? null : (surfaces[i - 1]?.id ?? null))}
              onDec={() => cycleSurface(-1)}
              onInc={() => cycleSurface(1)}
            />
          )}
        </div>

        <div className="mb-1 mt-3 flex w-full flex-wrap items-center justify-center gap-1.5">
          <button
            onClick={() => {
              const name = window.prompt(t("sceneryPresets.savePromptTitle"));
              if (name && name.trim()) saveSceneryPresetAs(name.trim());
            }}
            className={btnClass}
          >
            {t("sceneryPresets.save")}
          </button>
          {combinedPresets.length > 0 && (
            <>
              <select
                value={activeKey}
                onChange={(e) => setSelected(e.target.value)}
                className="ui-line-1 ui-surface ui-ink-muted rounded-full border px-2 py-0.5 text-[9px]"
              >
                <option value="" disabled>
                  {t("sceneryPresets.choosePreset")}
                </option>
                {combinedPresets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!active}
                onClick={() => active && setConfirmLoadOpen(true)}
                className={btnClass}
              >
                {t("sceneryPresets.load")}
              </button>
              <button
                disabled={!active?.deletable}
                onClick={() => {
                  if (active?.deleteId && window.confirm(t("sceneryPresets.deleteConfirm"))) {
                    deleteSceneryPreset(active.deleteId);
                    setSelected("");
                  }
                }}
                className={btnClass}
              >
                {t("sceneryPresets.delete")}
              </button>
              <ConfirmDialog
                open={confirmLoadOpen}
                title={t("sceneryPresets.loadConfirmTitle")}
                message={t("sceneryPresets.loadConfirm")}
                confirmLabel={t("sceneryPresets.load")}
                cancelLabel={t("common.cancel")}
                onCancel={() => setConfirmLoadOpen(false)}
                onConfirm={() => {
                  setConfirmLoadOpen(false);
                  if (active) loadSceneryPreset(active.data);
                }}
              />
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="ui-tint-1 ui-ink-muted ui-press mt-1 rounded-full border px-2.5 py-0.5 text-[9px] font-light tracking-wider transition active:scale-95"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
