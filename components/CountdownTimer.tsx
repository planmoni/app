import { View, Text, StyleSheet } from 'react-native';
import { useCountdown } from '@/hooks/useCountdown';
import { useTheme } from '@/contexts/ThemeContext';
import { Clock } from 'lucide-react-native';

type CountdownTimerProps = {
  targetDate: Date | string | null;
  showSeconds?: boolean;
  style?: any;
  textStyle?: any;
  iconSize?: number;
};

export default function CountdownTimer({
  targetDate,
  showSeconds = false,
  style,
  textStyle,
  iconSize = 16
}: CountdownTimerProps) {
  const { colors, isDark } = useTheme();
  const { days, hours, minutes, seconds, totalSeconds } = useCountdown(targetDate);
  
  // Format the countdown text
  const getCountdownText = () => {
    if (totalSeconds <= 0) {
      return 'Time expired';
    }
    
    let text = '';
    
    if (days > 0) {
      text += `${days} day${days !== 1 ? 's' : ''}`;
      
      if (hours > 0 || minutes > 0 || (showSeconds && seconds > 0)) {
        text += ', ';
      }
    }
    
    if (hours > 0) {
      text += `${hours} hour${hours !== 1 ? 's' : ''}`;
      
      if (minutes > 0 || (showSeconds && seconds > 0)) {
        text += ', ';
      }
    }
    
    if (minutes > 0) {
      text += `${minutes} min${minutes !== 1 ? 's' : ''}`;
      
      if (showSeconds && seconds > 0) {
        text += ', ';
      }
    }
    
    if (showSeconds && seconds > 0) {
      text += `${seconds} sec${seconds !== 1 ? 's' : ''}`;
    }
    
    if (days === 0 && hours === 0 && minutes === 0 && !showSeconds) {
      text = 'Less than a minute';
    }
    
    return text + ' left';
  };
  
  const styles = createStyles(colors, isDark);
  
  return (
    <View style={[styles.container, style]}>
      <Clock size={iconSize} color={colors.primary} />
      <Text style={[styles.countdownText, textStyle]}>
        {getCountdownText()}
      </Text>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  countdownText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});