import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Blocks,
  Camera,
  Clock,
  Cloud,
  CloudSun,
  Compass,
  Droplets,
  GalleryHorizontal,
  Glasses,
  Layers,
  List,
  MapPin,
  Monitor,
  Move,
  PartyPopper,
  Save,
  Search,
  Settings2,
  Sparkles,
  Timer,
  Volume2,
  Waves,
  X,
} from "lucide-react";

// GRUPPERADE INSTÄLLNINGAR: the settings panel's navigation.
//
// Every dial in SettingsPanel.tsx sits inside a <G id="…"> block naming the
// group it belongs to. The panel body is ONE big JSX tree holding every
// group; it's rendered once per visible scope (a group sub view, each search
// result section, each carousel page) under a ScopeCtx provider, and each
// <G> only lets its children through when its id is that scope's group. That
// lets a group's dials stay where they were written in the file (a group can
// have several <G> blocks) while the navigation decides what's on screen:
//
//   • list layout   — a home screen of group links (by category), each one
//                     opening that group's sub view with a back button.
//   • tabs layout   — a scrollable tab strip plus a swipeable carousel with
//                     one page per group (native scroll-snap, so fixed modals
//                     inside the pages still position like before; a mouse
//                     drag swipes on desktop too).
//   • search        — a search field above both; while it has text, every
//                     group is rendered with only the SettingRows (and
//                     <Findable> controls) whose label matches. A group whose
//                     own name matches shows all of its dials.

export type SettingsGroupId =
  | "state"
  | "time"
  | "place"
  | "weather"
  | "clouds"
  | "events"
  | "effects"
  | "waves"
  | "drift"
  | "water"
  | "bottom"
  | "mode"
  | "camera"
  | "bather"
  | "interval"
  | "graphics"
  | "sound"
  | "apps"
  | "app";

export type SettingsCategoryId = "top" | "scene" | "sea" | "bather" | "system";

export type SettingsGroup = {
  id: SettingsGroupId;
  category: SettingsCategoryId;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

// Order here is the order on the home screen and in the tab strip. Labels and
// one-line descriptions are i18n keys settings.groups.<id>.label / .desc.
export const SETTINGS_GROUPS: SettingsGroup[] = [
  { id: "state", category: "top", icon: Save },
  { id: "time", category: "scene", icon: Clock },
  { id: "place", category: "scene", icon: MapPin },
  { id: "weather", category: "scene", icon: CloudSun },
  { id: "clouds", category: "scene", icon: Cloud },
  { id: "events", category: "scene", icon: PartyPopper },
  { id: "effects", category: "scene", icon: Sparkles },
  { id: "waves", category: "sea", icon: Waves },
  { id: "drift", category: "sea", icon: Compass },
  { id: "water", category: "sea", icon: Droplets },
  { id: "bottom", category: "sea", icon: Layers },
  { id: "mode", category: "bather", icon: Move },
  { id: "camera", category: "bather", icon: Camera },
  { id: "bather", category: "bather", icon: Glasses },
  { id: "interval", category: "bather", icon: Timer },
  { id: "graphics", category: "system", icon: Monitor },
  { id: "sound", category: "system", icon: Volume2 },
  { id: "apps", category: "system", icon: Blocks },
  { id: "app", category: "system", icon: Settings2 },
];

const CATEGORY_ORDER: SettingsCategoryId[] = ["top", "scene", "sea", "bather", "system"];

// ---------------------------------------------------------------- scope ----

type Scope = { group: SettingsGroupId | null; query: string };
const ScopeCtx = createContext<Scope>({ group: null, query: "" });

/** Wraps the dials of one settings group; renders them only in that group's scope. */
export function G({ id, children }: { id: SettingsGroupId; children: ReactNode }) {
  const scope = useContext(ScopeCtx);
  return scope.group === id ? <>{children}</> : null;
}

/** The active search text ("" when not searching, or the group's own name matched). */
export function useSettingsQuery() {
  return useContext(ScopeCtx).query;
}

function normalize(s: string) {
  return s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Every whitespace-separated term of the query appears in text (case/accents ignored). */
export function matchesQuery(text: string, query: string) {
  const q = normalize(query).trim();
  if (!q) return true;
  const hay = normalize(text);
  return q.split(/\s+/).every((term) => hay.includes(term));
}

/**
 * Makes a control that isn't a SettingRow (color pickers, custom pill rows)
 * findable by search under the given label. Outside search it's a no-op
 * wrapper (display: contents).
 */
export function Findable({ label, children }: { label: string; children: ReactNode }) {
  const query = useSettingsQuery();
  if (query && !matchesQuery(label, query)) return null;
  return (
    <div data-srow="" className="contents">
      {children}
    </div>
  );
}

// --------------------------------------------------------------- layout ----

export type SettingsLayout = "list" | "tabs";
const LAYOUT_KEY = "aquafulness:settingsLayout:v1";

function readLayout(): SettingsLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "tabs" ? "tabs" : "list";
  } catch {
    return "list";
  }
}

