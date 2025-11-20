import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Card from '@/components/Card';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';

export default function RatingCard() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  // Store URLs
  const iOSStoreURL = 'https://apps.apple.com/app/id6753706776?action=write-review';
  const androidStoreURL = 'https://play.google.com/store/apps/details?id=com.planmoni'; // Update with actual Play Store URL when available

  return (
    <Card style={styles.feedbackCard}>
      <View style={styles.feedbackContent}>
        <Text style={styles.feedbackTitle}>What do you think of Planmoni?</Text>
        <Text style={styles.feedbackSubtitle}>Rate it and help us improve</Text>
        <View style={styles.starsRow}>
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={28} color={colors.text} fill={colors.backgroundTertiary} style={styles.starIcon} />
          ))}
        </View>
        <View style={styles.buttonsRow}>
          {Platform.OS === 'ios' && (
          <Pressable
              style={[styles.feedbackButton, styles.feedbackButtonActive]}
            onPress={() => {
              Linking.openURL(iOSStoreURL).catch((err) => {
                console.error('Failed to open iOS store URL:', err);
              });
            }}
          >
              <Text style={[styles.feedbackButtonText, styles.feedbackButtonTextActive]}>
              Rate on App Store
            </Text>
          </Pressable>
          )}
          {Platform.OS === 'android' && (
          <Pressable
              style={[styles.feedbackButton, styles.feedbackButtonActive]}
            onPress={() => {
              Linking.openURL(androidStoreURL).catch((err) => {
                console.error('Failed to open Android store URL:', err);
              });
            }}
          >
              <Text style={[styles.feedbackButtonText, styles.feedbackButtonTextActive]}>
              Rate on Play Store
            </Text>
          </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  feedbackCard: {
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 24 : 16  ,
  },
  feedbackContent: {
    alignItems: 'center',
    gap: 8,
  },
  feedbackTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  feedbackSubtitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  feedbackButton: {
    flex: 1,
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  feedbackButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 11, textSizeMultiplier),
    textAlign: 'center',
  },
  feedbackButtonTextActive: {
    color: '#FFFFFF',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 8 : 4,
    gap: 2,
  },
  starIcon: {
    marginHorizontal: 2,
  },
}); 