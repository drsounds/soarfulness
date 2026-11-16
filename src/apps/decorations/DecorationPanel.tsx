import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import {
  DECORATION_EMBED_MAX_BYTES,
  DECORATION_MAX_PER_SCENE,
  DECORATION_MAX_REPEAT_PER_AXIS,
  clampRepeatCount,
  decorationCopyCount,
  isEmbeddedDecorationSrc,
  type Decoration,
  type DecorationRepeat,
  type Vec3,
} from "@/apps/decorations/decorations";
import type { DecorationGizmoMode } from "@/apps/decorations/DecorationLayer";

// DEKORATIONER UI: the settings section (MILJÖ) listing the current scene's
// decorations with numeric move/rotate/scale/repeat fields, and the small HUD
// bar shown while placing with the 3D gizmo. Everything comes through one
// DecorationControls object built in routes/index.tsx, so this file is the
// whole UI and the settings panel only mounts it.

export type DecorationControls = {
  // The current scene's decorations, and its display name.
  list: Decoration[];
  sceneName: string;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  update: (id: string, patch: Partial<Decoration>) => void;
  importModel: () => void;
  busy: boolean;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  // Puts the decoration a few meters in front of the camera.
  moveToView: (id: string) => void;
  // Moves a model between "embedded in the JSON" and "stored on this device".
  toggleEmbed: (id: string) => void;
  // Placement with the 3D gizmo (closes settings, shows the HUD bar).
  placing: boolean;
  setPlacing: (on: boolean) => void;
  gizmoMode: DecorationGizmoMode;
  setGizmoMode: (m: DecorationGizmoMode) => void;
  gizmoSpace: "local" | "world";
  setGizmoSpace: (s: "local" | "world") => void;
};

const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
const fmt = (v: number, digits = 2) => String(+v.toFixed(digits));

const pill =
  "rounded-full border px-2.5 py-1 text-[10px] font-light tracking-[0.15em] transition active:scale-95 disabled:opacity-40";
const pillIdle = "ui-line-2 ui-surface ui-ink-muted";
const pillOn = "ui-line-3 ui-tint-2 ui-ink";

