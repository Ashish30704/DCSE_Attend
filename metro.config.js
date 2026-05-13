const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

config.resolver.unstable_enablePackageExports = false;

// Ensure icon fonts stay in assetExts for web production (Firebase Hosting).
// Custom Metro wrappers can otherwise drop .ttf from the bundle, which shows "X" glyphs.
const assetExts = new Set(config.resolver.assetExts || []);
['ttf', 'otf', 'woff', 'woff2'].forEach((ext) => assetExts.add(ext));
config.resolver.assetExts = [...assetExts];

module.exports = withNativeWind(config, { input: './global.css' });