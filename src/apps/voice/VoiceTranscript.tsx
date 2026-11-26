import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVoiceState } from "./voiceBus";

// VOICE → TRANSCRIPT: a small caption at the top of the screen with what
// is being heard right now, then the last phrase and what it did (or "?"
// when no command matched), fading after a few seconds.

const SHOW_MS = 4000;

export function VoiceTranscript() {
  const { t } = useTranslation();
  const state = useVoiceState();
  const last = state.log[0];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!last) return;
    setNow(Date.now());
    const id = window.setTimeout(() => setNow(Date.now()), SHOW_MS + 50);
    return () => window.clearTimeout(id);
  }, [last]);

  const listening = state.status === "listening";
  const showLast = last && now - last.at < SHOW_MS;
  let text: string | null = null;
  let detail: string | null = null;
  if (state.interim) text = state.interim;
  else if (showLast) {
    text = last.match?.heard ?? last.alternatives[0];
    detail = last.match ? last.match.outcome.label : t("dial.voice.notUnderstood");
  } else if (state.asleep && listening) text = t("dial.voice.status.asleep");
  else if (["denied", "error", "unsupported", "nolocal", "download"].includes(state.status))
    text = t(`dial.voice.status.${state.status}`, {
      lang: state.lang ?? "",
      error: state.error ?? "",
    });

  const dot = !listening
    ? "bg-white/40"
    : state.asleep
      ? "bg-amber-300"
      : state.interim
        ? "bg-emerald-300 animate-pulse"
        : "bg-emerald-300/70";

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-[55] flex justify-center px-4"
    >
      <div className="flex max-w-[min(32rem,100%)] items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[11px] leading-snug text-white backdrop-blur-md">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        {text ? (
          <span className="min-w-0 truncate">
            <span className={state.interim ? "italic opacity-80" : ""}>“{text}”</span>
            {detail && (
              <span className={last?.match ? "ml-2 text-emerald-200" : "ml-2 text-amber-200"}>
                {last?.match ? "✓ " : ""}
                {detail}
              </span>
            )}
          </span>
        ) : (
          <span className="opacity-70">{t("dial.voice.listeningShort")}</span>
        )}
      </div>
    </div>
  );
}
