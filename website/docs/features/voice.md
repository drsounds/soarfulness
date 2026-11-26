---
title: Voice control (VOICE)
description: Control the app by talking to it: modes, moves and every setting by name, with fuzzy matching, a transcript and a debug window.
---

# Voice control (VOICE)

The `voice` app (`src/apps/voice/`) listens continuously and turns what you
say into the same changes the HUD and the settings dialog make. It is **off
by default**: switch on **SETTINGS → VOICE → VOICE CONTROL (LISTEN)** (the
Voice group sits in the bather category, and disappears when the app is
switched off under APPS). The browser or the Android app asks for the
microphone the first time it starts listening.

## Privacy: on the device only

Voice control **never sends audio or text to a server**. Speech is
recognized by a model on the device, and the command matching
(`commands.ts`, `VoiceCommandRegistry.ts`) is plain local code with no AI
service behind it. The optional AI interpreter (below) is a small model that
also runs on the device, with its network closed while it works. Where no on-device recognizer exists, voice control
says so and does not listen; it never falls back to a cloud recognizer.

| Where | Engine | File |
| --- | --- | --- |
| Android app (Android 12+) | Android's on-device recognizer, `SpeechRecognizer.createOnDeviceSpeechRecognizer`, restarted after every phrase so it never stops listening | `android/.../VoiceRecognitionPlugin.java` |
| Chrome (desktop, with on-device speech) | Web Speech API with `processLocally = true`, checked first with `SpeechRecognition.available({ langs, processLocally: true })` | `speechEngines.ts` |
| Older Android, Safari, Firefox, Chrome without on-device speech | none: the panel says there is no on-device recognition. Plain Web Speech is not used because it sends audio to a server | |

The on-device language pack may have to be downloaded once: the panel then
shows **DOWNLOAD … SPEECH MODEL** (`SpeechRecognition.install()` in Chrome,
`SpeechRecognizer.triggerModelDownload()` on Android 13+). English is the
default language because it is the one most likely to have an on-device
model; the phrases are English and Swedish either way.

The Android WebView has no Web Speech API, so the app uses its own
Capacitor plugin (`VoiceRecognition`, registered by hand in
`MainActivity`). It needs `RECORD_AUDIO` (asked for at runtime) and a
`<queries>` entry for `android.speech.RecognitionService` (Android 11+).
It stops listening while the activity is paused. Many devices play a short
system sound each time a recognition session starts; that is Android's, not
the app's.

## What you can say

Phrases are matched in English and Swedish, whatever the speech language.

| Say | Does |
| --- | --- |
| "swim" / "simma" | SIMMARE (`cameraMode = float`) |
| "fly" / "flyg" | FLYG (`noclip`) |
| "swing" / "gunga" | GUNGA, with TORNADO off |
| "whirlpool" / "virvel" | GUNGA with TORNADO on (the water whirlpool); "stop whirlpool" turns it off |
| "bodyflight", "watercraft" / "boat" | those modes |
| "next mode", "previous mode" | step through the switched-on modes |
| "swing higher" / "swing lower" (+ "much") | GUNGA INTENSITET up / down 3 (10) slider steps |
| "swing faster" / "swing slower" | GUNGA HASTIGHET × 1.25 / × 0.8 |
| "soar" / "rise" / "stig", "sink" / "dive" / "sjunk" | FLYG's OMVÄND STIGNING / FRITT FALL (switches to FLYG first) |
| "stop" / "hover" / "stanna" | neither: hold height |
| "soar faster", "sink faster", "... slower" | FALL/RISE SPEED × 1.5 / ÷ 1.5, and keep going that way |
| "fly faster" / "fly slower" | NOCLIP SPEED × 1.25 / × 0.8 |
| "change sway to north" (east, south west, 90 degrees...) | SVAJ RIKTNING to a compass bearing (0 = north = world −z) |
| "change sway to the left" (right, forward, back) | SVAJ RIKTNING relative to where you look |
| "turn sway left / right" | SVAJ RIKTNING ∓ 45° |
| "change waves to east", "turn waves right" | the same for VÅGRIKTNING |
| "open settings", "close settings" | the settings dialog |
| "what can I say" / "help" | opens the debug window with every command |
| "stop listening" / "sluta lyssna" | pause: only "wake up" / "vakna" is acted on |

And every setting, by its name:

