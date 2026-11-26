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

## Engines

| Where | Engine | File |
| --- | --- | --- |
| Android app | Android's `SpeechRecognizer`, restarted after every phrase so it never stops listening | `android/.../VoiceRecognitionPlugin.java` |
| Chrome, Edge, Safari | Web Speech API (`SpeechRecognition`), continuous with interim results, restarted when the browser ends it | `speechEngines.ts` |
| Firefox and others | none: the panel says speech recognition is not available | |

The Android WebView has no Web Speech API, so the app uses its own
Capacitor plugin (`VoiceRecognition`, registered by hand in
`MainActivity`). It needs `RECORD_AUDIO` (asked for at runtime) and a
`<queries>` entry for `android.speech.RecognitionService` (Android 11+).
It stops listening while the activity is paused. Many devices play a short
system sound each time a recognition session starts; that is Android's, not
the app's.

Chrome's Web Speech recognition sends audio to Google's servers; Android's
recognizer may work on the device or online depending on the phone.

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

## Settings

| Key | UI | Default |
| --- | --- | --- |
| `voiceOn` | VOICE CONTROL (LISTEN) | off |
| `voiceLang` | SPEECH LANGUAGE: auto (follows the app language) or a fixed one | auto |
| `voiceMatchThreshold` | MATCH STRICTNESS, 50–98 % | 72 % |
| `voiceStepScale` | STEP SIZE for increase / decrease | × 1 |
| `voiceTranscriptOn` | SHOW WHAT WAS HEARD: the caption at the bottom | on |
| `voiceDebug` | DEBUG WINDOW: every phrase, its match and score, a box to type commands, every command and setting name | off |

Like the gamepad settings they belong to the device: they are not in
presets and survive opening a bath link.

## Testing without a microphone

Type into the debug window's box, or from the console:

```js
window.dispatchEvent(new CustomEvent("voice:text", { detail: "swing higher" }))
```

`bun test src/apps/voice` covers matching, numbers, directions and the
generic setting commands. The Android plugin has not been run on a device
yet.

## Adding to it

- A setting that is hard to say by its label: add an alias in `aliases.ts`.
- A new option list: add it to `ENUM_OPTIONS` in `enumOptions.ts` (the name
  must match the array the row's `onSelectIndex` indexes).
- A new kind of action: add it to `voiceActions.ts`, a command in
  `commands.ts`, and its case in `runVoiceAction` in `routes/index.tsx`.
