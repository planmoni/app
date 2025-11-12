import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Calendar, ChevronRight, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';
import { KYCStepProps } from './types';

interface PersonalInfoStepProps extends Partial<KYCStepProps> {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
  addressNo: string;
  errors: Record<string, string>;
  onFirstNameChange: (text: string) => void;
  onLastNameChange: (text: string) => void;
  onMiddleNameChange: (text: string) => void;
  onDateOfBirthChange: (text: string) => void;
  onPhoneNumberChange: (text: string) => void;
  onAddressChange: (text: string) => void;
  onAddressNoChange: (text: string) => void;
  onDatePickerOpen: () => void;
  onLocationSearchOpen: () => void;
  lastNameInputRef?: React.RefObject<TextInput | null>;
  middleNameInputRef?: React.RefObject<TextInput | null>;
  phoneInputRef?: React.RefObject<TextInput | null>;
  addressInputRef?: React.RefObject<TextInput | null>;
  isNinVerified?: boolean;
}

export default function PersonalInfoStep({
  firstName,
  lastName,
  middleName,
  dateOfBirth,
  phoneNumber,
  address,
  addressNo,
  errors,
  onFirstNameChange,
  onLastNameChange,
  onMiddleNameChange,
  onDateOfBirthChange,
  onPhoneNumberChange,
  onAddressChange,
  onAddressNoChange,
  onDatePickerOpen,
  onLocationSearchOpen,
  lastNameInputRef,
  middleNameInputRef,
  phoneInputRef,
  addressInputRef,
  isNinVerified = false,
}: PersonalInfoStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Basic Information</Text>
      <Text style={styles.sectionDescription}>
        Please provide your personal details as they appear on your official documents.
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>First Name</Text>
        <View style={[styles.inputContainer, errors.firstName && styles.inputError, isNinVerified && { opacity: 0.6 }]}>
          <TextInput
            style={styles.input}
            placeholder="Enter your first name"
            placeholderTextColor={colors.textTertiary}
            value={firstName}
            onChangeText={(text) => {
              onFirstNameChange(text);
            }}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => lastNameInputRef?.current?.focus()}
            editable={!isNinVerified}
          />
        </View>
        {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        {isNinVerified && (
          <Text style={[styles.infoText, { fontSize: 12, marginTop: 4 }]}>
            Name fields are locked after NIN verification
          </Text>
        )}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Last Name</Text>
        <View style={[styles.inputContainer, errors.lastName && styles.inputError, isNinVerified && { opacity: 0.6 }]}>
          <TextInput
            ref={lastNameInputRef}
            style={styles.input}
            placeholder="Enter your last name"
            placeholderTextColor={colors.textTertiary}
            value={lastName}
            onChangeText={(text) => {
              onLastNameChange(text);
            }}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => middleNameInputRef?.current?.focus()}
            editable={!isNinVerified}
          />
        </View>
        {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Middle Name (Optional)</Text>
        <View style={[styles.inputContainer, isNinVerified && { opacity: 0.6 }]}>
          <TextInput
            ref={middleNameInputRef}
            style={styles.input}
            placeholder="Enter your middle name"
            placeholderTextColor={colors.textTertiary}
            value={middleName}
            onChangeText={onMiddleNameChange}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => phoneInputRef?.current?.focus()}
            editable={!isNinVerified}
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date of Birth</Text>
        <Pressable 
          style={[styles.inputContainer, errors.dateOfBirth && styles.inputError]}
          onPress={onDatePickerOpen}
        >
          <View style={styles.dateInputContent}>
            <Calendar size={20} color={colors.textSecondary} />
            <Text style={[
              styles.dateInputText,
              !dateOfBirth && styles.dateInputPlaceholder
            ]}>
              {dateOfBirth || 'DD/MM/YYYY'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </Pressable>
        {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
          <TextInput
            ref={phoneInputRef}
            style={styles.input}
            placeholder="090XXXXXXXX"
            placeholderTextColor={colors.textTertiary}
            value={phoneNumber}
            onChangeText={(text) => {
              onPhoneNumberChange(text);
            }}
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => addressInputRef?.current?.focus()}
          />
        </View>
        {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>House/Street Number</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter house/street number"
            placeholderTextColor={colors.textTertiary}
            value={addressNo}
            onChangeText={(text) => {
              onAddressNoChange(text);
            }}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Residential Address</Text>
        <Pressable 
          style={[styles.inputContainer, errors.address && styles.inputError]}
          onPress={onLocationSearchOpen}
        >
          <TextInput
            ref={addressInputRef}
            style={[styles.input, styles.multilineInput]}
            placeholder="Tap to search for your address"
            placeholderTextColor={colors.textTertiary}
            value={address}
            onChangeText={(text) => {
              onAddressChange(text);
            }}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={false}
            onPress={onLocationSearchOpen}
          />
          <ChevronRight size={20} color={colors.textTertiary} />
        </Pressable>
        {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        {address && (
          <Text style={styles.locationInfo}>
            📍 Location selected from map
          </Text>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Info size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Your personal information is securely stored and will only be used for verification purposes.
        </Text>
      </View>
    </View>
  );
}

