import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Card from '@/components/Card';

export default function RatingCard() {
  const { colors, isDark } = useTheme();

  const styles = createStyles(colors, isDark);

  return (
    <Card style={styles.feedbackCard}>
      <View style={styles.feedbackContent}>
        <Text style={styles.feedbackTitle}>What do you think of Planmoni?</Text>
        <Text style={styles.feedbackSubtitle}>Rate it and help us improve</Text>
        <View style={styles.starsRow}>
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={28} color={colors.primary} fill={colors.primary} style={styles.starIcon} />
          ))}
        </View>
        <Pressable
          style={styles.feedbackButton}
          onPress={() => {
            // Replace with your app's store URL
            Linking.openURL('https://get.planmoni.com');
          }}
        >
          <Text style={styles.feedbackButtonText}>
            {Platform.OS === 'ios' ? 'Rate it on App Store' : 'Rate it on Play Store'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  feedbackCard: {
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 24 : 16  ,
  },
  feedbackContent: {
    alignItems: 'center',
    gap: 8,
  },
  feedbackTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  feedbackSubtitle: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  feedbackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: Platform.OS === 'ios' ? 24 : 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 12,
  },
  feedbackButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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