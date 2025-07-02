import { Modal, View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Animated } from 'react-native';
import { X, Check, Globe } from 'lucide-react-native';
import { useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { PanGestureHandler } from 'react-native-gesture-handler';

interface LanguageModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DRAG_DISMISS_THRESHOLD = 120;

export default function LanguageModal({ isVisible, onClose }: LanguageModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // State for selected language
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
  // Mock language data
  const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
  ];
  
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
          <Animated.View style={[styles.modalView, { transform: [{ translateY }] }]}>
            <View style={styles.header}>
              <Text style={styles.modalTitle}>Language Preference</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            
            <View style={styles.iconContainer}>
              <Globe size={isSmallScreen ? 32 : 40} color={colors.primary} />
            </View>
            
            <Text style={styles.description}>
              Choose your preferred language for the application.
            </Text>
            
            <ScrollView style={styles.languageList}>
              {languages.map(language => (
                <Pressable 
                  key={language.code}
                  style={[
                    styles.languageOption,
                    selectedLanguage === language.code && styles.selectedLanguage
                  ]}
                  onPress={() => setSelectedLanguage(language.code)}
                >
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageName}>{language.name}</Text>
                    <Text style={styles.languageNative}>{language.native}</Text>
                  </View>
                  {selectedLanguage === language.code && (
                    <View style={styles.checkContainer}>
                      <Check size={isSmallScreen ? 16 : 20} color={colors.primary} />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.applyButton} onPress={onClose}>
                <Text style={styles.applyButtonText}>Apply Changes</Text>
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
  iconContainer: {
    alignSelf: 'center',
    width: isSmallScreen ? 64 : 80,
    height: isSmallScreen ? 64 : 80,
    borderRadius: isSmallScreen ? 32 : 40,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: isSmallScreen ? 16 : 24,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: isSmallScreen ? 16 : 24,
    marginTop: isSmallScreen ? 12 : 16,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  languageList: {
    maxHeight: '50%',
    paddingHorizontal: isSmallScreen ? 16 : 24,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedLanguage: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  languageNative: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
  },
  checkContainer: {
    width: isSmallScreen ? 24 : 28,
    height: isSmallScreen ? 24 : 28,
    borderRadius: isSmallScreen ? 12 : 14,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: isSmallScreen ? 8 : 16,
  },
  applyButton: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});