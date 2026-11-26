import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalize } from "./textMatch";
import { latencySummary, reactionMs, type VoiceTiming } from "./utterance";
import { voiceBus, useVoiceState } from "./voiceBus";
import { voiceStatusText } from "./VoicePanel";

// VOICE debug window: status, every phrase heard (all of the recognizer's
// alternatives) with the command it matched and its score, a box to type a
// phrase as if it was said, and every command and setting name voice knows.
// Opened with VOICE → DEBUG WINDOW or by saying "what can I say".
//
// Each spoken phrase also shows how long it took: ⚡ ran early on a partial
// result (VOICE → ACT EARLY) or ✓ on the final one, the time from the words
// settling to the command running, and when the recognizer's final result
// came. The header shows the median of the last ten.

function timingText(
  t: (k: string, o?: Record<string, unknown>) => string,
  timing: VoiceTiming,
): string {
  const parts: string[] = [];
  const r = reactionMs(timing);
  parts.push(
    timing.early ? `⚡ ${t("dial.voice.debugWindow.early")}` : t("dial.voice.debugWindow.final"),
  );
  if (r !== null) parts.push(t("dial.voice.debugWindow.acted", { ms: Math.round(r) }));
  if (timing.early && timing.finalAt !== null && timing.firedAt !== null)
    parts.push(
      t("dial.voice.debugWindow.finalAfter", { ms: Math.round(timing.finalAt - timing.firedAt) }),
    );
  if (timing.endAt !== null && timing.finalAt !== null)
    parts.push(
      t("dial.voice.debugWindow.endToFinal", {
        ms: Math.max(0, Math.round(timing.finalAt - timing.endAt)),
      }),
    );
  parts.push(t("dial.voice.debugWindow.match", { ms: timing.matchMs.toFixed(1) }));
  return parts.join(" · ");
}

export function VoiceDebugWindow({
  appEnabled,
  onClose,
}: {
  appEnabled: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const state = useVoiceState();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"log" | "commands" | "settings">("log");
  const [typed, setTyped] = useState("");
  const [filter, setFilter] = useState("");
  // Opened from a saved setting, so the server render never has it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const vocab = voiceBus.vocabulary();
  if (!mounted) return null;
  const latency = latencySummary(state.log.map((e) => e.timing));

  const btn =
    "rounded-full border px-2 py-0.5 text-[9px] tracking-wider ui-line-2 ui-press active:scale-95";
  const tabBtn = (id: typeof tab) => `${btn} ${tab === id ? "bg-sky-300/70 text-black" : ""}`;
  const q = normalize(filter);
  const run = () => {
    if (!typed.trim()) return;
    voiceBus.submit([typed], "typed");
    setTyped("");
  };

  return (
    <div
      role="log"
      aria-label={t("dial.voice.debugWindow.title")}
      className="pointer-events-auto fixed left-2 top-24 z-[60] flex max-h-[70vh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border font-mono text-[10px] leading-snug bg-black/55 backdrop-blur-md ui-line-2 ui-surface ui-ink"
    >
      <div className="flex items-center gap-2 border-b px-3 py-1.5 ui-line-2">
        <span className="flex-1 font-sans text-[10px] tracking-[0.2em]">
          {t("dial.voice.debugWindow.title")}
        </span>
        <button type="button" className={btn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "+" : "–"}
        </button>
        <button type="button" className={btn} aria-label={t("common.close")} onClick={onClose}>
          ×
        </button>
      </div>
      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-1 border-b px-3 py-1.5 ui-line-2">
            <div>
              {appEnabled ? voiceStatusText(t, state) : t("dial.voice.debugWindow.appOff")}
              {state.engine && ` · ${state.engine}`}
            </div>
            {latency && (
              <div className="ui-ink-muted">
                {t("dial.voice.debugWindow.latency", {
                  ms: Math.round(latency.medianMs),
                  count: latency.count,
                })}
              </div>
            )}
            {state.interim && <div className="italic ui-ink-muted">… {state.interim}</div>}
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t("dial.voice.debugWindow.typePlaceholder")}
                className="min-w-0 flex-1 rounded-full border bg-transparent px-2 py-0.5 ui-line-2"
              />
              <button type="submit" className={btn}>
                {t("dial.voice.debugWindow.run")}
              </button>
            </form>
            <div className="flex gap-1">
              <button type="button" className={tabBtn("log")} onClick={() => setTab("log")}>
                {t("dial.voice.debugWindow.log")}
              </button>
              <button
                type="button"
                className={tabBtn("commands")}
                onClick={() => setTab("commands")}
              >
                {t("dial.voice.debugWindow.commands")}
              </button>
              <button
                type="button"
                className={tabBtn("settings")}
                onClick={() => setTab("settings")}
              >
                {t("dial.voice.debugWindow.settings", { count: vocab.settings.length })}
              </button>
              {tab === "log" && (
                <button
                  type="button"
                  className={`${btn} ml-auto`}
                  onClick={() => voiceBus.clearLog()}
                >
                  {t("dial.voice.debugWindow.clear")}
                </button>
              )}
            </div>
            {tab !== "log" && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("dial.voice.debugWindow.filter")}
                className="w-full rounded-full border bg-transparent px-2 py-0.5 ui-line-2"
              />
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "log" &&
              (state.log.length === 0 ? (
                <div className="px-3 py-1.5 ui-ink-muted">{t("dial.voice.debugWindow.empty")}</div>
              ) : (
                state.log.map((e) => (
                  <div key={e.id} className="border-b px-3 py-1 ui-line-2">
                    <div>
                      <span className="ui-ink-muted">
                        {new Date(e.at).toLocaleTimeString()} {e.source === "typed" ? "⌨" : "🎤"}
                      </span>{" "}
                      “{e.alternatives[0]}”
                    </div>
                    {e.alternatives.length > 1 && (
                      <div className="ui-ink-faint">
                        {e.alternatives
                          .slice(1)
                          .map((a) => `“${a}”`)
                          .join(" · ")}
                      </div>
                    )}
                    {e.timing && <div className="ui-ink-faint">{timingText(t, e.timing)}</div>}
                    {e.match ? (
                      <div className="text-emerald-300">
                        ✓ {e.match.outcome.label}{" "}
                        <span className="ui-ink-muted">
                          [{e.match.commandId} · “{e.match.phrase}” ·{" "}
                          {Math.round(e.match.score * 100)}%]
                        </span>
                      </div>
                    ) : (
                      <div className="text-amber-300">? {t("dial.voice.notUnderstood")}</div>
                    )}
                  </div>
                ))
              ))}
            {tab === "commands" &&
              vocab.commands
                .filter(
                  (c) => !q || c.phrases.some((p) => normalize(p).includes(q)) || c.id.includes(q),
                )
                .map((c) => (
                  <div key={c.id} className="border-b px-3 py-1 ui-line-2">
                    <span className="ui-ink-muted">{c.id}</span>{" "}
                    {c.phrases.map((p) => `“${p}”`).join(" · ")}
                  </div>
                ))}
            {tab === "settings" &&
              vocab.settings
                .filter(
                  (s) =>
                    !q || s.key.toLowerCase().includes(q) || s.names.some((n) => n.includes(q)),
                )
                .slice(0, 200)
                .map((s) => (
                  <div key={s.key} className="border-b px-3 py-1 ui-line-2">
                    {s.label}{" "}
                    <span className="ui-ink-muted">
                      ({s.kind}, {s.key})
                    </span>
                    <div className="ui-ink-faint">{s.names.map((n) => `“${n}”`).join(" · ")}</div>
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}
