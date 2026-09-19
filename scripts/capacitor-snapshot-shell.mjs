#!/usr/bin/env node
// The Capacitor/offline Android build needs a real index.html in
// .output/public — Capacitor's WebView loads a static webDir baked into the
// APK, with no server around to render one on request the way the app's
// normal Cloudflare/node-server deployments do (see vite.config.ts and
// Dockerfile: those always render `/` server-side, per request).
//
// This app has no per-request server data (no createServerFn/loaders that
// depend on cookies, headers, etc. — see docs/CAPACITOR_APP.md), so the
// server-rendered markup for "/" is the same for everyone. Rather than
// relying on TanStack Start's own built-in `spa`/prerender pipeline (tried
// first; its preview-server plugin assumes a plain `dist/server/<entry>.js`
// layout that doesn't match this repo's Nitro/Cloudflare-adapter build
// output, so it fails to find the server bundle it just built), this script
// just boots the real node-server build produced by
// `NITRO_PRESET=node-server vite build` (the same preset the Dockerfile
// deploys with — a supported, already-tested combination), fetches "/"
// from it once, and writes the response straight into .output/public as a
// static index.html. Capacitor's webDir then needs nothing else server-side
// at all: every asset under .output/public (including everything from
// public/, copied there during the build) ships inside the app package.
import { spawn } from "node:child_process";
import { writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const serverEntry = new URL("../.output/server/index.mjs", import.meta.url);
const publicDir = new URL("../.output/public/", import.meta.url);

await access(serverEntry).catch(() => {
  throw new Error(
    "'.output/server/index.mjs' not found — run `NITRO_PRESET=node-server vite build` first " +
      "(see the `build:capacitor` npm script).",
  );
});

const port = 41823 + Math.floor(Math.random() * 1000);
const host = "127.0.0.1";

const server = spawn(process.execPath, [fileURLToPath(serverEntry)], {
  cwd: rootDir,
  env: { ...process.env, HOST: host, PORT: String(port), NITRO_HOST: host, NITRO_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk));
server.stderr.on("data", (chunk) => (serverOutput += chunk));

const serverExited = new Promise((_resolve, reject) => {
  server.once("exit", (code) => reject(new Error(`node-server exited early (code ${code}):\n${serverOutput}`)));
});

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${host}:${port}/robots.txt`);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`node-server did not become ready on ${host}:${port}:\n${serverOutput}`);
}

try {
  await Promise.race([waitForServer(), serverExited]);

  const res = await fetch(`http://${host}:${port}/`);
  if (!res.ok) {
    throw new Error(`Fetching "/" from the node-server returned ${res.status} ${res.statusText}:\n${await res.text()}`);
  }
  const html = await res.text();
  if (!html.includes("<html")) {
    throw new Error(`Response for "/" doesn't look like an HTML document:\n${html.slice(0, 500)}`);
  }

  await writeFile(new URL("index.html", publicDir), html, "utf8");
  console.log(`Wrote .output/public/index.html (${(html.length / 1024).toFixed(1)} KiB) from ${host}:${port}/`);
} finally {
  server.kill();
}
