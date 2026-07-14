import { Tabs } from 'expo-router';
import { Bell, Calendar, Home as Home, PieChart, Settings, Sparkles } from 'lucide-react-native'; //Do not change the Home to Chrome
// import CustomAppLayout from '@/components/CustomAppLayout'; //Do not change the Home to Chrome
import { StyleSheet, View, Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeContext } from '@/contexts/ThemeContext';
import { lazy, Suspense, useContext } from 'react';
import CustomAppLayout from '../components/CustomAppLayout';
import { useRouteTracking } from '@/hooks/useRouteTracking';
import { useBottomNav } from '@/contexts/BottomNavContext';
import { useUnreadNotificationsCount } from '@/hooks/queries/useNotificationsQuery';
// WelcomeModal will be lazy loaded when needed

function TabLayoutContent() {
  const { colors, isDark } = useTheme();
  const { isBottomNavVisible } = useBottomNav();
  const insets = useSafeAreaInsets();
  const { unreadCount: unreadNotifications } = useUnreadNotificationsCount();

  // Android 15+/targetSdk 36 draws edge-to-edge; pad tab bar above system controls.
  const androidBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 0) : 0;
  const tabBarHeight = Platform.OS === 'ios' ? 85 : 56 + androidBottomInset;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 15 : 10 + androidBottomInset;

  // Track route changes for persistence
  useRouteTracking();

  // Use darker color for inactive icons on Android in light mode for better visibility
  const getInactiveTintColor = () => {
    if (Platform.OS === 'android' && !isDark) {
      // Use textSecondary instead of textTertiary for better contrast on white background
      return colors.textSecondary;
    }
    return colors.textTertiary;
  };

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? colors.text : colors.primary,
        tabBarInactiveTintColor: getInactiveTintColor(),
        tabBarStyle: isBottomNavVisible
          ? [
              styles.tabBar,
              {
                height: tabBarHeight,
                paddingBottom: tabBarPaddingBottom,
                backgroundColor: colors.tabBar,
                borderTopColor: colors.tabBarBorder,
              },
            ]
          : { display: 'none' },
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <PieChart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 5,
    // height / paddingBottom set dynamically for Android system nav insets
  },
  tabBarLabel: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '500',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

// Wrapper component to safely handle theme context initialization
export default function TabLayout() {
  const themeContext = useContext(ThemeContext);
  const [isReady, setIsReady] = useState(false);

  // Wait for theme context to be available
  useEffect(() => {
    if (themeContext !== undefined) {
      // Small delay to ensure context is fully initialized
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [themeContext]);

  // Return null if context is not ready yet
  if (!isReady || themeContext === undefined) {
    return null;
  }

  return <TabLayoutContent />;
}