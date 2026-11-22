import { useTranslation } from "react-i18next";
import { sameLocalDate } from "@/lib/timeTravel";

export function TimeTimeline({
  date,
  liveColor,
  recordedColor,
  onSeek,
  onOpen,
}: {
  date: Date;
  liveColor: string;
  recordedColor: string;
  onSeek: (minute: number) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const minute = date.getHours() * 60 + date.getMinutes();
  const live = sameLocalDate(date, new Date());
  const color = live ? liveColor : recordedColor;
  const percent = (minute / 1439) * 100;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 max-w-full overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mx-auto max-w-3xl rounded-lg bg-black/60 px-3 py-2 text-white">
        <div className="flex items-center justify-between text-[10px] tabular-nums">
          <span>0:00</span>
          <button type="button" onClick={onOpen} className="rounded px-2 py-1">
            {date.toLocaleDateString()} · {String(date.getHours()).padStart(2, "0")}:
            {String(date.getMinutes()).padStart(2, "0")}
          </button>
          <span>23:59</span>
        </div>
        <div className="relative">
          {live && (
            <span
              className="pointer-events-none absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium"
              style={{ left: `${percent}%`, color }}
            >
              {t("timeTravel.liveTag")}
            </span>
          )}
          <input
            type="range"
            min={0}
            max={1439}
            step={1}
            value={minute}
            aria-label={t("timeTravel.seekLabel")}
            aria-valuetext={`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`}
            onChange={(event) => onSeek(Number(event.target.value))}
            className="block h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              accentColor: color,
              background: `linear-gradient(to right, ${color} ${percent}%, rgba(255,255,255,0.3) ${percent}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