/** Persisted (per device) choice between the list/sub-view and tabs-carousel layouts. */
export function useSettingsLayout() {
  const [layout, setLayoutState] = useState<SettingsLayout>(readLayout);
  const setLayout = useCallback((next: SettingsLayout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // private mode / blocked storage: keep it for this session only
    }
  }, []);
  return [layout, setLayout] as const;
}

// The panel unmounts when it's closed; remember where the carousel was so it
// reopens on the same page.
let lastCarouselGroup: SettingsGroupId | null = null;

// ------------------------------------------------------------ navigator ----

export function SettingsNavigator({
  groups,
  body,
}: {
  groups: SettingsGroup[];
  /** The full settings JSX tree, every dial wrapped in a <G>. */
  body: ReactNode;
}) {
  const { t } = useTranslation();
  const [layout, setLayout] = useSettingsLayout();
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<SettingsGroupId | null>(null);
  const [carouselGroup, setCarouselGroup] = useState<SettingsGroupId>(() =>
    lastCarouselGroup && groups.some((g) => g.id === lastCarouselGroup)
      ? lastCarouselGroup
      : groups[0].id,
  );
  useEffect(() => {
    lastCarouselGroup = carouselGroup;
  }, [carouselGroup]);

  const label = (id: SettingsGroupId) => t(`settings.groups.${id}.label`);
  const searching = query.trim().length > 0;

  const goToGroup = (id: SettingsGroupId) => {
    setQuery("");
    if (layout === "tabs") setCarouselGroup(id);
    else setOpenGroup(id);
  };

  return (
    <div className="flex flex-col">
      {/* Sticky header: search + layout toggle, and the tab strip in tabs mode.
          -mx/-mt cancel the scroll container's p-4 so it spans edge to edge. */}
      <div className="ui-surface-strong sticky -top-4 z-10 -mx-4 -mt-4 mb-2 border-b px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <label className="ui-tint-1 flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5">
            <Search className="ui-ink-faint h-4 w-4 shrink-0" strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("settings.search.placeholder")}
              aria-label={t("settings.search.placeholder")}
              className="ui-ink min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-60 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("settings.search.clear")}
                className="ui-ink-muted ui-press -mr-1 flex h-6 w-6 items-center justify-center rounded-full"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setLayout(layout === "tabs" ? "list" : "tabs")}
            aria-label={
              layout === "tabs" ? t("settings.layout.toList") : t("settings.layout.toTabs")
            }
            title={layout === "tabs" ? t("settings.layout.toList") : t("settings.layout.toTabs")}
            className="ui-tint-1 ui-ink ui-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-95"
          >
            {layout === "tabs" ? (
              <List className="h-4 w-4" strokeWidth={2} />
            ) : (
              <GalleryHorizontal className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
        {!searching && layout === "tabs" && (
          <TabStrip groups={groups} active={carouselGroup} onSelect={setCarouselGroup} />
        )}
        {!searching && layout === "list" && openGroup && (
          <button
            type="button"
            onClick={() => setOpenGroup(null)}
            className="ui-ink-muted ui-press mt-2 flex items-center gap-1.5 self-start rounded-full py-1 pr-3 text-xs font-medium tracking-wide outline-none transition"
            aria-label={t("settings.backAriaLabel")}
          >
            <span className="text-base leading-none" aria-hidden="true">
              ‹
            </span>
            {label(openGroup)}
          </button>
        )}
      </div>

      {searching ? (
        <div className="sp-results flex flex-col">
          {groups.map((g) => {
            const all = matchesQuery(label(g.id), query);
            return (
              <section key={g.id} className="sp-group mb-3" data-sall={all ? "" : undefined}>
                <button
                  type="button"
                  onClick={() => goToGroup(g.id)}
                  className="ui-ink-muted ui-press flex w-full items-center justify-between pt-2 text-[10px] font-light tracking-[0.28em] outline-none"
                >
                  <span>{label(g.id)}</span>
                  <span className="text-base leading-none" aria-hidden="true">
                    ›
                  </span>
                </button>
                <div className="sp-group-body flex flex-col">
                  <ScopeCtx.Provider value={{ group: g.id, query: all ? "" : query }}>
                    {body}
                  </ScopeCtx.Provider>
                </div>
              </section>
            );
          })}
          <p className="sp-empty ui-ink-faint py-6 text-center text-xs">
            {t("settings.search.noResults")}
          </p>
        </div>
      ) : layout === "tabs" ? (
        <Carousel
          groups={groups}
          active={carouselGroup}
          onActiveChange={setCarouselGroup}
          body={body}
        />
      ) : openGroup ? (
        <div className="flex flex-col">
          <ScopeCtx.Provider value={{ group: openGroup, query: "" }}>{body}</ScopeCtx.Provider>
        </div>
      ) : (
        <GroupHome groups={groups} onOpen={setOpenGroup} />
      )}
    </div>
  );
}

