// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The baked 3D garden (assets/models, decision D40) ships as an asset, like the pictures.
config.resolver.assetExts.push('glb');

module.exports = config;
