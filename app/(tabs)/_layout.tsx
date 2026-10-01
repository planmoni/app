import { Tabs } from 'expo-router';
import { Calendar, Home as Home, PieChart, Settings, Sparkles } from 'lucide-react-native'; //Do not change the Home to Chrome
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeContext } from '@/contexts/ThemeContext';
import { useContext } from 'react';
import { useRouteTracking } from '@/hooks/useRouteTracking';
import { useBottomNav } from '@/contexts/BottomNavContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const inactiveColor = isDark ? '#93C5FD' : colors.primary;
  const bottom = Math.max(insets.bottom, 12);
  const blurHeight = bottom + 64 + 16;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <MaskedView
        pointerEvents="none"
        style={[styles.blurStrip, { height: blurHeight }]}
        maskElement={
          <LinearGradient
            colors={['transparent', 'black', 'black']}
            locations={[0, 0.28, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView
          intensity={isDark ? 50 : 40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
      <View
        style={[
          styles.bar,
          {
            bottom,
            backgroundColor: isDark ? '#040C19' : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={focused ? [styles.activeItem, { backgroundColor: colors.primary }] : styles.inactiveItem}
            >
              {options.tabBarIcon?.({ focused, color: focused ? '#FFFFFF' : inactiveColor, size: 22 })}
              {focused ? (
                <Text style={styles.activeLabel} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabLayoutContent() {
  const { isBottomNavVisible } = useBottomNav();

  useRouteTracking();

  return (
    <Tabs
      tabBar={(props) => (isBottomNavVisible ? <FloatingTabBar {...props} /> : null)}
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
        sceneStyle: {
          backgroundColor: 'transparent',
        },
        tabBarShowLabel: false,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'AI',
          tabBarIcon: ({ color }) => <Sparkles size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <PieChart size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blurStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 10,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  activeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    flexShrink: 0,
  },
  inactiveItem: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default function TabLayout() {
  const themeContext = useContext(ThemeContext);

  if (themeContext === undefined) {
    return null;
  }

  return <TabLayoutContent />;
}
