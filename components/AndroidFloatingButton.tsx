import FloatingButton from '@/components/FloatingButton';

type AndroidFloatingButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'outline';
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'none';
  tabBarHeight?: number;
  keyboardGap?: number;
};

/**
 * Thin Android wrapper — delegates to FloatingButton so keyboard tracking
 * stays in one place.
 */
export default function AndroidFloatingButton(props: AndroidFloatingButtonProps) {
  return <FloatingButton {...props} />;
}
