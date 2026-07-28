// Converts a plain YouTube link (watch/shorts/youtu.be/live) into its
// iframe-embeddable form. Any non-YouTube URL is returned unchanged (aside
// from normalization) so it can be dropped straight into an iframe src.

function parseTimeParam(v: string): number | null {
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  const total = h * 3600 + min * 60 + s;
  return total || null;
}

function buildEmbed(id: string, params: URLSearchParams): string {
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  embed.searchParams.set("rel", "0");
  const t = params.get("t") ?? params.get("start");
  if (t) {
    const seconds = parseTimeParam(t);
    if (seconds) embed.searchParams.set("start", String(seconds));
  }
  const list = params.get("list");
  if (list) embed.searchParams.set("list", list);
  return embed.toString();
}

export function toEmbedUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return "";
  }

  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id) return buildEmbed(id, url.searchParams);
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id) return buildEmbed(id, url.searchParams);
    }
    const shorts = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) return buildEmbed(shorts[1], url.searchParams);
    const live = url.pathname.match(/^\/live\/([^/]+)/);
    if (live) return buildEmbed(live[1], url.searchParams);
    if (url.pathname.startsWith("/embed/")) return url.toString();
  }

  return url.toString();
}
