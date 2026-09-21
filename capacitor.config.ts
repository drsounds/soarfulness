import type { CapacitorConfig } from "@capacitor/cli";

// Ships the built web app (see scripts/capacitor-snapshot-shell.mjs and the
// `build:capacitor` npm script) as an installable, fully offline Android
// app for Google Play. webDir has no `server.url` set, so Capacitor loads
// everything — the app shell and every scene/environment/audio asset under
// public/ — straight out of the APK's bundled assets; no network is needed
// to launch or run the core experience. See CAPACITOR_APP.md.
const config: CapacitorConfig = {
  // Distinct from native/'s `se.aquafulness.app.gen7` and from the
  // aqua-wave-dream sibling fork's Capacitor app — despite sharing origin,
  // Soartify/soarfulness and drsounds/aqua-wave-dream ship as two separate
  // Play Store listings with their own package identity and signing key
  // (see CAPACITOR_APP.md's "Play Store signing").
  appId: "se.soarfulness.app",
  appName: "Aquafulness",
  webDir: ".output/public",
  server: {
    // https (not the default `capacitor://`) so relative fetches the web
    // app already makes (e.g. same-origin API-style calls) keep working
    // exactly as they do on the actual deployed site.
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