// One label and three compact number fields (X / Y / Z), like a 3D editor's
// transform panel. Commits on blur or Enter.
function Vec3Field({
  label,
  value,
  step,
  min,
  max,
  digits = 2,
  onChange,
}: {
  label: string;
  value: Vec3;
  step: number;
  min?: number;
  max?: number;
  digits?: number;
  onChange: (v: Vec3) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-24 shrink-0 text-[9px] font-light tracking-[0.2em] ui-ink-muted">
        {label}
      </span>
      <div className="grid flex-1 grid-cols-3 gap-1">
        {(["X", "Y", "Z"] as const).map((axis, i) => (
          <NumberField
            key={axis}
            axis={axis}
            value={value[i]}
            step={step}
            min={min}
            max={max}
            digits={digits}
            onCommit={(n) => {
              const next = [...value] as Vec3;
              next[i] = n;
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NumberField({
  axis,
  value,
  step,
  min,
  max,
  digits,
  onCommit,
}: {
  axis: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  digits: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(fmt(value, digits));
  useEffect(() => setText(fmt(value, digits)), [value, digits]);
  const commit = () => {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n)) return setText(fmt(value, digits));
    const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (c !== value) onCommit(c);
    else setText(fmt(value, digits));
  };
  return (
    <label className="flex min-w-0 items-center gap-1 rounded-lg border ui-line-2 ui-surface px-1.5 py-1">
      <span className="text-[9px] font-light ui-ink-faint">{axis}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full min-w-0 bg-transparent text-right text-[11px] font-light tabular-nums ui-ink outline-none"
      />
    </label>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-col border-t ui-line-2 pt-2">
      <span className="pb-1 text-[9px] font-light tracking-[0.28em] ui-ink-faint">{title}</span>
      {children}
    </div>
  );
}

export function DecorationSettings({ c }: { c: DecorationControls }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const d = c.list.find((x) => x.id === c.selectedId) ?? c.list[0];
  const patch = (p: Partial<Decoration>) => d && c.update(d.id, p);
  const patchRepeat = (p: Partial<DecorationRepeat>) =>
    d && c.update(d.id, { repeat: { ...d.repeat, ...p } });
  const embedded = d ? isEmbeddedDecorationSrc(d.src) : false;
  const canEmbed = d ? d.size <= DECORATION_EMBED_MAX_BYTES : false;
  const localCount = c.list.filter((x) => !isEmbeddedDecorationSrc(x.src)).length;
  const uniform = d ? d.scale[0] : 1;

  return (
    <div className="flex flex-col py-1">
      <div className="flex flex-wrap items-center justify-center gap-1.5 py-1">
        <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
          {t("decorations.title")}
        </span>
        <button
          type="button"
          onClick={c.importModel}
          disabled={c.busy || c.list.length >= DECORATION_MAX_PER_SCENE}
          title={t("decorations.importHint", { max: kb(DECORATION_EMBED_MAX_BYTES) })}
          className={`${pill} ${pillIdle}`}
        >
          {c.busy ? t("decorations.importing") : t("decorations.import")}
        </button>
      </div>
      <p className="text-center text-[10px] font-light leading-snug ui-ink-faint">
        {c.list.length === 0
          ? t("decorations.empty", { scene: c.sceneName })
          : t("decorations.perScene", { scene: c.sceneName, count: c.list.length })}
      </p>

      {c.list.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 py-2">
          {c.list.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => c.setSelectedId(x.id)}
              aria-pressed={x.id === d?.id}
              className={`${pill} ${x.id === d?.id ? pillOn : pillIdle} ${x.visible ? "" : "opacity-50"}`}
            >
              {x.name}
              {decorationCopyCount(x.repeat) > 1 ? ` ×${decorationCopyCount(x.repeat)}` : ""}
              <span className="ml-1 ui-ink-faint">
                {isEmbeddedDecorationSrc(x.src) ? "⛓" : "▣"}
              </span>
            </button>
          ))}
        </div>
      )}

      {d && (
        <>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => {
                c.setSelectedId(d.id);
                c.setPlacing(true);
              }}
              className={`${pill} ${pillOn}`}
            >
              {t("decorations.place")}
            </button>
            <button
              type="button"
              onClick={() => c.moveToView(d.id)}
              className={`${pill} ${pillIdle}`}
            >
              {t("decorations.moveToView")}
            </button>
            <button
              type="button"
              onClick={() => c.duplicate(d.id)}
              className={`${pill} ${pillIdle}`}
            >
              {t("decorations.duplicate")}
            </button>
            <button type="button" onClick={() => c.remove(d.id)} className={`${pill} ${pillIdle}`}>
              {t("decorations.remove")}
            </button>
          </div>

          <SettingRow
            label={t("decorations.visible")}
            value={onOff(d.visible)}
            onDec={() => patch({ visible: !d.visible })}
            onInc={() => patch({ visible: !d.visible })}
          />

          <Sub title={t("decorations.transform")}>
            <Vec3Field
              label={t("decorations.position")}
              value={d.position}
              step={0.1}
              onChange={(position) => patch({ position })}
            />
            <Vec3Field
              label={t("decorations.rotation")}
              value={d.rotation}
              step={15}
              digits={1}
              onChange={(rotation) => patch({ rotation })}
            />
            <Vec3Field
              label={t("decorations.scaleXyz")}
              value={d.scale}
              step={0.1}
              min={0.001}
              max={1000}
              digits={3}
              onChange={(scale) => patch({ scale })}
            />
            <SettingRow
              label={t("decorations.size")}
              mode="number"
              value={`${fmt(uniform, 3)}×`}
              rawValue={uniform}
              min={0.01}
              max={100}
              step={0.05}
              onSet={(v) => {
                // Uniform size keeps the decoration's X:Y:Z proportions.
                const k = Math.max(0.001, v) / (d.scale[0] || 1);
                patch({ scale: d.scale.map((s) => +(s * k).toFixed(4)) as Vec3 });
              }}
              onDec={() => patch({ scale: d.scale.map((s) => +(s / 1.25).toFixed(4)) as Vec3 })}
              onInc={() => patch({ scale: d.scale.map((s) => +(s * 1.25).toFixed(4)) as Vec3 })}
            />
            <SettingRow
              label={t("decorations.turn")}
              mode="number"
              value={`${fmt(d.rotation[1], 1)}°`}
              rawValue={d.rotation[1]}
              min={-180}
              max={180}
              step={5}
              onSet={(v) => patch({ rotation: [d.rotation[0], v, d.rotation[2]] })}
              onDec={() => patch({ rotation: [d.rotation[0], d.rotation[1] - 15, d.rotation[2]] })}
              onInc={() => patch({ rotation: [d.rotation[0], d.rotation[1] + 15, d.rotation[2]] })}
            />
          </Sub>

          <Sub
            title={`${t("decorations.repeat")}${
              decorationCopyCount(d.repeat) > 1
                ? ` · ${t("decorations.copies", { count: decorationCopyCount(d.repeat) })}`
                : ""
            }`}
          >
            <Vec3Field
              label={t("decorations.repeatCount")}
              value={d.repeat.count}
              step={1}
              min={1}
              max={DECORATION_MAX_REPEAT_PER_AXIS}
              digits={0}
              onChange={(count) => patchRepeat({ count: clampRepeatCount(count) })}
            />
            <Vec3Field
              label={t("decorations.repeatSpacing")}
              value={d.repeat.spacing}
              step={0.25}
              min={-1000}
              max={1000}
              onChange={(spacing) => patchRepeat({ spacing })}
            />
            <SettingRow
              label={t("decorations.repeatTurn")}
              mode="number"
              value={`${fmt(d.repeat.stepRotY, 1)}°`}
              rawValue={d.repeat.stepRotY}
              min={-180}
              max={180}
              step={5}
              onSet={(v) => patchRepeat({ stepRotY: v })}
              onDec={() => patchRepeat({ stepRotY: Math.max(-180, d.repeat.stepRotY - 5) })}
              onInc={() => patchRepeat({ stepRotY: Math.min(180, d.repeat.stepRotY + 5) })}
            />
            <SettingRow
              label={t("decorations.repeatScale")}
              mode="number"
              value={`${fmt(d.repeat.stepScale, 2)}×`}
              rawValue={d.repeat.stepScale}
              min={0.5}
              max={2}
              step={0.01}
              onSet={(v) => patchRepeat({ stepScale: v })}
              onDec={() =>
                patchRepeat({ stepScale: Math.max(0.5, +(d.repeat.stepScale - 0.05).toFixed(2)) })
              }
              onInc={() =>
                patchRepeat({ stepScale: Math.min(2, +(d.repeat.stepScale + 0.05).toFixed(2)) })
              }
            />
          </Sub>

          <Sub title={t("decorations.storage")}>
            <p className="text-[10px] font-light leading-snug ui-ink-muted">
              {embedded
                ? t("decorations.embeddedInfo", { size: kb(d.size) })
                : t("decorations.localInfo", { size: kb(d.size) })}
            </p>
            {!canEmbed && (
              <p className="pt-1 text-[10px] font-light leading-snug text-amber-400/90">
                {t("decorations.tooLargeToEmbed", { max: kb(DECORATION_EMBED_MAX_BYTES) })}
              </p>
            )}
            <div className="flex justify-center pt-1.5">
              <button
                type="button"
                disabled={c.busy || (!embedded && !canEmbed)}
                onClick={() => c.toggleEmbed(d.id)}
                className={`${pill} ${pillIdle}`}
              >
                {embedded ? t("decorations.makeLocal") : t("decorations.embed")}
              </button>
            </div>
          </Sub>
        </>
      )}

      {localCount > 0 && (
        <p className="pt-2 text-center text-[10px] font-light leading-snug ui-ink-faint">
          {t("decorations.localNotInLinks", { count: localCount })}
        </p>
      )}
    </div>
  );
}

// The bar shown over the scene while placing: which decoration the gizmo is
// on, the gizmo mode, and DONE. Tapping a decoration in the scene picks it.
export function DecorationHudBar({ c }: { c: DecorationControls }) {
  const { t } = useTranslation();
  const idx = c.list.findIndex((x) => x.id === c.selectedId);
  const d = idx >= 0 ? c.list[idx] : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") c.setPlacing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c]);
  const step = (dir: number) => {
    if (!c.list.length) return;
    const next = c.list[(Math.max(0, idx) + dir + c.list.length) % c.list.length];
    c.setSelectedId(next.id);
  };
  const modes: [DecorationGizmoMode, string][] = [
    ["translate", t("decorations.gizmo.move")],
    ["rotate", t("decorations.gizmo.rotate")],
    ["scale", t("decorations.gizmo.scale")],
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-30 mx-auto max-w-lg px-4">
      <div
        role="toolbar"
        aria-label={t("decorations.title")}
        className="pointer-events-auto flex flex-col gap-2 rounded-3xl border ui-line-1 ui-surface-strong px-3 py-2.5 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={c.list.length < 2}
            className={`${pill} ${pillIdle}`}
            aria-label={t("decorations.prev")}
          >
            ‹
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-[10px] font-light tracking-[0.2em] ui-ink">
            {d ? d.name : t("decorations.tapToPick")}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={c.list.length < 2}
            className={`${pill} ${pillIdle}`}
            aria-label={t("decorations.next")}
          >
            ›
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {modes.map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => c.setGizmoMode(m)}
              aria-pressed={c.gizmoMode === m}
              className={`${pill} ${c.gizmoMode === m ? pillOn : pillIdle}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => c.setGizmoSpace(c.gizmoSpace === "local" ? "world" : "local")}
            className={`${pill} ${pillIdle}`}
          >
            {c.gizmoSpace === "local" ? t("decorations.gizmo.local") : t("decorations.gizmo.world")}
          </button>
          {d && (
            <button
              type="button"
              onClick={() => c.moveToView(d.id)}
              className={`${pill} ${pillIdle}`}
            >
              {t("decorations.moveToView")}
            </button>
          )}
          <button type="button" onClick={() => c.setPlacing(false)} className={`${pill} ${pillOn}`}>
            {t("decorations.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
