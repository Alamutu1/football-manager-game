// D3 note: expo-sqlite's web worker imports its WASM binary as a
// module (./wa-sqlite/wa-sqlite.wasm). Metro does not resolve .wasm
// by default, which broke `expo export --platform web` with
// "Unable to resolve ./wa-sqlite/wa-sqlite.wasm". Treating .wasm as
// an asset makes the import resolve to the emitted file's URL,
// which is exactly what the worker's locateFile hook expects.
// Additive only: no existing extension handling is changed, and the
// Android bundle is re-verified after any change here.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
module.exports = config;
