import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { Findable } from "@/components/settingsNav";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { VOICE_LANGS, type VoiceSettings } from "./settings";
import { installSpeechModel, speechSupported } from "./speechEngines";
import { voiceBus, useVoiceState, type VoiceState } from "./voiceBus";
import { speechLang } from "./VoiceRuntime";

// VOICE dials. Reads and writes the app's settings handle
// (`useAppSettings(VOICE_DEFAULTS, ...)` in routes/index.tsx).

const step = (v: number, d: number, min: number, max: number) =>
  Math.min(max, Math.max(min, +(v + d).toFixed(2)));

export function voiceStatusText(
  t: (k: string, o?: Record<string, unknown>) => string,
  s: VoiceState,
): string {
  if (!speechSupported()) return t("dial.voice.status.unsupported");
  if (s.status === "listening" && s.asleep) return t("dial.voice.status.asleep");
  return t(`dial.voice.status.${s.status}`, { lang: s.lang ?? "", error: s.error ?? "" });
}

export const VOICE_EXAMPLES = [
  "swing",
  "swing higher",
  "whirlpool",
  "fly",
  "soar",
  "sink faster",
  "swim",
  "change sway to north",
  "increase wave height",
  "start ride",
  "set snow amount to 5000",
  "aurora on",
];

export function VoicePanel({ voice }: { voice: AppSettingsHandle<VoiceSettings> }) {
  const { t } = useTranslation();
  const state = useVoiceState();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    voiceOn,
    voiceLang,
    voiceMatchThreshold,
    voiceEarlyMs,
    voiceStepScale,
    voiceTranscriptOn,
    voiceDebug,
  } = voice.values;
  const s = voice.setters;
  const hint =
    "max-w-[16rem] self-center text-center text-[10px] font-light leading-snug ui-ink-faint";
  const langLabel = (l: (typeof VOICE_LANGS)[number]) =>
    l === "auto"
      ? t("dial.voice.langAuto", { lang: speechLang("auto") })
      : t(`dial.voice.langs.${l}`);

  return (
    <>
      <SettingRow
        label={t("dial.voice.on")}
        value={onOff(voiceOn)}
        onDec={() => s.voiceOn(false)}
        onInc={() => s.voiceOn(true)}
      />
      <p className={hint}>{voiceOn ? voiceStatusText(t, state) : t("dial.voice.offHint")}</p>
      {voiceOn && state.status === "download" && state.lang && (
        <button
          type="button"
          className="self-center rounded-full border px-3 py-1 text-[10px] tracking-wider ui-line-2 ui-press active:scale-95"
          onClick={() => {
            const lang = state.lang!;
            voiceBus.setStatus("starting", { lang, error: null });
            installSpeechModel(lang)
              .then((ok) => {
                if (ok) voiceBus.requestRestart();
                else voiceBus.setStatus("nolocal", { lang, error: null });
              })
              .catch((e: unknown) => voiceBus.setStatus("error", { lang, error: String(e) }));
          }}
        >
          {t("dial.voice.downloadModel", { lang: state.lang })}
        </button>
      )}
      <p className={hint}>{t("dial.voice.privacy")}</p>
      <SettingRow
        label={t("dial.voice.lang")}
        value={langLabel(voiceLang)}
        onDec={() => s.voiceLang(VOICE_LANGS[Math.max(0, VOICE_LANGS.indexOf(voiceLang) - 1)])}
        onInc={() =>
          s.voiceLang(
            VOICE_LANGS[Math.min(VOICE_LANGS.length - 1, VOICE_LANGS.indexOf(voiceLang) + 1)],
          )
        }
        options={VOICE_LANGS.map(langLabel)}
        selectedIndex={Math.max(0, VOICE_LANGS.indexOf(voiceLang))}
        onSelectIndex={(i) => s.voiceLang(VOICE_LANGS[i])}
      />
      <SettingRow
        label={t("dial.voice.threshold")}
        mode="number"
        value={`${Math.round(voiceMatchThreshold * 100)}%`}
        rawValue={voiceMatchThreshold}
        onSet={(v) => s.voiceMatchThreshold(Math.min(0.98, Math.max(0.5, v)))}
        min={0.5}
        max={0.98}
        step={0.01}
        onDec={() => s.voiceMatchThreshold((v) => step(v, -0.02, 0.5, 0.98))}
        onInc={() => s.voiceMatchThreshold((v) => step(v, 0.02, 0.5, 0.98))}
      />
      <p className={hint}>{t("dial.voice.thresholdHint")}</p>
      <SettingRow
        label={t("dial.voice.early")}
        mode="number"
        value={voiceEarlyMs > 0 ? `${voiceEarlyMs} ms` : t("dial.voice.earlyOff")}
        rawValue={voiceEarlyMs}
        onSet={(v) => s.voiceEarlyMs(Math.round(Math.min(1500, Math.max(0, v))))}
        min={0}
        max={1500}
        step={50}
        onDec={() => s.voiceEarlyMs((v) => step(v, -50, 0, 1500))}
        onInc={() => s.voiceEarlyMs((v) => step(v, 50, 0, 1500))}
      />
      <p className={hint}>{t("dial.voice.earlyHint")}</p>
      <SettingRow
        label={t("dial.voice.step")}
        mode="number"
        value={`×${voiceStepScale.toFixed(2)}`}
        rawValue={voiceStepScale}
        onSet={(v) => s.voiceStepScale(Math.min(10, Math.max(0.25, v)))}
        min={0.25}
        max={10}
        step={0.25}
        onDec={() => s.voiceStepScale((v) => step(v, -0.25, 0.25, 10))}
        onInc={() => s.voiceStepScale((v) => step(v, 0.25, 0.25, 10))}
      />
      <SettingRow
        label={t("dial.voice.transcript")}
        value={onOff(voiceTranscriptOn)}
        onDec={() => s.voiceTranscriptOn(false)}
        onInc={() => s.voiceTranscriptOn(true)}
      />
      <SettingRow
        label={t("dial.voice.debug")}
        value={onOff(voiceDebug)}
        onDec={() => s.voiceDebug(false)}
        onInc={() => s.voiceDebug(true)}
      />
      <p className={hint}>{t("dial.voice.debugHint")}</p>
      <Findable label={t("dial.voice.examples")}>
        <div className="flex w-full max-w-[22rem] flex-col gap-1 self-center pt-2">
          <span className="text-[10px] tracking-[0.2em] ui-ink">{t("dial.voice.examples")}</span>
          <p className="text-[10px] font-light leading-snug ui-ink-faint">
            {t("dial.voice.examplesHint")}
          </p>
          <div className="flex flex-wrap gap-1">
            {VOICE_EXAMPLES.map((ex) => (
              <span
                key={ex}
                className="rounded-full border px-2 py-0.5 text-[10px] ui-line-2 ui-ink-muted"
              >
                “{ex}”
              </span>
            ))}
          </div>
        </div>
      </Findable>
    </>
  );
}
