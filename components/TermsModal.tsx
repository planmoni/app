import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { X, FileText, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Modal, Animated } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useRef, useState } from 'react';

interface TermsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DRAG_DISMISS_THRESHOLD = 120;

export default function TermsModal({ isVisible, onClose }: TermsModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  const styles = createStyles(colors, isDark, isSmallScreen);

  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const handleGestureEnd = (event: any) => {
    setDragging(false);
    if (event.nativeEvent.translationY > DRAG_DISMISS_THRESHOLD) {
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        translateY.setValue(0);
        onClose();
      });
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.centeredView}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onBegan={() => setDragging(true)}
          onEnded={handleGestureEnd}
        >
          <Animated.View
            style={[styles.modalView, { transform: [{ translateY }] }]}
          >
            <View style={styles.header}>
              <Text style={styles.modalTitle}>Terms & Privacy</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.tabContainer}>
                <Pressable style={[styles.tab, styles.activeTab]}>
                  <Text style={[styles.tabText, styles.activeTabText]}>Terms of Service</Text>
                </Pressable>
                <Pressable style={styles.tab}>
                  <Text style={styles.tabText}>Privacy Policy</Text>
                </Pressable>
              </View>
              <View style={styles.iconContainer}>
                <FileText size={isSmallScreen ? 32 : 40} color={colors.primary} />
              </View>
              <Text style={styles.lastUpdated}>Last updated: June 15, 2025</Text>
              <View style={styles.termsSection}>
                <Text style={styles.sectionTitle}>1. Introduction</Text>
                <Text style={styles.termsText}>
                  Welcome to Planmoni. These Terms of Service govern your use of our application and services. By using Planmoni, you agree to these terms in full. If you disagree with any part of these terms, you must not use our application.
                </Text>
              </View>
              <View style={styles.termsSection}>
                <Text style={styles.sectionTitle}>2. Account Terms</Text>
                <Text style={styles.termsText}>
                  You are responsible for maintaining the security of your account and password. The company cannot and will not be liable for any loss or damage from your failure to comply with this security obligation.
                </Text>
              </View>
              <View style={styles.termsSection}>
                <Text style={styles.sectionTitle}>3. Payment Terms</Text>
                <Text style={styles.termsText}>
                  By using our services, you agree to pay all fees associated with the services you use. Fees are non-refundable except as required by law or as explicitly stated in these terms.
                </Text>
              </View>
              <View style={styles.termsSection}>
                <Text style={styles.sectionTitle}>4. Data Protection</Text>
                <Text style={styles.termsText}>
                  We take data protection seriously. Please refer to our Privacy Policy for information about how we collect, use, and disclose information about you.
                </Text>
              </View>
              <View style={styles.termsSection}>
                <Text style={styles.sectionTitle}>5. Limitations</Text>
                <Text style={styles.termsText}>
                  In no event shall the company be liable for any damages whatsoever, including but not limited to any direct, indirect, special, incidental, or consequential damages of any kind.
                </Text>
              </View>
              <View style={styles.privacyNote}>
                <Shield size={isSmallScreen ? 16 : 20} color={colors.primary} />
                <Text style={styles.privacyNoteText}>
                  Your privacy is important to us. We only collect data that's necessary to provide our services and protect your information with industry-standard security measures.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <Pressable style={styles.acceptButton} onPress={onClose}>
                <Text style={styles.acceptButtonText}>I Accept</Text>
              </Pressable>
            </View>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: isSmallScreen ? 18 : 24,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: '70%',
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 4,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  iconContainer: {
    alignSelf: 'center',
    width: isSmallScreen ? 64 : 80,
    height: isSmallScreen ? 64 : 80,
    borderRadius: isSmallScreen ? 32 : 40,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 16 : 20,
  },
  lastUpdated: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: isSmallScreen ? 16 : 24,
  },
  termsSection: {
    marginBottom: isSmallScreen ? 16 : 20,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  termsText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    marginTop: isSmallScreen ? 8 : 16,
    marginBottom: isSmallScreen ? 16 : 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});