function GroupHome({
  groups,
  onOpen,
}: {
  groups: SettingsGroup[];
  onOpen: (id: SettingsGroupId) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-3" aria-label={t("settings.tabsAriaLabel")}>
      {CATEGORY_ORDER.map((cat) => {
        const inCat = groups.filter((g) => g.category === cat);
        if (inCat.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col">
            {cat !== "top" && (
              <span className="ui-ink-faint px-1 pb-1.5 text-[10px] font-light tracking-[0.28em]">
                {t(`settings.categories.${cat}`)}
              </span>
            )}
            <div
              className="flex flex-col overflow-hidden rounded-2xl border"
              style={{ borderColor: "var(--ui-line-1)" }}
            >
              {inCat.map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onOpen(g.id)}
                    className="ui-surface ui-press flex items-center gap-3 border-b px-4 py-3 text-left outline-none transition last:border-b-0"
                    style={{ borderColor: "var(--ui-line-1)" }}
                  >
                    <span className="ui-tint-1 ui-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="ui-ink text-sm font-medium tracking-wide">
                        {t(`settings.groups.${g.id}.label`)}
                      </span>
                      <span className="ui-ink-faint truncate text-[11px] font-light">
                        {t(`settings.groups.${g.id}.desc`)}
                      </span>
                    </span>
                    <span className="ui-ink-faint text-base leading-none" aria-hidden="true">
                      ›
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function TabStrip({
  groups,
  active,
  onSelect,
}: {
  groups: SettingsGroup[];
  active: SettingsGroupId;
  onSelect: (id: SettingsGroupId) => void;
}) {
  const { t } = useTranslation();
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the active tab in view as the carousel is swiped.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  const idx = groups.findIndex((g) => g.id === active);
  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label={t("settings.tabsAriaLabel")}
      className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && idx < groups.length - 1) onSelect(groups[idx + 1].id);
        if (e.key === "ArrowLeft" && idx > 0) onSelect(groups[idx - 1].id);
      }}
    >
      {groups.map((g) => {
        const Icon = g.icon;
        const on = g.id === active;
        return (
          <button
            key={g.id}
            type="button"
            role="tab"
            data-tab={g.id}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(g.id)}
            className={`ui-press flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide outline-none transition active:scale-95 ${
              on ? "ui-tint-2 ui-ink" : "ui-tint-1 ui-ink-muted"
            }`}
            style={on ? { borderColor: "var(--ui-line-3, currentColor)" } : undefined}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            {t(`settings.groups.${g.id}.label`)}
          </button>
        );
      })}
    </div>
  );
}

// One page per group in a horizontal scroll-snap strip. Native scrolling
// (instead of a transform-based carousel) matters: SettingRow's modal sheets
// are position: fixed inside the page, and a transformed ancestor would trap
// them. Only the active page and its neighbours mount their dials, and the
// strip's height follows the active page so shorter pages don't leave a gap.
function Carousel({
  groups,
  active,
  onActiveChange,
  body,
}: {
  groups: SettingsGroup[];
  active: SettingsGroupId;
  onActiveChange: (id: SettingsGroupId) => void;
  body: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const activeIdx = Math.max(
    0,
    groups.findIndex((g) => g.id === active),
  );
  // Set while we scroll the strip ourselves (tab click), so the scroll
  // handler doesn't fight it by reporting in-between pages.
  const programmatic = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);

  // Scroll to the active page whenever it changes from outside (tab click).
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || sc.clientWidth === 0) return;
    const target = activeIdx * sc.clientWidth;
    if (Math.abs(sc.scrollLeft - target) < 2) return;
    const first = sc.dataset.ready !== "1";
    programmatic.current = true;
    sc.scrollTo({ left: target, behavior: first ? "auto" : "smooth" });
    sc.dataset.ready = "1";
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(
      () => {
        programmatic.current = false;
      },
      first ? 50 : 600,
    );
  }, [activeIdx]);

  // Height of the strip = height of the active page.
  useLayoutEffect(() => {
    const page = pageRefs.current[activeIdx];
    if (!page) return;
    const update = () => setHeight(page.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(page);
    return () => ro.disconnect();
  }, [activeIdx]);

  // A swipe settles → that page becomes the active tab. scrollend where the
  // browser has it, a short debounce on scroll as the fallback.
  const settle = () => {
    const sc = scrollerRef.current;
    if (!sc || programmatic.current || drag.current || sc.clientWidth === 0) return;
    const i = Math.round(sc.scrollLeft / sc.clientWidth);
    const g = groups[Math.max(0, Math.min(groups.length - 1, i))];
    if (g && g.id !== active) onActiveChange(g.id);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const onEnd = () => {
      programmatic.current = false;
      settleRef.current();
    };
    sc.addEventListener("scrollend", onEnd);
    return () => sc.removeEventListener("scrollend", onEnd);
  }, []);
  const onScroll = () => {
    if (programmatic.current || drag.current) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => settleRef.current(), 120);
  };

  // Mouse drag-to-swipe for desktop (touch and trackpads scroll natively).
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    const sc = scrollerRef.current;
    if (!sc) return;
    drag.current = { x: e.clientX, left: sc.scrollLeft, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const sc = scrollerRef.current;
    if (!d || !sc) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      sc.style.scrollSnapType = "none";
      sc.setPointerCapture(e.pointerId);
    }
    sc.scrollLeft = d.left - dx;
  };
  const endDrag = (e: ReactPointerEvent) => {
    const d = drag.current;
    const sc = scrollerRef.current;
    drag.current = null;
    if (!d || !sc || !d.moved) return;
    const dx = e.clientX - d.x;
    const w = sc.clientWidth;
    let i = Math.round(d.left / w);
    if (dx < -w * 0.15) i += 1;
    else if (dx > w * 0.15) i -= 1;
    i = Math.max(0, Math.min(groups.length - 1, i));
    sc.style.scrollSnapType = "";
    programmatic.current = true;
    sc.scrollTo({ left: i * w, behavior: "smooth" });
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      programmatic.current = false;
    }, 600);
    if (groups[i].id !== active) onActiveChange(groups[i].id);
    // Swallow the click that follows a drag so it doesn't open a row.
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    sc.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => sc.removeEventListener("click", swallow, { capture: true }), 0);
  };

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="-mx-4 flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height }}
    >
      {groups.map((g, i) => (
        <div
          key={g.id}
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
          role="tabpanel"
          aria-hidden={i !== activeIdx}
          className="flex w-full shrink-0 snap-start snap-always flex-col px-4"
        >
          {Math.abs(i - activeIdx) <= 1 && (
            <ScopeCtx.Provider value={{ group: g.id, query: "" }}>{body}</ScopeCtx.Provider>
          )}
        </div>
      ))}
    </div>
  );
}
