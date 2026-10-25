// Production entry point for self-hosting (`bun run build:prod && bun run start`):
// serves the built client assets directly and falls back to the Nitro/TanStack
// Start fetch handler for everything else (page renders and server routes/functions).
// Requires a build with NITRO_PRESET=standard, whose server entry exports `{ fetch }`.
import { join, normalize } from "node:path";
import handler from "./.output/server/index.mjs";

const clientDir = join(import.meta.dir, ".output/public");
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

// Stealth mode: tell every crawler not to index anything (this covers non-HTML
// responses too, which the <meta name="robots"> tag in __root.tsx can't), and
// flat-out refuse known AI/scraper bots, since not all of them honour
// robots.txt. robots.txt itself stays reachable so well-behaved bots can read it.
const X_ROBOTS_TAG = "noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai";
const BLOCKED_BOTS =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|Claude-SearchBot|Claude-User|anthropic-ai|Google-Extended|GoogleOther|Applebot-Extended|PerplexityBot|Perplexity-User|CCBot|Bytespider|Amazonbot|meta-externalagent|FacebookBot|cohere-ai|Diffbot|YouBot|DuckAssistBot|MistralAI-User|AI2Bot|Omgilibot|ImagesiftBot|Timpibot|PetalBot|Scrapy/i;

// Public sites (sites.allow_anonymous, src/lib/publicSite.ts) are the exception: their pages are
// meant for search engines, so on their hosts the header is left off (each page's robots meta tag
// decides), and robots.txt lets search engines in and points at the sitemap. AI bots stay blocked.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const publicHosts = new Map();

function requestHost(request, url) {
  return (request.headers.get("x-forwarded-host") ?? url.host)
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

async function isPublicSiteHost(host) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !host) return false;
  const cached = publicHosts.get(host);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  let value = false;
  try {
    const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
    if (!SUPABASE_KEY.startsWith("sb_")) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_for_domain`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_domain: host }),
    });
    const rows = response.ok ? await response.json() : [];
    value = Array.isArray(rows) && rows[0]?.allow_anonymous === true;
  } catch (error) {
    console.error("[serve] site_for_domain failed", error);
  }
  publicHosts.set(host, { at: Date.now(), value });
  return value;
}

function publicRobotsTxt(host) {
  const bots = BLOCKED_BOTS.source.split("|").map((bot) => `User-agent: ${bot}`);
  return [
    "# A public Spacify site: search engines are welcome, AI crawlers are not.",
    ...bots,
    "Disallow: /",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /ics/",
    "",
    `Sitemap: https://${host}/sitemap.xml`,
    "",
  ].join("\n");
}

function withRobotsHeader(response, publicSite = false) {
  if (publicSite) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", X_ROBOTS_TAG);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const server = Bun.serve({
  port,
  hostname,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/robots.txt" && BLOCKED_BOTS.test(request.headers.get("user-agent") ?? "")) {
      return withRobotsHeader(new Response("Forbidden", { status: 403 }));
    }
    const host = requestHost(request, url);
    const publicSite = await isPublicSiteHost(host);
    if (publicSite && url.pathname === "/robots.txt") {
      return new Response(publicRobotsTxt(host), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname !== "/" && !url.pathname.endsWith("/")) {
      let filePath = "";
      try {
        filePath = join(clientDir, normalize(decodeURIComponent(url.pathname)));
      } catch {}
      if (filePath.startsWith(clientDir + "/")) {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          const headers = url.pathname.startsWith("/assets/")
            ? { "Cache-Control": "public, max-age=31536000, immutable" }
            : {};
          return withRobotsHeader(new Response(file, { headers }), publicSite);
        }
      }
    }
    return withRobotsHeader(await handler.fetch(request), publicSite);
  },
});

console.log(`Listening on http://${server.hostname}:${server.port}`);
