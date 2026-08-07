// Converted from app.json to app.config.js so android.versionCode can be
// computed dynamically at build time instead of being a static number that
// has to be manually bumped by hand every time a Play Store upload attempt
// claims a code (see native/NATIVE_APP.md - two static bumps in a row both
// collided with codes Google had already seen, even from failed uploads).
//
// GITHUB_RUN_NUMBER is set automatically on every GitHub Actions run and
// strictly increases run over run for this workflow, so using it directly
// as the versionCode guarantees each CI-built AAB carries a code Google has
// never seen, with no manual bookkeeping. Falls back to 1 outside CI (local
// `expo prebuild`/`expo run:android`, or a future EAS build) - fine since
// those aren't used to produce Play Store uploads.
module.exports = {
  expo: {
    name: "Aquafulness",
    slug: "aquafulness",
    scheme: "aquafulness",
    version: "0.1.0",
    orientation: "default",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    assetBundlePatterns: ["assets/**/*"],
    ios: {
      bundleIdentifier: "se.aquafulness.app.gen7",
      supportsTablet: true,
      infoPlist: {
        UIRequiresFullScreen: true,
      },
    },
    android: {
      package: "se.aquafulness.app.gen7",
      versionCode: process.env.GITHUB_RUN_NUMBER
        ? Number(process.env.GITHUB_RUN_NUMBER)
        : 1,
      permissions: ["android.permission.INTERNET"],
    },
    plugins: [
      "react-native-webgpu",
      "./plugins/withAndroidReleaseSigning.js",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 26,
            buildArchs: ["arm64-v8a", "x86_64"],
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "0bbc297b-1ee1-46d3-a1b4-292c34d47cd7",
      },
    },
  },
};
