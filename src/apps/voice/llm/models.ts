import type { VoiceLlmModel } from "../settings";

// VOICE → LLM: the on-device models the interpreter can run, as WebLLM
// (MLC) prebuilt model ids. All are 4-bit and run on the GPU through
// WebGPU, inside the page's own worker (llmWorker.ts).
//
// Sizes are approximate: `downloadMb` is what is fetched once and kept in
// the browser's cache storage, `gpuMb` WebLLM's own figure for the GPU
// memory it needs.

export type LlmModelInfo = {
  id: VoiceLlmModel;
  /** WebLLM prebuilt model id. */
  webllmId: string;
  label: string;
  downloadMb: number;
  gpuMb: number;
};

export const LLM_MODELS: Record<VoiceLlmModel, LlmModelInfo> = {
  "qwen2.5-0.5b": {
    id: "qwen2.5-0.5b",
    webllmId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "QWEN 2.5 0.5B",
    downloadMb: 280,
    gpuMb: 945,
  },
  "llama-3.2-1b": {
    id: "llama-3.2-1b",
    webllmId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "LLAMA 3.2 1B",
    downloadMb: 700,
    gpuMb: 880,
  },
  "qwen2.5-1.5b": {
    id: "qwen2.5-1.5b",
    webllmId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "QWEN 2.5 1.5B",
    downloadMb: 870,
    gpuMb: 1630,
  },
};

/**
 * Hosts the model files may come from: WebLLM's prebuilt weights on
 * Hugging Face (and the storage it redirects to) and its compiled WebGPU
 * kernels on GitHub. Only GET requests while a model is being downloaded;
 * see llmWorker.ts.
 */
export const MODEL_HOSTS = [
  "huggingface.co",
  ".huggingface.co",
  ".hf.co",
  "raw.githubusercontent.com",
] as const;

export function isModelHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return MODEL_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
}
