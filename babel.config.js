module.exports = function (api) {
  api.cache(true);

  const plugins = [];

  // Prefer production console stripping when the plugin is installed.
  // Hot-path logs are also gated with __DEV__ in critical contexts.
  if (process.env.NODE_ENV === 'production') {
    try {
      require.resolve('babel-plugin-transform-remove-console');
      plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
    } catch {
      // Plugin optional; continue without it.
    }
  }

  // Must be last.
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
