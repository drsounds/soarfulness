import type { AppRuntime } from "./types";

// The startup/shutdown events of built-in ("virtual") apps. Their code stays
// in the core, so there is no scene object to hide: the app's runtime just
// announces the event and whoever owns the state reacts (routes/index.tsx
// switches away from a disabled camera mode, turns the tornado off, ...).
// Handlers must be safe to call repeatedly: the host announces the initial
// state of every app when the scene is built.

export type AppLifecycleEvent = "startup" | "shutdown";
export type AppLifecycleHandler = (event: AppLifecycleEvent) => void;

const handlers = new Map<string, Set<AppLifecycleHandler>>();

/** Listens to one app's startup/shutdown events; returns the unsubscribe. */
export function onAppLifecycle(id: string, handler: AppLifecycleHandler): () => void {
  let set = handlers.get(id);
  if (!set) handlers.set(id, (set = new Set()));
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

function emit(id: string, event: AppLifecycleEvent) {
  for (const h of [...(handlers.get(id) ?? [])]) h(event);
}

/** The runtime of a built-in app: no scene objects, only the two events. */
export class BuiltInRuntime implements AppRuntime {
  constructor(private readonly id: string) {}
  startup() {
    emit(this.id, "startup");
  }
  shutdown() {
    emit(this.id, "shutdown");
  }
  dispose() {}
}
