import { View, Text, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

export default function WelcomeScreen() {
  const { colors, isDark } = useTheme();

  const handleGetStarted = () => {
    router.push('/onboarding/first-name');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Image
          source={isDark 
            ? require('@/assets/images/PlanmoniDarkMode.png')
            : require('@/assets/images/Planmoni.png')
          }
          style={styles.logo}
          resizeMode="contain"
        />
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome, let's setup your account</Text>
          <Text style={styles.subtitle}>It takes just a minute</Text>
        </View>
        
        <Image 
          source={require('@/assets/images/SmartSavings.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      <View style={styles.footer}>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 40,
  },
  textContainer: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  illustration: {
    width: '100%',
    height: 240,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: colors.primary,
  },
});