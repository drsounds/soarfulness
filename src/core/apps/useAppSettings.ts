import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** One React setter per key of an app's settings slice. */
export type AppSetters<S> = { [K in keyof S]: Dispatch<SetStateAction<S[K]>> };

export type AppSettingsHandle<S extends object> = {
  /** Current values of the whole slice (a new object whenever a key changes). */
  values: S;
  /** Stable per-key setters, same shape as `useState` setters. */
  setters: AppSetters<S>;
  /** Put every key back to the app's defaults. */
  reset(): void;
  /** Apply the keys present in `patch` (undefined keys are left alone). */
  patch(patch: Partial<S>): void;
};

/**
 * State for one app's settings slice (`apps/<id>/settings.ts`): replaces a
 * `useState` per key plus the hand written reset and patch lists. `initial`
 * is read once, on the first render.
 */
export function useAppSettings<S extends object>(
  defaults: S,
  initial: S,
): AppSettingsHandle<S> {
  const [values, setValues] = useState<S>(() => {
    const out = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof S)[]) {
      if (initial[k] !== undefined) out[k] = initial[k];
    }
    return out;
  });
  const defaultsRef = useRef(defaults);
  const setters = useMemo(() => {
    const out = {} as AppSetters<S>;
    for (const k of Object.keys(defaultsRef.current) as (keyof S)[]) {
      out[k] = (v) =>
        setValues((prev) => {
          const next = typeof v === "function" ? (v as (p: S[typeof k]) => S[typeof k])(prev[k]) : v;
          return Object.is(next, prev[k]) ? prev : { ...prev, [k]: next };
        });
    }
    return out;
  }, []);
  const reset = useCallback(() => setValues({ ...defaultsRef.current }), []);
  const patch = useCallback((p: Partial<S>) => {
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(defaultsRef.current) as (keyof S)[]) {
        const v = p[k];
        if (v !== undefined && !Object.is(v, prev[k])) {
          next[k] = v as S[keyof S];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);
  return { values, setters, reset, patch };
}
