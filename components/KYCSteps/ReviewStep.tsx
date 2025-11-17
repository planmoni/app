import React from 'react';
import { View, Text } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';
import { IdentityType } from './types';

interface ReviewStepProps {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  phoneNumber: string;
  addressNo: string;
  address: string;
  lga: string;
  state: string;
  bvn: string;
  bvnVerified: boolean;
  selectedIdentityType: IdentityType;
  nin: string;
  passportNumber: string;
  documentsVerified: boolean;
  houseUrl: string | null;
  utilityBill: string | null;
}

export default function ReviewStep({
  firstName,
  lastName,
  middleName,
  dateOfBirth,
  phoneNumber,
  addressNo,
  address,
  lga,
  state,
  bvn,
  bvnVerified,
  selectedIdentityType,
  nin,
  passportNumber,
  documentsVerified,
  houseUrl,
  utilityBill,
}: ReviewStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Review Your Information</Text>
      <Text style={styles.sectionDescription}>
        Please review your information before submitting.
      </Text>
      
      <View style={styles.reviewSection}>
        <View style={styles.reviewCard}>
          <Text style={styles.reviewSectionTitle}>Personal Information</Text>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Full Name</Text>
            <Text style={styles.reviewValue}>
              {firstName} {middleName ? `${middleName} ` : ''}{lastName}
            </Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Date of Birth</Text>
            <Text style={styles.reviewValue}>{dateOfBirth || 'Not provided'}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Phone Number</Text>
            <Text style={styles.reviewValue}>{phoneNumber || 'Not provided'}</Text>
          </View>
        </View>
        
        <View style={styles.reviewCard}>
          <Text style={styles.reviewSectionTitle}>Identity Verification</Text>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>BVN</Text>
            <Text style={styles.reviewValue}>
              •••• •••• {bvn.slice(-3)} {bvnVerified && <Check size={16} color={colors.success} />}
            </Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>ID Type</Text>
            <Text style={styles.reviewValue}>
              {selectedIdentityType === 'nin' ? 'National ID (NIN)' :
               selectedIdentityType === 'passport' ? 'International Passport' :
               'Driver\'s License'}
            </Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>
              {selectedIdentityType === 'nin' ? 'NIN' :
               selectedIdentityType === 'passport' ? 'Passport Number' :
               'License Number'}
            </Text>
            <Text style={styles.reviewValue}>
              {selectedIdentityType === 'nin' ? nin :
               selectedIdentityType === 'passport' ? passportNumber :
               'Not provided'}
            </Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Document Verification</Text>
            <Text style={[
              styles.reviewValue,
              documentsVerified ? styles.verifiedText : styles.pendingText
            ]}>
              {documentsVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>
        
        <View style={styles.reviewCard}>
          <Text style={styles.reviewSectionTitle}>Address Information</Text>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>House/Street Number</Text>
            <Text style={styles.reviewValue}>{addressNo || 'Not provided'}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Residential Address</Text>
            <Text style={styles.reviewValue}>{address}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>LGA</Text>
            <Text style={styles.reviewValue}>{lga}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>State</Text>
            <Text style={styles.reviewValue}>{state}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>House Photo</Text>
            <Text style={styles.reviewValue}>
              {houseUrl ? 'Uploaded' : 'Not provided'}
            </Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Utility Bill</Text>
            <Text style={styles.reviewValue}>
              {utilityBill ? 'Uploaded' : 'Not provided (Optional for Tier 3)'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.termsContainer}>
        <Text style={styles.termsText}>
          By submitting this information, I confirm that all details provided are accurate and complete. I authorize Planmoni to verify my identity using the information provided.
        </Text>
      </View>
    </View>
  );
}

