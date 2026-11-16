import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { cloneEdgeFilter, type EdgeFilter } from "@/lib/edgeSelect";

// KANTVAL: which mesh edges a light effect follows — by direction (edges
// running along world X, Y or Z, or the rest) and by an optional world-space
// x/y/z range the edges are clipped to. Shared by NEON and the decorative
// lights' edge mode (lib/edgeSelect.ts has the math).

const AXES = ["x", "y", "z"] as const;
const RANGE_LIMIT = 500;

export function EdgeFilterSettings({
  value,
  onChange,
}: {
  value: EdgeFilter;
  onChange: (next: EdgeFilter) => void;
}) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const set = (patch: Partial<EdgeFilter>) => onChange({ ...cloneEdgeFilter(value), ...patch });

  const dir = (key: "x" | "y" | "z" | "other") => (
    <SettingRow
      key={key}
      label={t(`edgeFilter.dir.${key}`)}
      value={onOff(value[key])}
      onDec={() => set({ [key]: false })}
      onInc={() => set({ [key]: true })}
    />
  );

  const bound = (kind: "min" | "max", i: 0 | 1 | 2) => {
    const v = value[kind][i];
    const clamp = (x: number) => Math.max(-RANGE_LIMIT, Math.min(RANGE_LIMIT, +x.toFixed(2)));
    const write = (x: number) => {
      const next = cloneEdgeFilter(value);
      next[kind][i] = clamp(x);
      // Keep min <= max by pushing the other bound along.
      if (kind === "min" && next.min[i] > next.max[i]) next.max[i] = next.min[i];
      if (kind === "max" && next.max[i] < next.min[i]) next.min[i] = next.max[i];
      onChange(next);
    };
    return (
      <SettingRow
        key={`${kind}${i}`}
        label={t(`edgeFilter.${kind}`, { axis: AXES[i].toUpperCase() })}
        mode="number"
        value={`${v.toFixed(1)} m`}
        rawValue={v}
        min={-RANGE_LIMIT}
        max={RANGE_LIMIT}
        step={0.5}
        onSet={write}
        onDec={() => write(v - 0.5)}
        onInc={() => write(v + 0.5)}
      />
    );
  };

  return (
    <>
      {dir("x")}
      {dir("y")}
      {dir("z")}
      {dir("other")}
      <SettingRow
        label={t("edgeFilter.range")}
        value={onOff(value.rangeOn)}
        onDec={() => set({ rangeOn: false })}
        onInc={() => set({ rangeOn: true })}
      />
      {value.rangeOn && (
        <>
          {bound("min", 0)}
          {bound("max", 0)}
          {bound("min", 1)}
          {bound("max", 1)}
          {bound("min", 2)}
          {bound("max", 2)}
        </>
      )}
    </>
  );
}
