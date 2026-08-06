// Metro config for react-native-webgpu + three.js's WebGPU backend.
//
// Three.js publishes separate WebGL and WebGPU entry points. Importing
// "three" or "three/webgpu" must resolve to the WebGPU build
// (build/three.webgpu.js), and "three/tsl" must resolve to the TSL node
// helpers (build/three.tsl.js) — see
// https://wcandillon.github.io/react-native-webgpu/docs/integrations/three-js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const threePackagePath = path.dirname(require.resolve("three/package.json"));

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