| Say | Does |
| --- | --- |
| "set wave height to 3", "sätt våghöjd till fem", "wave height 3" | sets a number (clamped to the slider's range) |
| "set snow amount to max / min / default", "... to 50 percent" | the slider's ends, its default, or a share of its range |
| "increase wave height", "more sway", "öka våghöjd", "turn up fov" | one slider step up (× STEP SIZE); "a lot" = 5 steps; "by 2" = exactly 2 |
| "decrease wave height", "less sway", "minska ..." | one step down |
| "start ride", "aurora on", "turn on snow", "stop ride", "rain off" | on/off settings |
| "toggle clock" | flips an on/off setting |
| "set neon mode to fade", "set tornado direction to counterclockwise" | picks from a list |
| "reset wave height" | back to the default |

## How it works

```
recognizer ─▶ voiceBus.submit(alternatives) ─▶ host handler (routes/index.tsx)
                                                  │
              VoiceCommandRegistry.match() ◀──────┘  (all alternatives × all phrases)
                 │
                 ▼  outcome { label, patch?, actions? }
   applySettingsPatch(patch)        runVoiceAction(action)
   (same path as loading a preset)  (mode, whirlpool, vertical, direction, ...)
```

- **`VoiceCommandRegistry.ts`**: commands are phrases with `{slots}`
  (`"set {setting} to {value}"`). Fixed words are compared word by word
  with an edit distance (`textMatch.ts`, accents folded, so "vag" matches
  "våg"); extra words before or after cost a little; the slot words go to the
  command's `resolve()`, which scores them too. The best score over every
  alternative the recognizer gave wins if it reaches **MATCH STRICTNESS**
  (default 72 %). Ties go to the more specific phrase, so "swing higher"
  beats "swing".
- **`settingTargets.ts`**: every key of `DEFAULTS` with a boolean, number
  or listed string value becomes a target. Its spoken names are the
  settings row's label in the app language and in English, the key split
  into words (`swayAmp` → "sway amp") and the aliases in `aliases.ts`.
  Ranges and steps come from the row.
- **`settingCatalog.generated.ts`**: generated by
  `node scripts/gen-voice-catalog.mjs` from every `<SettingRow>` in
  `SettingsPanel.tsx` and `src/apps/*/*.tsx` (label i18n key, settings key,
  min, max / `mx(...)`, step, option list). A test fails when it is out of
  date, so **after adding or changing a settings row, run the script**.
  A setting with no row is still reachable by its key name.
- **`commands.ts`**: the mode commands and the generic setting commands.
- **`VoiceRuntime.ts`**: the app runtime; `frame()` keeps the recognizer
  running in the right language while the app and LISTEN are on, and
  `shutdown()` stops the microphone when the app is switched off.
- **`voiceBus.ts`**: shared state (status, interim text, log) for the
  transcript, the panel and the debug window.

## On-device AI interpreter (optional)

**SETTINGS → VOICE → INTERPRETER** chooses who turns a phrase into commands:

| Choice | What happens |
| --- | --- |
| **RULES** (default) | The phrase matcher above. Instant, nothing to download. |
| **RULES + ON-DEVICE AI** | The rules first, exactly as before (including ACT EARLY on partial results). Whole phrases the rules don't understand ("the sea is too rough", "I'm cold, stop the snow") go to a small language model running on the device. |
| **ON-DEVICE AI FIRST** | Every whole phrase goes to the model; the rules run when it is not ready, too slow (AI TIME LIMIT) or finds nothing. Partial results are not acted on, so this is slower than the rules. |

### Privacy: nothing leaves the device

The model runs **in the app itself**, in a web worker, on the GPU through
WebGPU ([WebLLM](https://github.com/mlc-ai/web-llm)). There is no cloud or
server option of any kind.

- The phrase, the settings the model is shown and its answer exist only in
  the page's memory. There is no chat history.
- The worker's `fetch` is closed while the model answers, and `WebSocket`,
  `XMLHttpRequest`, `EventSource` and `sendBeacon` are removed from it
  (`llm/networkGuard.ts`). Only while a model is **downloaded, loaded or
  removed** are GET requests to the model hosts (Hugging Face for the
  weights, GitHub for the compiled WebGPU kernels) let through. Those carry
  no voice data.
- The model is downloaded **only when you press DOWNLOAD MODEL**, once, into
  the browser's cache storage. DELETE MODEL removes it. With the
  interpreter on RULES, or voice off, the worker is not even started.

| Model | Download | GPU memory |
| --- | --- | --- |
| Qwen 2.5 0.5B (default) | ~280 MB | ~0.95 GB |
| Llama 3.2 1B | ~700 MB | ~0.9 GB |
| Qwen 2.5 1.5B | ~870 MB | ~1.6 GB |

Without WebGPU (Firefox, older browsers, possibly the Android WebView) the
panel says so and the rules are used.

### The internal tools (MCP-style)

The model never changes anything itself. It answers with tool calls, and
`llm/VoiceToolbox.ts` (the app's in-process MCP server: `listTools()` =
`tools/list`, `callTool()` = `tools/call`, JSON Schema inputs, `isError`
results) checks them against the same settings registry the rules use and
turns them into the same `{ label, patch, actions }` outcome:

| Tool | Does |
| --- | --- |
| `run_command(command)` | any fixed command by id: `mode.fly`, `swing.higher`, `fly.soarFaster`, `ui.openSettings`, `voice.sleep`... |
| `set_setting(key, value)` | number (clamped to the slider), true/false, a list option, or min / max / default |
| `adjust_setting(key, direction, steps?, amount?)` | up / down by slider steps or an amount; on/off and lists too |
| `toggle_setting(key)`, `reset_setting(key)` | |
| `point_direction(target, compass? / bearing? / relative?)` | sway or waves |
| `turn_direction(target, side)` | ± 45° |
| `list_settings(query)`, `get_setting(key)` | read only, never offered to the model as actions |

Schemas come from the settings rows (ranges, steps, option lists). Unknown
keys, wrong value kinds and the interpreter's own settings (`voiceOn`,
`voiceInterpreter`, `voiceLlmModel`, `voiceLlmTimeoutMs`) are refused.

Per phrase the model gets one short system message (the tools, the command
ids, and the dozen settings whose names come closest to what was heard,
with their ranges and values, `llm/prompt.ts`) and the phrase. Its answer
is constrained by a JSON schema (WebLLM compiles it to a grammar) whose
setting keys are only those candidates, so it can't name anything that
doesn't exist.

### Latency

Phrases are answered one at a time, each with its own deadline from when it
was heard (**AI TIME LIMIT**, default 2.5 s). A phrase still waiting or
generating at its deadline is interrupted and the rules' answer is used.
The debug window shows, per phrase, the AI's status and time, the tool
calls it made, anything refused, and whether the rules took over.

## Settings

| Key | UI | Default |
| --- | --- | --- |
| `voiceOn` | VOICE CONTROL (LISTEN) | off |
| `voiceLang` | SPEECH LANGUAGE: a fixed one, or auto (follows the app language) | English (US) |
| `voiceMatchThreshold` | MATCH STRICTNESS, 50–98 % | 72 % |
| `voiceStepScale` | STEP SIZE for increase / decrease | × 1 |
| `voiceTranscriptOn` | SHOW WHAT WAS HEARD: the caption at the bottom | on |
| `voiceDebug` | DEBUG WINDOW: every phrase, its match and score, a box to type commands, every command and setting name | off |
| `voiceInterpreter` | INTERPRETER: `rules`, `hybrid` (rules + on-device AI), `llm` (on-device AI first) | `rules` |
| `voiceLlmModel` | AI MODEL | `qwen2.5-0.5b` |
| `voiceLlmTimeoutMs` | AI TIME LIMIT, 500–10000 ms | 2500 |

Like the gamepad settings they belong to the device: they are not in
presets and survive opening a bath link.

## Testing without a microphone

Type into the debug window's box, or from the console:

```js
window.dispatchEvent(new CustomEvent("voice:text", { detail: "swing higher" }))
```

`bun test src/apps/voice` covers matching, numbers, directions and the
generic setting commands, and (`llm/llm.test.ts`) the tools, the prompt,
the interpreter's timeouts and queue, the voiceBus hand-over in both LLM
modes, the model lifecycle and the network guard, with a fake model. A real
model has not been run in these tests. The Android plugin has not been run on a device
yet.

## Adding to it

- A setting that is hard to say by its label: add an alias in `aliases.ts`.
- A new option list: add it to `ENUM_OPTIONS` in `enumOptions.ts` (the name
  must match the array the row's `onSelectIndex` indexes).
- A new kind of action: add it to `voiceActions.ts`, a command in
  `commands.ts`, and its case in `runVoiceAction` in `routes/index.tsx`.
