import { View, Text, StyleSheet, Pressable, TextInput, ScrollView , Platform } from 'react-native';
import { ArrowLeft, Eye, EyeOff, Shield } from 'lucide-react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useHaptics } from '@/hooks/useHaptics';

export default function ChangePasswordScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const haptics = useHaptics();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      if (!currentPassword) errors.currentPassword = 'Current password is required';
      if (!newPassword) errors.newPassword = 'New password is required';
      if (!confirmPassword) errors.confirmPassword = 'Please confirm your new password';
    }
    
    if (newPassword && newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    }
    
    if (newPassword && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      errors.newPassword = 'Password must contain uppercase, lowercase, and number';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'New passwords do not match';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      const firstError = Object.values(fieldErrors)[0];
      showToast(firstError, 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }

      // First, verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session?.user?.email || '',
        password: currentPassword
      });

      if (signInError) {
        if (Platform.OS !== 'web') {
          haptics.error();
        }
        setFieldErrors({ currentPassword: 'Current password is incorrect' });
        showToast('Current password is incorrect', 'error');
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      if (Platform.OS !== 'web') {
        haptics.success();
      }
      showToast('Password changed successfully', 'success');
      router.back();
    } catch (err) {
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    // Clear field-specific errors when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Clear general error
    if (error) {
      setError(null);
    }
    
    // Update the field value
    switch (field) {
      case 'currentPassword':
        setCurrentPassword(value);
        break;
      case 'newPassword':
        setNewPassword(value);
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
        break;
    }
  };

  const getPasswordStrength = () => {
    if (newPassword.length === 0) return { strength: 0, label: '' };
    if (newPassword.length < 6) return { strength: 1, label: 'Weak' };
    if (newPassword.length < 8) return { strength: 2, label: 'Fair' };
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) return { strength: 2, label: 'Fair' };
    return { strength: 3, label: 'Strong' };
  };

  const passwordStrength = getPasswordStrength();

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Change Password</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Choose a strong password that you haven't used before
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password</Text>
            <View style={[
              styles.inputContainer,
              currentPassword.trim() !== '' && styles.inputContainerFilled,
              fieldErrors.currentPassword && styles.inputError
            ]}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={(text) => handleFieldChange('currentPassword', text)}
                placeholder="Enter current password"
                placeholderTextColor={colors.textTertiary}
                editable={!isLoading}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
            {fieldErrors.currentPassword && (
              <Text style={styles.fieldError}>{fieldErrors.currentPassword}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={[
              styles.inputContainer,
              newPassword.trim() !== '' && styles.inputContainerFilled,
              fieldErrors.newPassword && styles.inputError
            ]}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={(text) => handleFieldChange('newPassword', text)}
                placeholder="Enter new password"
                placeholderTextColor={colors.textTertiary}
                editable={!isLoading}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
            
            {newPassword.length > 0 && (
              <View style={styles.passwordStrength}>
                <View style={styles.strengthBar}>
                  <View 
                    style={[
                      styles.strengthFill,
                      { 
                        width: `${(passwordStrength.strength / 3) * 100}%`,
                        backgroundColor: passwordStrength.strength === 1 ? colors.error : 
                                       passwordStrength.strength === 2 ? colors.warning : colors.success
                      }
                    ]} 
                  />
                </View>
                <Text style={[
                  styles.strengthLabel,
                  { 
                    color: passwordStrength.strength === 1 ? colors.error : 
                           passwordStrength.strength === 2 ? colors.warning : colors.success
                  }
                ]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}
            
            {fieldErrors.newPassword && (
              <Text style={styles.fieldError}>{fieldErrors.newPassword}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={[
              styles.inputContainer,
              confirmPassword.trim() !== '' && styles.inputContainerFilled,
              fieldErrors.confirmPassword && styles.inputError
            ]}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => handleFieldChange('confirmPassword', text)}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textTertiary}
                editable={!isLoading}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
            {fieldErrors.confirmPassword && (
              <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
            )}
          </View>

          <View style={styles.requirements}>
            <View style={styles.requirementsHeader}>
              <View style={styles.requirementsIconContainer}>
                <Shield size={20} color="#1E3A8A" />
              </View>
              <Text style={styles.requirementsTitle}>Password Requirements</Text>
            </View>
            <View style={styles.requirementsList}>
              <Text style={[
                styles.requirementItem,
                newPassword.length >= 8 && styles.requirementMet
              ]}>• At least 8 characters long</Text>
              <Text style={[
                styles.requirementItem,
                /[A-Z]/.test(newPassword) && styles.requirementMet
              ]}>• Contains at least one uppercase letter</Text>
              <Text style={[
                styles.requirementItem,
                /[a-z]/.test(newPassword) && styles.requirementMet
              ]}>• Contains at least one lowercase letter</Text>
              <Text style={[
                styles.requirementItem,
                /\d/.test(newPassword) && styles.requirementMet
              ]}>• Contains at least one number</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isLoading ? "Changing Password..." : "Change Password"}
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={isLoading}
          isLoading={isLoading}
        />
      </View>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 100,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  inputContainerFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBackground || colors.background,
  },
  inputError: {
    borderColor: colors.error || '#DC2626',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    padding: 12,
  },
  fieldError: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  requirements: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
    padding: 16,
    borderRadius: 8,
  },
  requirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requirementsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  requirementsList: {
    gap: 4,
  },
  requirementItem: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  requirementMet: {
    color: colors.success,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitButton: {
    backgroundColor: '#1E3A8A',
  },
});