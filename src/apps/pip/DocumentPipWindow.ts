import { PIP_ACTIVE_ATTR } from "./pipState";

// Desktop Chrome (116+): Document Picture-in-Picture. The page's <main> (the
// scene, marked data-pip-root) moves into an always-on-top window and moves
// back when that window closes. The WebGL canvas keeps its context through
// the move. CSS (styles.css, [data-pip-active]) hides every HUD control in
// the small window, so only the scene layers (data-pip-scene) show.

type DocumentPictureInPictureApi = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
};

export const PIP_ROOT_SELECTOR = "main[data-pip-root]";

function api(): DocumentPictureInPictureApi | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { documentPictureInPicture?: DocumentPictureInPictureApi };
  return w.documentPictureInPicture ?? null;
}

export function documentPipAvailable(): boolean {
  return !!api();
}

/** Same stylesheets in the PiP window (Tailwind classes, fonts, theme tokens). */
function copyStyles(from: Document, to: Document): void {
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const style = to.createElement("style");
      style.textContent = css;
      to.head.appendChild(style);
    } catch {
      // Cross-origin sheet (no cssRules access): link it instead.
      if (!sheet.href) continue;
      const link = to.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      to.head.appendChild(link);
    }
  }
}

const fireResize = () => window.dispatchEvent(new Event("resize"));

export type PipPlaceholderText = { message: string; back: string };

export class DocumentPipWindow {
  private win: Window | null = null;
  private root: HTMLElement | null = null;
  private placeholder: HTMLElement | null = null;

  constructor(private readonly onClosed: () => void) {}

  get window(): Window | null {
    return this.win;
  }

  /** Opens the window (needs a click, or Chrome's auto-enter media action). */
  async open(
    size: { width: number; height: number },
    text: PipPlaceholderText,
  ): Promise<Window | null> {
    const pip = api();
    const root = document.querySelector<HTMLElement>(PIP_ROOT_SELECTOR);
    if (!pip || !root?.parentNode) return null;
    if (this.win && !this.win.closed) return this.win;
    const win = await pip.requestWindow({
      width: Math.round(size.width),
      height: Math.round(size.height),
    });
    const doc = win.document;
    copyStyles(document, doc);
    for (const a of Array.from(document.documentElement.attributes)) {
      if (a.name !== PIP_ACTIVE_ATTR) doc.documentElement.setAttribute(a.name, a.value);
    }
    doc.documentElement.setAttribute(PIP_ACTIVE_ATTR, "document");
    doc.title = document.title;
    doc.body.className = document.body.className;
    doc.body.style.margin = "0";
    doc.body.style.background = "#000";
    doc.body.style.overflow = "hidden";

    const placeholder = document.createElement("div");
    placeholder.setAttribute("data-pip-placeholder", "");
    placeholder.style.cssText =
      "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#000;color:rgba(255,255,255,.7);font:300 12px/1.4 system-ui,sans-serif;letter-spacing:.15em;text-align:center;padding:16px";
    const msg = document.createElement("p");
    msg.textContent = text.message;
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = text.back;
    back.style.cssText =
      "border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 14px;background:transparent;color:#fff;font:inherit;letter-spacing:.2em;cursor:pointer";
    back.addEventListener("click", () => this.close());
    placeholder.append(msg, back);

    root.parentNode.insertBefore(placeholder, root);
    doc.body.append(root);
    this.win = win;
    this.root = root;
    this.placeholder = placeholder;
    win.addEventListener("pagehide", () => this.restore(), { once: true });
    win.addEventListener("resize", fireResize);
    fireResize();
    return win;
  }

  close(): void {
    const win = this.win;
    this.restore();
    if (win && !win.closed) win.close();
  }

  /** Puts the scene back where it was in the page. */
  private restore(): void {
    if (!this.win) return;
    if (this.placeholder && this.root) this.placeholder.replaceWith(this.root);
    this.win = null;
    this.root = null;
    this.placeholder = null;
    fireResize();
    this.onClosed();
  }
}
