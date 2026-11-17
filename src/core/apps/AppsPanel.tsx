import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import type { AppFlags } from "./flags";
import type { AppRegistry } from "./registry";
import { useAppFlags } from "./useAppFlags";

// APPS: one on/off row per app this build ships (the SKU decides which). An
// off app is hidden, silent and skipped by the render loop; turning one on
// pulls in the apps it needs, turning one off switches off the apps that
// need it. The choice is kept per browser (see core/apps/appFlags.ts).

export function AppsPanel({ flags, registry }: { flags: AppFlags; registry: AppRegistry }) {
  const { t } = useTranslation();
  useAppFlags(flags);
  const names = (ids: string[]) =>
    ids.map((id) => registry.get(id)?.manifest.name ?? id).join(", ");
  return (
    <>
      <p className="pb-2 text-[10px] font-light leading-relaxed ui-ink-muted">
        {t("settings.apps.hint")}
      </p>
      {flags.availableIds().map((id) => {
        const m = registry.get(id)?.manifest;
        if (!m || m.switchable === false) return null;
        const on = flags.isEnabled(id);
        const needs = Object.keys(m.dependencies ?? {});
        return (
          <div key={id}>
            <SettingRow
              label={m.name}
              value={on ? t("common.on") : t("common.off")}
              onDec={() => flags.setEnabled(id, false)}
              onInc={() => flags.setEnabled(id, true)}
            />
            <div className="px-1 pb-1 text-[9px] font-light leading-snug ui-ink-muted">
              {m.description}
              {needs.length > 0 && ` · ${t("settings.apps.needs", { list: names(needs) })}`}
            </div>
          </div>
        );
      })}
    </>
  );
}
