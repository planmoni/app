import { View, Text, StyleSheet } from 'react-native';

type InitialsAvatarProps = {
  firstName: string;
  lastName: string;
  size?: number;
  fontSize?: number;
};

export default function InitialsAvatar({ firstName, lastName, size = 120, fontSize = 40 }: InitialsAvatarProps) {
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

  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});