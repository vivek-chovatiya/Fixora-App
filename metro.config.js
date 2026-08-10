const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Matches either path separator, so the patterns below work on Windows and POSIX.
 * As a JS string this is the character class [\\/].
 */
const SEP = '[\\\\/]';

/**
 * Native build output that must stay out of Metro's file map.
 *
 * Watchman is not installed on Windows, so Metro falls back to its own directory
 * watcher, which throws a fatal ENOENT if a watched directory disappears
 * mid-crawl. Gradle's CMake tasks create and delete temp directories under
 * `android/.cxx` on every native build, so rebuilding while Metro is running
 * would otherwise take the bundler down.
 *
 * `__tests__` reproduces React Native's own default, which this replaces.
 */
const blockList = new RegExp(
  '(' +
    [
      `.*${SEP}android${SEP}\\.cxx${SEP}.*`,
      `.*${SEP}android${SEP}build${SEP}.*`,
      `.*${SEP}android${SEP}app${SEP}build${SEP}.*`,
      `.*${SEP}ios${SEP}build${SEP}.*`,
      `${SEP}__tests__${SEP}.*`,
    ].join('|') +
    ')$',
);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
