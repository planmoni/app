import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = Math.min(SCREEN_WIDTH - 80, 280);
const CENTER = CHART_SIZE / 2;
const RADIUS = (CHART_SIZE - 40) / 2;
const INNER_RADIUS = RADIUS * 0.6;

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  total: number;
}

export default function PieChart({ data, total }: PieChartProps) {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const calculateAngle = (value: number) => {
    return (value / total) * 360;
  };

  let currentAngle = 0;

  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
        <G>
          {data.map((item, index) => {
            const angle = calculateAngle(item.value);
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            return (
              <Circle
                key={index}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={item.color}
                strokeWidth={RADIUS - INNER_RADIUS}
                strokeDasharray={`${(angle / 360) * 2 * Math.PI * RADIUS} ${2 * Math.PI * RADIUS}`}
                strokeDashoffset={-(startAngle / 360) * 2 * Math.PI * RADIUS}
                transform={`rotate(${startAngle - 90} ${CENTER} ${CENTER})`}
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <View style={styles.legendText}>
              <View style={styles.legendLabelRow}>
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendValue}>
                  ₦{item.value.toLocaleString()}
                </Text>
              </View>
              <View style={styles.legendBar}>
                <View
                  style={[
                    styles.legendBarFill,
                    {
                      width: `${(item.value / total) * 100}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  legend: {
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    flex: 1,
  },
  legendLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendLabel: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
  },
  legendValue: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  legendBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  legendBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
