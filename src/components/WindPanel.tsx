import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import {
  WIND_MAX_SOURCES,
  WIND_MAX_SPEED,
  compassKey,
  makeWind,
  sumWinds,
  windFromBearing,
  type WindSource,
} from "@/lib/wind";

// VIND settings: the list of winds (each with its own direction, speed and
// gusts), what the wind affects and its sound. Rendered both in the floating
// panel opened by the VIND button in the main view (WindHudPanel) and under
// MILJÖ in the settings panel, from the same WindControls object built in
// routes/index.tsx.

export type WindControls = {
  winds: WindSource[];
  setWinds: Dispatch<SetStateAction<WindSource[]>>;
  windWavesOn: boolean;
  setWindWavesOn: Dispatch<SetStateAction<boolean>>;
  windWaveStrength: number;
  setWindWaveStrength: Dispatch<SetStateAction<number>>;
  windSwayOn: boolean;
  setWindSwayOn: Dispatch<SetStateAction<boolean>>;
  windSwayStrength: number;
  setWindSwayStrength: Dispatch<SetStateAction<number>>;
  windCurrentOn: boolean;
  setWindCurrentOn: Dispatch<SetStateAction<boolean>>;
  windCurrentStrength: number;
  setWindCurrentStrength: Dispatch<SetStateAction<number>>;
  windSoundOn: boolean;
  setWindSoundOn: Dispatch<SetStateAction<boolean>>;
  windSoundVolume: number;
  setWindSoundVolume: Dispatch<SetStateAction<number>>;
  windAltitudeAudioOn: boolean;
  setWindAltitudeAudioOn: Dispatch<SetStateAction<boolean>>;
  /** Bearing (deg) the camera currently looks toward, same convention as the winds. */
  getViewBearing: () => number;
};

const norm = (d: number) => ((d % 360) + 360) % 360;
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Arrow showing where a wind blows, relative to the current view (up =
// straight ahead).
function WindArrow({ relDeg, dim }: { relDeg: number; dim?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={dim ? "opacity-40" : ""}
      style={{ transform: `rotate(${relDeg}deg)` }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20V4M6 10l6-6 6 6" />
    </svg>
  );
}

function useViewBearing(get: () => number) {
  const [b, setB] = useState(() => get());
  useEffect(() => {
    const id = window.setInterval(() => setB(get()), 250);
    return () => window.clearInterval(id);
  }, [get]);
  return b;
}

export function WindSettings({ c }: { c: WindControls }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const view = useViewBearing(c.getViewBearing);
  const [selRaw, setSel] = useState(0);
  const sel = Math.min(selRaw, Math.max(0, c.winds.length - 1));
  const wind = c.winds[sel] as WindSource | undefined;
  const total = sumWinds(c.winds);

  const patch = (p: Partial<WindSource>) => {
    if (!wind) return;
    c.setWinds((ws) => ws.map((w) => (w.id === wind.id ? { ...w, ...p } : w)));
  };
  const add = () => {
    // A new wind blows straight into the face: from wherever the camera looks.
    const w = makeWind(norm(c.getViewBearing() + 180));
    c.setWinds((ws) => (ws.length >= WIND_MAX_SOURCES ? ws : [...ws, w]));
    setSel(c.winds.length);
  };
  const remove = () => {
    if (!wind) return;
    c.setWinds((ws) => ws.filter((w) => w.id !== wind.id));
    setSel((s) => Math.max(0, s - 1));
  };
  const fromLabel = (bearing: number) => {
    const from = windFromBearing(bearing);
    return `${t(`wind.compass.${compassKey(from)}`)} ${Math.round(from)}°`;
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 py-2">
        {c.winds.map((w, i) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={i === sel}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-light tracking-[0.15em] transition active:scale-95 ${
              i === sel ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink-muted"
            }`}
          >
            <WindArrow relDeg={w.bearing - view} dim={!w.on} />
            <span className="tabular-nums">
              {i + 1} · {w.speed.toFixed(0)} m/s
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={add}
          disabled={c.winds.length >= WIND_MAX_SOURCES}
          className="rounded-full border ui-line-2 ui-surface px-3 py-1.5 text-[10px] font-light tracking-[0.2em] ui-ink transition active:scale-95 disabled:opacity-40"
        >
          {t("wind.add")}
        </button>
      </div>
      {c.winds.length === 0 && (
        <p className="ui-ink-muted py-2 text-xs font-light leading-snug">{t("wind.empty")}</p>
      )}
      {c.winds.length > 1 && (
        <div className="ui-ink-muted flex items-center gap-2 py-1 text-xs font-light">
          <WindArrow relDeg={total.bearing - view} dim={total.speed < 0.05} />
          <span>
            {t("wind.total")}: {total.speed.toFixed(1)} m/s
            {total.speed >= 0.05 ? ` · ${t("wind.from")} ${fromLabel(total.bearing)}` : ""}
          </span>
        </div>
      )}
      {wind && (
        <>
          <SettingRow
            label={t("wind.windN", { n: sel + 1 })}
            value={onOff(wind.on)}
            onDec={() => patch({ on: false })}
            onInc={() => patch({ on: true })}
          />
          <SettingRow
            label={t("wind.direction")}
            mode="number"
            value={`${t("wind.from")} ${fromLabel(wind.bearing)}`}
            rawValue={windFromBearing(wind.bearing)}
            onSet={(v) => patch({ bearing: norm(v + 180) })}
            min={0}
            max={359}
            step={1}
            onDec={() => patch({ bearing: norm(wind.bearing - 5) })}
            onInc={() => patch({ bearing: norm(wind.bearing + 5) })}
          />
          <SettingRow
            label={t("wind.speed")}
            mode="number"
            value={`${wind.speed.toFixed(1)} m/s`}
            rawValue={wind.speed}
            onSet={(v) => patch({ speed: Math.max(0, Math.min(WIND_MAX_SPEED, v)) })}
            min={0}
            max={WIND_MAX_SPEED}
            step={0.5}
            onDec={() => patch({ speed: Math.max(0, +(wind.speed - 1).toFixed(1)) })}
            onInc={() => patch({ speed: Math.min(WIND_MAX_SPEED, +(wind.speed + 1).toFixed(1)) })}
          />
          <SettingRow
            label={t("wind.gust")}
            mode="number"
            value={pct(wind.gust)}
            rawValue={wind.gust}
            onSet={(v) => patch({ gust: Math.max(0, Math.min(1, v)) })}
            min={0}
            max={1}
            step={0.05}
            onDec={() => patch({ gust: Math.max(0, +(wind.gust - 0.05).toFixed(2)) })}
            onInc={() => patch({ gust: Math.min(1, +(wind.gust + 0.05).toFixed(2)) })}
          />
          <div className="flex flex-wrap gap-2 py-2">
            <button
              type="button"
              onClick={() => patch({ bearing: norm(c.getViewBearing() + 180) })}
              className="rounded-full border ui-line-2 ui-surface px-3 py-1.5 text-[10px] font-light tracking-[0.2em] ui-ink transition active:scale-95"
            >
              {t("wind.headwind")}
            </button>
            <button
              type="button"
              onClick={() => patch({ bearing: norm(c.getViewBearing()) })}
              className="rounded-full border ui-line-2 ui-surface px-3 py-1.5 text-[10px] font-light tracking-[0.2em] ui-ink transition active:scale-95"
            >
              {t("wind.tailwind")}
            </button>
            <button
              type="button"
              onClick={remove}
              className="rounded-full border ui-line-2 ui-surface px-3 py-1.5 text-[10px] font-light tracking-[0.2em] ui-ink-muted transition active:scale-95"
            >
              {t("wind.remove")}
            </button>
          </div>
        </>
      )}

      <SettingRow
        label={t("wind.waves")}
        value={onOff(c.windWavesOn)}
        onDec={() => c.setWindWavesOn(false)}
        onInc={() => c.setWindWavesOn(true)}
      />
      {c.windWavesOn && (
        <SettingRow
          label={t("wind.wavesStrength")}
          mode="number"
          value={pct(c.windWaveStrength)}
          rawValue={c.windWaveStrength}
          onSet={(v) => c.setWindWaveStrength(Math.max(0, Math.min(1, v)))}
          min={0}
          max={1}
          step={0.05}
          onDec={() => c.setWindWaveStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => c.setWindWaveStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
      )}
      <SettingRow
        label={t("wind.sway")}
        value={onOff(c.windSwayOn)}
        onDec={() => c.setWindSwayOn(false)}
        onInc={() => c.setWindSwayOn(true)}
      />
      {c.windSwayOn && (
        <SettingRow
          label={t("wind.swayStrength")}
          mode="number"
          value={pct(c.windSwayStrength)}
          rawValue={c.windSwayStrength}
          onSet={(v) => c.setWindSwayStrength(Math.max(0, Math.min(4, v)))}
          min={0}
          max={4}
          step={0.05}
          onDec={() => c.setWindSwayStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => c.setWindSwayStrength((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
        />
      )}
      <SettingRow
        label={t("wind.current")}
        value={onOff(c.windCurrentOn)}
        onDec={() => c.setWindCurrentOn(false)}
        onInc={() => c.setWindCurrentOn(true)}
      />
      {c.windCurrentOn && (
        <SettingRow
          label={t("wind.currentStrength")}
          mode="number"
          value={pct(c.windCurrentStrength)}
          rawValue={c.windCurrentStrength}
          onSet={(v) => c.setWindCurrentStrength(Math.max(0, Math.min(4, v)))}
          min={0}
          max={4}
          step={0.05}
          onDec={() => c.setWindCurrentStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => c.setWindCurrentStrength((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
        />
      )}
      <SettingRow
        label={t("wind.sound")}
        value={onOff(c.windSoundOn)}
        onDec={() => c.setWindSoundOn(false)}
        onInc={() => c.setWindSoundOn(true)}
      />
      <SettingRow
        label={t("wind.altitudeAudio")}
        value={onOff(c.windAltitudeAudioOn)}
        onDec={() => c.setWindAltitudeAudioOn(false)}
        onInc={() => c.setWindAltitudeAudioOn(true)}
      />
      {(c.windSoundOn || c.windAltitudeAudioOn) && (
        <SettingRow
          label={t("wind.soundVolume")}
          mode="number"
          value={pct(c.windSoundVolume)}
          rawValue={c.windSoundVolume}
          onSet={(v) => c.setWindSoundVolume(Math.max(0, Math.min(1, v)))}
          min={0}
          max={1}
          step={0.05}
          onDec={() => c.setWindSoundVolume((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => c.setWindSoundVolume((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
      )}
      <p className="ui-ink-faint py-2 text-[11px] font-light leading-snug">{t("wind.soundHint")}</p>
    </div>
  );
}

/** The floating VIND panel opened from the main view's VIND button. */
export function WindHudPanel({ c, onClose }: { c: WindControls; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+7.5rem)] z-30 mx-auto max-w-md px-6">
      <div
        role="dialog"
        aria-label={t("wind.title")}
        className="pointer-events-auto flex max-h-[65vh] flex-col overflow-hidden rounded-3xl border ui-line-1 ui-surface-strong shadow-2xl backdrop-blur-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b ui-line-2 px-4 py-2.5">
          <span className="text-[10px] font-light tracking-[0.28em] ui-ink-muted">
            {t("wind.title")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border ui-line-2 ui-surface px-3 py-1 text-[10px] font-light tracking-[0.2em] ui-ink transition active:scale-95"
          >
            {t("common.close")}
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-3">
          <WindSettings c={c} />
        </div>
      </div>
    </div>
  );
}
