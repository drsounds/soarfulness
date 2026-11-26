import { useSyncExternalStore } from "react";
import { LlmSwitch } from "./LlmSwitch";
import { LocalLlm, type LocalLlmState } from "./LocalLlm";
import { NativeLlm, nativeLlmAvailable } from "./NativeLlm";

// VOICE → LLM: the app's one on-device model (Gemini Nano on Android, or a
// WebGPU model in the page), for VoiceRuntime, the host and the panel.

export const onDeviceLlm = new LlmSwitch(new LocalLlm(), new NativeLlm(), nativeLlmAvailable);

export function useOnDeviceLlmState(): LocalLlmState {
  return useSyncExternalStore(onDeviceLlm.subscribe, onDeviceLlm.get, onDeviceLlm.get);
}
