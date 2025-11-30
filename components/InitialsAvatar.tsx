import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Tier1Icon from '@/assets/kyc/1.svg';
import Tier2Icon from '@/assets/kyc/2.svg';
import Tier3Icon from '@/assets/kyc/3.svg';
import { useTheme } from '@/contexts/ThemeContext';

type InitialsAvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  fontSize?: number;
  kycTier?: number; // 0, 1, 2, or 3
};

const InitialsAvatar: React.FC<InitialsAvatarProps> = React.memo((props) => {
  const { 
    firstName, 
    lastName, 
    size, 
    fontSize, 
    kycTier 
  } = props;
  
  const { isDark } = useTheme();
  
  // Ensure size and fontSize are valid numbers with explicit defaults
  const safeSize = React.useMemo(() => {
    const value = size ?? 120;
    return typeof value === 'number' && !isNaN(value) && value > 0 ? value : 120;
  }, [size]);
  
  const safeFontSize = React.useMemo(() => {
    const value = fontSize ?? 40;
    return typeof value === 'number' && !isNaN(value) && value > 0 ? value : 40;
  }, [fontSize]);
  
  // Ensure kycTier is a valid number (0, 1, 2, or 3)
  const safeKycTier = React.useMemo(() => {
    if (typeof kycTier !== 'number' || isNaN(kycTier)) return undefined;
    return Math.max(0, Math.min(3, Math.floor(kycTier)));
  }, [kycTier]);
  
  // Ensure firstName and lastName are always strings, handling all edge cases
  // Safely convert to string, handling null, undefined, numbers, and other primitives
  const safeFirstName = React.useMemo(() => {
    if (firstName == null) return '';
    if (typeof firstName === 'string') return firstName.trim();
    if (typeof firstName === 'number' || typeof firstName === 'boolean') return String(firstName).trim();
    return '';
  }, [firstName]);
  
  const safeLastName = React.useMemo(() => {
    if (lastName == null) return '';
    if (typeof lastName === 'string') return lastName.trim();
    if (typeof lastName === 'number' || typeof lastName === 'boolean') return String(lastName).trim();
    return '';
  }, [lastName]);
  
  const displayInitials = React.useMemo(() => {
    const firstInitial = safeFirstName.length > 0 ? safeFirstName.charAt(0).toUpperCase() : '';
    const lastInitial = safeLastName.length > 0 ? safeLastName.charAt(0).toUpperCase() : '';
    const initials = `${firstInitial}${lastInitial}`;
    // Return at least one character to avoid empty string rendering issues
    const result = initials.length > 0 ? initials : '?';
    // Explicitly ensure it's a string and never empty
    return String(result || '?');
  }, [safeFirstName, safeLastName]);

  // Generate a consistent color based on the name
  const backgroundColor = React.useMemo(() => {
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
    
    const name = `${safeFirstName} ${safeLastName}`.trim();
    // Handle empty string case
    if (!name || name.trim().length === 0) {
      return colors[0]; // Default to first color
    }
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }, [safeFirstName, safeLastName]);

  // Calculate badge dimensions and position
  const badgeContainerSize = React.useMemo(() => Math.max(24, safeSize * 0.375), [safeSize]);
  const badgeIconSize = React.useMemo(() => Math.max(18, safeSize * 0.29), [safeSize]);
  const badgeOffset = React.useMemo(() => Math.max(-10, -(badgeContainerSize * 0.25)), [badgeContainerSize]);

  // Get tier badge icon - memoized to prevent re-renders
  const tierBadge = React.useMemo(() => {
    if (!safeKycTier || safeKycTier === 0) return null;
    
    switch (safeKycTier) {
      case 1:
        return <Tier1Icon width={badgeIconSize} height={badgeIconSize} />;
      case 2:
        return <Tier2Icon width={badgeIconSize} height={badgeIconSize} />;
      case 3:
        return <Tier3Icon width={badgeIconSize} height={badgeIconSize} />;
      default:
        return null;
    }
  }, [safeKycTier, badgeIconSize]);

  // Ensure displayInitials is always a valid non-empty string
  const textContent = React.useMemo(() => {
    const text = String(displayInitials || '?');
    return text.length > 0 ? text : '?';
  }, [displayInitials]);

  // Render text content - explicitly ensure it's always a valid React element
  const renderText = React.useMemo(() => {
    // Ensure textContent is always a valid string
    const safeText = typeof textContent === 'string' ? textContent : '?';
    return (
      <Text style={[
        styles.text,
        { fontSize: safeFontSize }
      ]}>
        {safeText}
      </Text>
    );
  }, [textContent, safeFontSize]);

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.container,
        {
          width: safeSize,
          height: safeSize,
          borderRadius: safeSize / 2,
          backgroundColor,
        }
      ]}>
        {renderText}
      </View>
      {safeKycTier !== undefined && safeKycTier > 0 && tierBadge && (
        <View style={[
          styles.badgeContainer,
          {
            width: badgeContainerSize,
            height: badgeContainerSize,
            borderRadius: badgeContainerSize / 2,
            borderWidth: Math.max(2, safeSize * 0.04),
            backgroundColor: isDark ? '#0E141F' : '#fff',
            borderColor: isDark ? '#0E141F' : '#fff',
            bottom: badgeOffset,
            right: badgeOffset,
          }
        ]}>
          {tierBadge}
        </View>
      )}
    </View>
  );
});

InitialsAvatar.displayName = 'InitialsAvatar';

export default InitialsAvatar;

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