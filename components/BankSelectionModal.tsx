import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBanks, Bank } from '@/hooks/useBanks';

interface BankSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBank: (bank: Bank) => void;
  selectedBank?: Bank | null;
}

const { width } = Dimensions.get('window');

// Fallback logo for banks without logos
const getFallbackLogo = (bankName: string): string => {
  return `https://via.placeholder.com/40x40/00A651/FFFFFF?text=${bankName.substring(0, 2).toUpperCase()}`;
};

const BankItem: React.FC<{
  bank: Bank;
  onSelect: (bank: Bank) => void;
  isSelected: boolean;
}> = ({ bank, onSelect, isSelected }) => {

  
  return (
    <TouchableOpacity
      style={[styles.bankItem, isSelected && styles.selectedBankItem]}
      onPress={() => onSelect(bank)}
    >
      <View style={styles.bankInfo}>
        {bank.logo ? (
          <Image
            source={bank.logo as any}
            style={styles.bankLogo}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.bankIconContainer}>
            <Ionicons name="business" size={24} color="#666" />
          </View>
        )}
        <View style={styles.bankDetails}>
          <Text style={styles.bankName}>{bank.name}</Text>
          <Text style={styles.bankCode}>Code: {bank.code}</Text>
          {bank.category && (
            <Text style={styles.bankCategory}>
              {bank.category === 'microfinance' ? 'Microfinance Bank' : 'Commercial Bank'}
            </Text>
          )}
        </View>
      </View>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={24} color="#00A651" />
      )}
    </TouchableOpacity>
  );
};

export const BankSelectionModal: React.FC<BankSelectionModalProps> = ({
  visible,
  onClose,
  onSelectBank,
  selectedBank,
}) => {
  const { banks, isLoading } = useBanks();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) return banks;
    
    return banks.filter(bank =>
      bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bank.shortName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bank.code.includes(searchQuery)
    );
  }, [banks, searchQuery]);

  const handleSelectBank = (bank: Bank) => {
    onSelectBank(bank);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Bank</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search banks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bank List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading banks...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <BankItem
                bank={item}
                onSelect={handleSelectBank}
                isSelected={selectedBank?.code === item.code}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        {/* Selected Bank Info */}
        {selectedBank && (
          <View style={styles.selectedBankContainer}>
            <Text style={styles.selectedBankLabel}>Selected:</Text>
            <View style={styles.selectedBankInfo}>
              {selectedBank.logo ? (
                <Image
                  source={selectedBank.logo as any}
                  style={styles.selectedBankLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.selectedBankIconContainer}>
                  <Ionicons name="business" size={18} color="#666" />
                </View>
              )}
              <Text style={styles.selectedBankName}>{selectedBank.name}</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  selectedBankItem: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#00A651',
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 15,
  },
  bankIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDetails: {
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
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginLeft: 65,
  },
  selectedBankContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#F8F9FA',
  },
  selectedBankLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectedBankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedBankLogo: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginRight: 10,
  },
  selectedBankIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBankName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
}); 