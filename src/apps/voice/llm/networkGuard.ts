import { isModelHost } from "./models";

// VOICE → LLM: the fetch the model's worker gets (llmWorker.ts). Closed
// unless `isOpen()` (a model is being downloaded, loaded or removed), and
// then only GET requests to the model hosts. blob: and data: URLs never
// leave the page and are always allowed.

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function guardFetch(realFetch: typeof fetch, isOpen: () => boolean): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    const method = (
      init?.method ??
      (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const local = url.startsWith("blob:") || url.startsWith("data:");
    if (!local && (!isOpen() || method !== "GET" || !isModelHost(url))) {
      return Promise.reject(new Error(`voice LLM: network closed (${method} ${url})`));
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

/** Removes the other ways a worker can reach the network. */
export function closeOtherChannels(scope: Record<string, unknown>): void {
  for (const k of ["WebSocket", "XMLHttpRequest", "EventSource", "WebTransport"])
    scope[k] = undefined;
  const nav = scope.navigator as Record<string, unknown> | undefined;
  if (nav && "sendBeacon" in nav) nav.sendBeacon = () => false;
}
