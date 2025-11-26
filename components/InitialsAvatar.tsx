import { View, Text, StyleSheet } from 'react-native';
import Tier1Icon from '@/assets/kyc/1.svg';
import Tier2Icon from '@/assets/kyc/2.svg';
import Tier3Icon from '@/assets/kyc/3.svg';
import { useTheme } from '@/contexts/ThemeContext';

type InitialsAvatarProps = {
  firstName: string;
  lastName: string;
  size?: number;
  fontSize?: number;
  kycTier?: number; // 0, 1, 2, or 3
};

export default function InitialsAvatar({ firstName, lastName, size = 120, fontSize = 40, kycTier }: InitialsAvatarProps) {
  const { isDark } = useTheme();
  const getInitials = () => {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${firstInitial}${lastInitial}`;
  };

  // Generate a consistent color based on the name
  const getColor = (name: string) => {
    const colors = [
      '#1E3A8A', // Blue
      '#065F46', // Green
      '#7C2D12', // Orange
      '#581C87', // Purple
      '#831843', // Pink
      '#1E40AF', // Light Blue
      '#3730A3', // Indigo
      '#1F2937', // Gray
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const backgroundColor = getColor(`${firstName} ${lastName}`);
  const initials = getInitials();

  // Calculate badge dimensions and position
  const badgeContainerSize = Math.max(24, size * 0.375); // Slightly smaller for better fit
  const badgeIconSize = Math.max(18, size * 0.29); // Icon size within container
  const badgeOffset = Math.max(-10, -(badgeContainerSize * 0.25)); // Negative offset to show outside bounds

  // Get tier badge icon
  const getTierBadge = () => {
    if (!kycTier || kycTier === 0) return null;
    
    switch (kycTier) {
      case 1:
        return <Tier1Icon width={badgeIconSize} height={badgeIconSize} />;
      case 2:
        return <Tier2Icon width={badgeIconSize} height={badgeIconSize} />;
      case 3:
        return <Tier3Icon width={badgeIconSize} height={badgeIconSize} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        }
      ]}>
        <Text style={[
          styles.text,
          { fontSize }
        ]}>
          {initials}
        </Text>
      </View>
      {kycTier && kycTier > 0 && (
        <View style={[
          styles.badgeContainer,
          {
            width: badgeContainerSize,
            height: badgeContainerSize,
            borderRadius: badgeContainerSize / 2,
            borderWidth: Math.max(2, size * 0.04),
            backgroundColor: isDark ? '#0E141F' : '#fff',
            borderColor: isDark ? '#0E141F' : '#fff',
            bottom: badgeOffset,
            right: badgeOffset,
          }
        ]}>
          {getTierBadge()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  badgeContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});