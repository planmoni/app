import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';

export default function LastNameScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const lastNameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      lastNameInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsButtonEnabled(lastName.trim().length > 0);
  }, [lastName]);

  const handleContinue = () => {
    if (!lastName.trim()) {
      setError('Please enter your last name');
      return;
    }
    
    router.push({
      pathname: '/onboarding/email',
      params: { 
        firstName,
        lastName: lastName.trim()
      }
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <OnboardingProgress currentStep={2} totalSteps={8} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome, {firstName}</Text>
          <Text style={styles.subtitle}>Let's continue setting up your account</Text>

          <View style={styles.formContainer}>
            <Text style={styles.question}>What's your last name?</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <User size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={lastNameInputRef}
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor={colors.textTertiary}
                value={lastName}
                onChangeText={(text) => {
                  setLastName(text);
                  setError(null);
                }}
                autoCapitalize="words"
                textContentType="familyName"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={!isButtonEnabled}
        icon={ArrowRight}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 60,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: '100%',
  },
});