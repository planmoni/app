import React from 'react';
import { View, Text, TextInput, Image, Pressable } from 'react-native';
import { MapPin, Camera, Upload, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';

interface AddressDetailsStepProps {
  addressNo: string;
  address: string;
  lga: string;
  state: string;
  houseUrl: string | null;
  utilityBill: string | null;
  errors: Record<string, string>;
  onAddressNoChange: (text: string) => void;
  onAddressChange: (text: string) => void;
  onLgaChange: (text: string) => void;
  onStateChange: (text: string) => void;
  onHouseUrlChange: (uri: string | null) => void;
  onUtilityBillChange: (uri: string | null) => void;
  onLocationSearchOpen: () => void;
  onPickImage: (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => Promise<void>;
  onTakePicture: (type: 'front' | 'back' | 'house' | 'utility') => Promise<void>;
  addressInputRef?: React.RefObject<TextInput | null>;
}

export default function AddressDetailsStep({
  addressNo,
  address,
  lga,
  state,
  houseUrl,
  utilityBill,
  errors,
  onAddressNoChange,
  onAddressChange,
  onLgaChange,
  onStateChange,
  onHouseUrlChange,
  onUtilityBillChange,
  onLocationSearchOpen,
  onPickImage,
  onTakePicture,
  addressInputRef,
}: AddressDetailsStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Address Details</Text>
      <Text style={styles.sectionDescription}>
        Please confirm your residential address and provide additional details.
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>House/Street Number</Text>
        <View style={styles.inputContainer}>
          <MapPin size={20} color={colors.textSecondary} />
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
          <MapPin size={20} color={colors.textSecondary} />
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
          />
        </Pressable>
        {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        {address && (
          <Text style={styles.locationInfo}>
            📍 Location selected from map
          </Text>
        )}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Local Government Area (LGA)</Text>
        <View style={[styles.inputContainer, errors.lga && styles.inputError]}>
          <MapPin size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Enter your LGA"
            placeholderTextColor={colors.textTertiary}
            value={lga}
            onChangeText={(text) => {
              onLgaChange(text);
            }}
          />
        </View>
        {errors.lga && <Text style={styles.errorText}>{errors.lga}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>State</Text>
        <View style={[styles.inputContainer, errors.state && styles.inputError]}>
          <MapPin size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Enter your state"
            placeholderTextColor={colors.textTertiary}
            value={state}
            onChangeText={(text) => {
              onStateChange(text);
            }}
          />
        </View>
        {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
      </View>
      
      <View style={styles.documentCard}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentName}>House Photo (Required)</Text>
          <View style={[styles.documentStatus, styles.requiredStatus]}>
            <Text style={styles.requiredStatusText}>Required</Text>
          </View>
        </View>
        <Text style={styles.documentDescription}>
          Take a photo of your house/building for address verification.
        </Text>
        {houseUrl ? (
          <View style={styles.imagePreviewContainer}>
            <Image 
              source={{ uri: houseUrl }} 
              style={styles.imagePreview} 
              resizeMode="cover"
            />
            <Pressable 
              style={styles.retakeButton}
              onPress={() => onHouseUrlChange(null)}
            >
              <Text style={styles.retakeButtonText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.documentActions}>
            <Pressable 
              style={styles.documentButton}
              onPress={() => onTakePicture('house')}
            >
              <Camera size={16} color={colors.primary} />
              <Text style={styles.documentButtonText}>Take Photo</Text>
            </Pressable>
          </View>
        )}
        {errors.houseUrl && <Text style={styles.errorText}>{errors.houseUrl}</Text>}
      </View>
      
      <View style={styles.documentCard}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentName}>Utility Bill (Optional for Tier 3)</Text>
          <View style={[styles.documentStatus, styles.optionalStatus]}>
            <Text style={styles.optionalStatusText}>Optional</Text>
          </View>
        </View>
        <Text style={styles.documentDescription}>
          Upload a recent utility bill (electricity, water, etc.) for Tier 3 verification.
        </Text>
        
        {utilityBill ? (
          <View style={styles.imagePreviewContainer}>
            <Image 
              source={{ uri: utilityBill }} 
              style={styles.imagePreview} 
              resizeMode="cover"
            />
            <Pressable 
              style={styles.retakeButton}
              onPress={() => onUtilityBillChange(null)}
            >
              <Text style={styles.retakeButtonText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.documentActions}>
            <Pressable 
              style={styles.documentButton}
              onPress={() => onPickImage(onUtilityBillChange, 'utilityBill')}
            >
              <Upload size={16} color={colors.primary} />
              <Text style={styles.documentButtonText}>Upload</Text>
            </Pressable>
            
            <Pressable 
              style={styles.documentButton}
              onPress={() => onTakePicture('utility')}
            >
              <Camera size={16} color={colors.primary} />
              <Text style={styles.documentButtonText}>Take Photo</Text>
            </Pressable>
          </View>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Info size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Your address information is used for verification purposes and to determine your transaction limits.
        </Text>
      </View>
    </View>
  );
}

