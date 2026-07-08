const {
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require('expo/config-plugins');

/**
 * Resolves manifest merger conflicts between expo-secure-store and AppsFlyer
 * on android:fullBackupContent / android:dataExtractionRules by preferring
 * Secure Store backup rules.
 */
function withAndroidBackupRulesConflictFix(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults
    );

    const existingReplace = mainApplication.$['tools:replace'];
    const attrsToReplace = [
      'android:fullBackupContent',
      'android:dataExtractionRules',
    ];

    const current = existingReplace
      ? existingReplace.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    for (const attr of attrsToReplace) {
      if (!current.includes(attr)) {
        current.push(attr);
      }
    }

    mainApplication.$['tools:replace'] = current.join(',');

    // Prefer Secure Store rules so secrets are excluded from backup/extraction.
    mainApplication.$['android:fullBackupContent'] =
      '@xml/secure_store_backup_rules';
    mainApplication.$['android:dataExtractionRules'] =
      '@xml/secure_store_data_extraction_rules';

    return config;
  });
}

module.exports = createRunOncePlugin(
  withAndroidBackupRulesConflictFix,
  'withAndroidBackupRulesConflictFix',
  '1.0.0'
);
