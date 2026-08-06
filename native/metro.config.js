// Metro config for react-native-webgpu + three.js's WebGPU backend.
//
// Three.js publishes separate WebGL and WebGPU entry points. Importing
// "three" or "three/webgpu" must resolve to the WebGPU build
// (build/three.webgpu.js), and "three/tsl" must resolve to the TSL node
// helpers (build/three.tsl.js) — see
// https://wcandillon.github.io/react-native-webgpu/docs/integrations/three-js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// `require.resolve("three/package.json")` throws under Node's "exports"
// enforcement — three's package.json doesn't list "./package.json" as an
// exported subpath, so resolving it as a module specifier is rejected even
// though the file exists on disk. Resolve the main entry file instead (which
// *is* covered by "exports") and walk up to the nearest package.json with a
// plain fs check, which isn't subject to the exports map at all.
function resolvePackageDir(pkgName) {
  let dir = path.dirname(require.resolve(pkgName));
  while (!fs.existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate package.json for "${pkgName}"`);
    }
    dir = parent;
  }
  return dir;
}

const threePackagePath = resolvePackageDir("three");

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three" || moduleName === "three/webgpu") {
    return {
      filePath: path.resolve(threePackagePath, "build/three.webgpu.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "three/tsl") {
    return {
      filePath: path.resolve(threePackagePath, "build/three.tsl.js"),
      type: "sourceFile",
    };
  }
  if (moduleName.startsWith("three/addons/")) {
    return {
      filePath: path.resolve(
        threePackagePath,
        "examples/jsm/" + moduleName.replace("three/addons/", "") + ".js",
      ),
      type: "sourceFile",
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.assetExts = [...config.resolver.assetExts, "glb", "gltf", "hdr"];

module.exports = config;
