import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { getCategoryIcon } from '@/lib/expenseCategories';

type QuickPlansProps = {
  onRequireAuth?: () => boolean;
};

/** Horizontal gap between the 4 columns (3 gaps per row). */
const GRID_GAP = 10;
/**
 * Home tab page uses paddingHorizontal 16; QuickPlans card uses padding 16 each side.
 * Extra buffer covers devices where content width is slightly below windowWidth − 64 so we
 * do not over-size cells (which would wrap at 3 columns with empty space on the right).
 */
const FALLBACK_HORIZONTAL_INSETS = 32 + 32 + 16;

export default function QuickPlans({ onRequireAuth }: QuickPlansProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { width: windowWidth } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setGridWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  }, []);

  const { itemWidth, iconBoxSize } = useMemo(() => {
    const measured = gridWidth > 0 ? gridWidth : Math.max(0, windowWidth - FALLBACK_HORIZONTAL_INSETS);
    // Floor so 4 cells + 3 gaps never exceed measured width (avoids wrap on Android Yoga).
    const cell = Math.max(0, Math.floor((measured - 3 * GRID_GAP) / 4));
    const icon = Math.min(56, Math.max(36, cell - 6));
    return { itemWidth: cell, iconBoxSize: icon };
  }, [gridWidth, windowWidth]);

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
      <Text style={styles.title}>Quick Vault Setup</Text>
      <View style={styles.card}>
        <View style={styles.grid} onLayout={onGridLayout}>
          {categories.map((category, index) => {
            const IconComponent = getCategoryIcon(category.id);
            const marginRight = index % 4 === 3 ? 0 : GRID_GAP;
            const marginBottom = index < 4 ? GRID_GAP : 0;
            return (
              <View
                key={category.id}
                style={[
                  styles.cell,
                  {
                    width: itemWidth,
                    marginRight,
                    marginBottom,
                  },
                ]}
              >
                <Pressable
                  style={styles.pressableFill}
                  onPress={() => {
                    if (onRequireAuth && !onRequireAuth()) return;
                    haptics.impact();
                    router.push({
                      pathname: '/create-vault/plan-details',
                      params: {
                        planTypes: JSON.stringify(['one_time']),
                        preselectedCategoryId: category.id,
                      },
                    });
                  }}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        width: iconBoxSize,
                        height: iconBoxSize,
                        borderRadius: iconBoxSize * 0.22,
                      },
                    ]}
                  >
                    {IconComponent && (
                      <IconComponent
                        size={Math.min(24, Math.round(iconBoxSize * 0.45))}
                        color={isDark ? colors.text : colors.primary}
                      />
                    )}
                  </View>
                  <Text style={[styles.label, { maxWidth: itemWidth }]} numberOfLines={1}>
                    {category.name}
                  </Text>
                </Pressable>
              </View>
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
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      marginTop: 12,
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
      width: '100%',
      alignSelf: 'stretch',
      alignContent: 'flex-start',
    },
    /** Outer cell: fixed width + margins replace gap (Android-safe). */
    cell: {
      flexShrink: 0,
      flexGrow: 0,
    },
    pressableFill: {
      width: '100%',
      alignItems: 'center',
    },
    iconContainer: {
      backgroundColor: colors.card,
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

