import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { getCategoryIcon } from '@/lib/expenseCategories';

export default function QuickPlans() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();

  const categories = [
    { id: 'food', name: 'Food' },
    { id: 'shopping', name: 'Shopping' },
    { id: 'housing_rent', name: 'Housing' },
    { id: 'commute', name: 'Transport' },
    { id: 'healthcare', name: 'Health' },
    { id: 'education', name: 'Education' },
    { id: 'entertainment_social', name: 'Entertainment' },
    { id: 'utilities_bills', name: 'Utilities' },
  ];

  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Plans</Text>
      <View style={styles.card}>
        <View style={styles.grid}>
          {categories.map((category) => {
            const IconComponent = getCategoryIcon(category.id);
            return (
              <Pressable
                key={category.id}
                style={styles.item}
                onPress={() => {
                  haptics.impact();
                  router.push({
                    pathname: '/expense-planner/create/plan-details',
                    params: { preselectedCategoryId: category.id },
                  });
                }}
              >
                <View style={styles.iconContainer}>
                  {IconComponent && (
                    <IconComponent size={24} color={colors.primary} />
                  )}
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    title: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 0.5,
      borderColor: colors.border,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    item: {
      width: '22%',
      minWidth: 70,
      alignItems: 'center',
      marginBottom: 8,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
    },
  });

