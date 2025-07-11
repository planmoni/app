import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bank } from '@/hooks/useBanks';
import { BankSelectionModal } from './BankSelectionModal';

interface BankSelectorProps {
  selectedBank: Bank | null;
  onSelectBank: (bank: Bank) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

// Fallback logo for banks without logos
const getFallbackLogo = (bankName: string): string => {
  return `https://via.placeholder.com/32x32/00A651/FFFFFF?text=${bankName.substring(0, 2).toUpperCase()}`;
};

export const BankSelector: React.FC<BankSelectorProps> = ({
  selectedBank,
  onSelectBank,
  placeholder = 'Select a bank',
  disabled = false,
  error,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handlePress = () => {
    if (!disabled) {
      setIsModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.selector,
          disabled && styles.disabled,
          error && styles.error,
        ]}
        onPress={handlePress}
        disabled={disabled}
      >
        {selectedBank ? (
          <View style={styles.selectedBankContainer}>
            {selectedBank.logo ? (
              <Image
                source={selectedBank.logo as any}
                style={styles.bankLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.bankIconContainer}>
                <Ionicons name="business" size={18} color="#666" />
              </View>
            )}
            <View style={styles.bankInfo}>
              <Text style={styles.bankName}>{selectedBank.name}</Text>
              <Text style={styles.bankCode}>Code: {selectedBank.code}</Text>
              {selectedBank.category && (
                <Text style={styles.bankCategory}>
                  {selectedBank.category === 'microfinance' ? 'Microfinance' : 'Commercial'}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? '#999' : '#666'}
        />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <BankSelectionModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelectBank={onSelectBank}
        selectedBank={selectedBank}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    minHeight: 56,
  },
  disabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  error: {
    borderColor: '#FF3B30',
  },
  selectedBankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
  },
  bankIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  bankCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  bankCategory: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
}); 