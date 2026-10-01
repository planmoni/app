import { Modal, View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppVersion } from '@/contexts/AppVersionContext';
import { Download, X, AlertCircle } from 'lucide-react-native';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { logAnalyticsEvent } from '@/lib/firebase';

export default function UpdateAppModal() {
  const { colors } = useTheme();
  const { needsUpdate, updateData, dismissUpdate, currentVersion, currentBuild } = useAppVersion();
  const haptics = useHaptics();

  // Debug logging
  useEffect(() => {
    console.log('🔔 UpdateAppModal render check:', {
      needsUpdate,
      hasUpdateData: !!updateData,
      currentVersion,
      currentBuild,
      serverVersion: updateData?.ios_version || updateData?.android_version,
      serverBuild: updateData?.ios_build || updateData?.android_build,
      forceUpdate: updateData?.force_update
    });
  }, [needsUpdate, updateData, currentVersion, currentBuild]);

  if (!needsUpdate || !updateData) {
    return null;
  }

  const newVersion = Platform.OS === 'android' ? updateData.android_version : updateData.ios_version;
  const newBuild = Platform.OS === 'android' ? updateData.android_build : updateData.ios_build;
  const updateUrl = Platform.OS === 'android' ? updateData.android_update_url : updateData.ios_update_url;
  const isForceUpdate = updateData.force_update;

  const handleUpdate = async () => {
    try {
      if (Platform.OS !== 'web') {
        haptics.lightImpact();
      }

      logAnalyticsEvent('app_update_clicked', {
        current_version: currentVersion,
        current_build: currentBuild,
        new_version: newVersion,
        new_build: newBuild,
        platform: Platform.OS,
        force_update: isForceUpdate,
      });

      const canOpen = await Linking.canOpenURL(updateUrl);
      if (canOpen) {
        await Linking.openURL(updateUrl);
      } else {
        console.error('Cannot open update URL:', updateUrl);
      }
    } catch (error) {
      console.error('Error opening update URL:', error);
    }
  };

  const handleDismiss = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }

    logAnalyticsEvent('app_update_dismissed', {
      current_version: currentVersion,
      current_build: currentBuild,
      new_version: newVersion,
      new_build: newBuild,
      platform: Platform.OS,
    });

    dismissUpdate();
  };

  const styles = createStyles(colors);

  return (
    <Modal
      visible={needsUpdate}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={isForceUpdate ? undefined : handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {!isForceUpdate && (
            <Pressable
              style={styles.closeButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          )}


          <Text style={styles.title}>
            {isForceUpdate ? 'Update Required' : 'Update Available'}
          </Text>

          <Text style={styles.versionText}>
            Version {newVersion}
          </Text>

          <Text style={styles.message}>
            {updateData.update_message}
          </Text>

          <View style={styles.versionComparisonContainer}>
            <View style={styles.versionInfo}>
              <Text style={styles.versionLabel}>Current Version</Text>
              <Text style={styles.versionValue}>
                {currentVersion}
              </Text>
            </View>
            <View style={styles.versionDivider} />
            <View style={styles.versionInfo}>
              <Text style={styles.versionLabel}>New Version</Text>
              <Text style={[styles.versionValue, { color: colors.primary }]}>
                {newVersion}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.updateButton}
            onPress={handleUpdate}
          >
            <Text style={styles.updateButtonText}>
              {Platform.OS === 'android' ? 'Update on Play Store' : 'Update on App Store'}
            </Text>
          </Pressable>

          {!isForceUpdate && (
            <Pressable
              style={styles.dismissButton}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>
                Remind Me Later
              </Text>
            </Pressable>
          )}

          {isForceUpdate && (
            <View style={styles.forceUpdateNotice}>
              <AlertCircle size={16} color="#F59E0B" />
              <Text style={styles.forceUpdateText}>
                This update is required to continue using the app
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    paddingBottom: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 25,
    textAlign: 'center',
  },
  versionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  versionComparisonContainer: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  versionInfo: {
    flex: 1,
    alignItems: 'center',
  },
  versionDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  versionLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  forceUpdateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  forceUpdateText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
});
