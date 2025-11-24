import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize, MIN_TEXT_SIZE_MULTIPLIER, MAX_TEXT_SIZE_MULTIPLIER } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import CustomSlider from '@/components/CustomSlider';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';

interface TextSizeModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function TextSizeModal({ isVisible, onClose }: TextSizeModalProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier, setTextSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const styles = createStyles(colors, isDark, textSizeMultiplier);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    onClose();
  };

  const handleValueChange = (value: number) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setTextSizeMultiplier(value);
    logAnalyticsEvent('change_text_size', { multiplier: value });
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Adjust Text Size</Text>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.description}>
            Apps that support Dynamic Type will adjust to your preferred reading size below.
          </Text>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>A</Text>
              <Text style={[styles.sliderLabel, styles.sliderLabelLarge]}>A</Text>
            </View>
            <CustomSlider
              style={styles.slider}
              minimumValue={MIN_TEXT_SIZE_MULTIPLIER}
              maximumValue={MAX_TEXT_SIZE_MULTIPLIER}
              value={textSizeMultiplier}
              step={0.05}
              onValueChange={handleValueChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <View style={styles.sliderValueContainer}>
              <Text style={styles.sliderValueText}>
                {Math.round(textSizeMultiplier * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Preview</Text>
            <Text style={styles.previewText}>
              This is how text will appear at the selected size.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 24 : 20, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  description: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textSecondary,
    lineHeight: getScaledFontSize(Platform.OS === 'ios' ? 24 : 20, textSizeMultiplier),
    marginBottom: 32,
  },
  sliderContainer: {
    marginBottom: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sliderLabelLarge: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 20 : 18, textSizeMultiplier),
    fontWeight: '600',
  },
  slider: {
    marginBottom: 16,
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  sliderValueText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: colors.text,
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  previewText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textSecondary,
    lineHeight: getScaledFontSize(Platform.OS === 'ios' ? 24 : 20, textSizeMultiplier),
  },
});

