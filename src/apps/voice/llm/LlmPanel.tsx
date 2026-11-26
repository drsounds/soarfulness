import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import {
  VOICE_INTERPRETERS,
  VOICE_LLM_MODELS,
  type VoiceInterpreter,
  type VoiceLlmModel,
  type VoiceSettings,
} from "../settings";
import { localLlm, useLocalLlmState } from "./LocalLlm";
import { LLM_MODELS } from "./models";

// VOICE → INTERPRETER dials: rules / rules + on-device LLM / LLM first, the
// model, its download (never automatic) and the timeout after which the
// rules take over.

const clampMs = (v: number) => Math.round(Math.min(10000, Math.max(500, v)) / 100) * 100;

export function LlmPanel({ voice }: { voice: AppSettingsHandle<VoiceSettings> }) {
  const { t } = useTranslation();
  const llm = useLocalLlmState();
  const { voiceOn, voiceInterpreter, voiceLlmModel, voiceLlmTimeoutMs } = voice.values;
  const s = voice.setters;
  const hint =
    "max-w-[16rem] self-center text-center text-[10px] font-light leading-snug ui-ink-faint";
  const btn =
    "self-center rounded-full border px-3 py-1 text-[10px] tracking-wider ui-line-2 ui-press active:scale-95";
  const interpreterLabel = (i: VoiceInterpreter) => t(`dial.voice.llm.interpreters.${i}`);
  const modelLabel = (m: VoiceLlmModel) =>
    t("dial.voice.llm.modelOption", {
      name: LLM_MODELS[m].label,
      mb: LLM_MODELS[m].downloadMb,
    });
  const pick = <T,>(list: readonly T[], cur: T, d: number) =>
    list[Math.min(list.length - 1, Math.max(0, list.indexOf(cur) + d))];
  const info = LLM_MODELS[voiceLlmModel];

  let status: string;
  if (!voiceOn) status = t("dial.voice.llm.status.voiceOff");
  else if (llm.status === "downloading" || llm.status === "loading")
    status = t(`dial.voice.llm.status.${llm.status}`, {
      pct: Math.round(llm.progress * 100),
    });
  else status = t(`dial.voice.llm.status.${llm.status}`, { error: llm.error ?? "" });

  return (
    <>
      <SettingRow
        label={t("dial.voice.llm.interpreter")}
        value={interpreterLabel(voiceInterpreter)}
        onDec={() => s.voiceInterpreter(pick(VOICE_INTERPRETERS, voiceInterpreter, -1))}
        onInc={() => s.voiceInterpreter(pick(VOICE_INTERPRETERS, voiceInterpreter, 1))}
        options={VOICE_INTERPRETERS.map(interpreterLabel)}
        selectedIndex={Math.max(0, VOICE_INTERPRETERS.indexOf(voiceInterpreter))}
        onSelectIndex={(i) => s.voiceInterpreter(VOICE_INTERPRETERS[i])}
      />
      <p className={hint}>{t(`dial.voice.llm.interpreterHints.${voiceInterpreter}`)}</p>
      {voiceInterpreter !== "rules" && (
        <>
          <SettingRow
            label={t("dial.voice.llm.model")}
            value={modelLabel(voiceLlmModel)}
            onDec={() => s.voiceLlmModel(pick(VOICE_LLM_MODELS, voiceLlmModel, -1))}
            onInc={() => s.voiceLlmModel(pick(VOICE_LLM_MODELS, voiceLlmModel, 1))}
            options={VOICE_LLM_MODELS.map(modelLabel)}
            selectedIndex={Math.max(0, VOICE_LLM_MODELS.indexOf(voiceLlmModel))}
            onSelectIndex={(i) => s.voiceLlmModel(VOICE_LLM_MODELS[i])}
          />
          <p className={hint} role="status">
            {status}
          </p>
          {(llm.status === "downloading" || llm.status === "loading") && (
            <div className="h-1 w-40 self-center overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-sky-300/80 transition-[width]"
                style={{ width: `${Math.round(llm.progress * 100)}%` }}
              />
            </div>
          )}
          {voiceOn && (llm.status === "absent" || llm.status === "error") && (
            <button type="button" className={btn} onClick={() => void localLlm.download()}>
              {t("dial.voice.llm.download", { mb: info.downloadMb, gpu: info.gpuMb })}
            </button>
          )}
          {voiceOn && llm.status === "ready" && (
            <button type="button" className={btn} onClick={() => void localLlm.remove()}>
              {t("dial.voice.llm.remove")}
            </button>
          )}
          <SettingRow
            label={t("dial.voice.llm.timeout")}
            mode="number"
            value={`${voiceLlmTimeoutMs} ms`}
            rawValue={voiceLlmTimeoutMs}
            onSet={(v) => s.voiceLlmTimeoutMs(clampMs(v))}
            min={500}
            max={10000}
            step={100}
            onDec={() => s.voiceLlmTimeoutMs((v) => clampMs(v - 250))}
            onInc={() => s.voiceLlmTimeoutMs((v) => clampMs(v + 250))}
          />
          <p className={hint}>{t("dial.voice.llm.timeoutHint")}</p>
          <p className={hint}>{t("dial.voice.llm.privacy")}</p>
        </>
      )}
    </>
  );
}
