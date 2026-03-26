import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 200;
const BAR_WIDTH = 40;
const BAR_SPACING = 16;

interface BarChartData {
  label: string;
  allocated: number;
  spent: number;
  color: string;
}

interface BarChartProps {
  data: BarChartData[];
  maxValue: number;
}

export default function BarChart({ data, maxValue }: BarChartProps) {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const getBarHeight = (value: number) => {
    return (value / maxValue) * (CHART_HEIGHT - 40);
  };

  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget Allocation vs Spent</Text>
      </View>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <G>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = 20 + ratio * (CHART_HEIGHT - 40);
            return (
              <Line
                key={index}
                x1={0}
                y1={y}
                x2={CHART_WIDTH}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.3}
              />
            );
          })}

          {/* Bars */}
          {data.map((item, index) => {
            const x = index * (BAR_WIDTH + BAR_SPACING) + BAR_SPACING;
            const allocatedHeight = getBarHeight(item.allocated);
            const spentHeight = getBarHeight(item.spent);
            const allocatedY = CHART_HEIGHT - 20 - allocatedHeight;
            const spentY = CHART_HEIGHT - 20 - spentHeight;

            return (
              <G key={index}>
                {/* Allocated bar (background) */}
                <Rect
                  x={x}
                  y={allocatedY}
                  width={BAR_WIDTH}
                  height={allocatedHeight}
                  fill={colors.backgroundTertiary}
                  rx={4}
                />
                {/* Spent bar (foreground) */}
                <Rect
                  x={x}
                  y={spentY}
                  width={BAR_WIDTH}
                  height={spentHeight}
                  fill={item.color}
                  rx={4}
                />
                {/* Label */}
                <SvgText
                  x={x + BAR_WIDTH / 2}
                  y={CHART_HEIGHT - 5}
                  fontSize={10}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {item.label.substring(0, 6)}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.backgroundTertiary }]} />
          <Text style={styles.legendText}>Allocated</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      marginVertical: 16,
    },
    header: {
      marginBottom: 16,
    },
    title: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginTop: 16,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendColor: {
      width: 12,
      height: 12,
      borderRadius: 2,
    },
    legendText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });

