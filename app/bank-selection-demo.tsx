import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BankSelector } from '@/components/BankSelector';
import { BankSelectionModal } from '@/components/BankSelectionModal';
import { Bank } from '@/hooks/useBanks';

export default function BankSelectionDemo() {
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showModal, setShowModal] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bank Selection Demo</Text>
          <Text style={styles.subtitle}>
            Comprehensive list of Nigerian banks with real logos
          </Text>
        </View>

        {/* Bank Selector Example */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Selector Component</Text>
          <Text style={styles.sectionDescription}>
            A dropdown-style bank selector with real bank logos
          </Text>
          
          <BankSelector
            selectedBank={selectedBank}
            onSelectBank={setSelectedBank}
            placeholder="Choose your bank"
          />

          {selectedBank && (
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedLabel}>Selected Bank:</Text>
              <Text style={styles.selectedText}>
                {selectedBank.name} (Code: {selectedBank.code})
              </Text>
              <Text style={styles.bankCategory}>
                {selectedBank.category === 'microfinance' ? 'Microfinance Bank' : 'Commercial Bank'}
              </Text>
            </View>
          )}
        </View>

        {/* Direct Modal Example */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Direct Modal Access</Text>
          <Text style={styles.sectionDescription}>
            Open the bank selection modal directly
          </Text>
          
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="business" size={20} color="#fff" />
            <Text style={styles.modalButtonText}>Open Bank Selection</Text>
          </TouchableOpacity>
        </View>

        {/* Bank Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Categories</Text>
          <Text style={styles.sectionDescription}>
            The component includes both commercial and microfinance banks:
          </Text>
          
          <View style={styles.categoryContainer}>
            <View style={styles.categoryItem}>
              <Ionicons name="business" size={24} color="#00A651" />
              <Text style={styles.categoryTitle}>Commercial Banks</Text>
              <Text style={styles.categoryDescription}>
                Traditional banks like GTBank, First Bank, UBA, Zenith, etc.
              </Text>
            </View>
            
            <View style={styles.categoryItem}>
              <Ionicons name="phone-portrait" size={24} color="#FF6B35" />
              <Text style={styles.categoryTitle}>Microfinance Banks</Text>
              <Text style={styles.categoryDescription}>
                Digital banks like OPay, Kuda, Paga, Carbon, etc.
              </Text>
            </View>
          </View>
        </View>

        {/* Bank List Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Banks</Text>
          <Text style={styles.sectionDescription}>
            The component includes 60+ Nigerian banks including:
          </Text>
          
          <View style={styles.bankList}>
            <Text style={styles.bankListTitle}>Commercial Banks:</Text>
            <Text style={styles.bankListItem}>• Access Bank</Text>
            <Text style={styles.bankListItem}>• GTBank</Text>
            <Text style={styles.bankListItem}>• First Bank of Nigeria</Text>
            <Text style={styles.bankListItem}>• UBA</Text>
            <Text style={styles.bankListItem}>• Zenith Bank (with logo)</Text>
            <Text style={styles.bankListItem}>• FCMB</Text>
            <Text style={styles.bankListItem}>• Ecobank Nigeria</Text>
            <Text style={styles.bankListItem}>• Sterling Bank</Text>
            <Text style={styles.bankListItem}>• Wema Bank (with logo)</Text>
            
            <Text style={styles.bankListTitle}>Microfinance Banks:</Text>
            <Text style={styles.bankListItem}>• OPay</Text>
            <Text style={styles.bankListItem}>• Kuda Bank</Text>
            <Text style={styles.bankListItem}>• Paga</Text>
            <Text style={styles.bankListItem}>• Carbon</Text>
            <Text style={styles.bankListItem}>• FairMoney</Text>
            <Text style={styles.bankListItem}>• Branch</Text>
            <Text style={styles.bankListItem}>• And many more...</Text>
          </View>
        </View>

        {/* Local Bank Logos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Local Bank Logos</Text>
          <Text style={styles.sectionDescription}>
            Some banks now have local logos from your assets folder:
          </Text>
          
          <View style={styles.logoList}>
            <View style={styles.logoItem}>
              <Text style={styles.logoName}>• Wema Bank</Text>
              <Text style={styles.logoFile}>wema_bank.svg</Text>
            </View>
            <View style={styles.logoItem}>
              <Text style={styles.logoName}>• Zenith Bank</Text>
              <Text style={styles.logoFile}>zenith_bank.svg</Text>
            </View>
            <View style={styles.logoItem}>
              <Text style={styles.logoName}>• VFD Bank</Text>
              <Text style={styles.logoFile}>vfd_bank.svg</Text>
            </View>
            <View style={styles.logoItem}>
              <Text style={styles.logoName}>• Waya Bank</Text>
              <Text style={styles.logoFile}>waya_bank.svg</Text>
            </View>
          </View>
          
          <Text style={styles.logoNote}>
            Other banks will show placeholder initials until you add their logos to assets/banks/
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="search" size={16} color="#00A651" />
              <Text style={styles.featureText}>Search functionality</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="image" size={16} color="#00A651" />
              <Text style={styles.featureText}>Real bank logos</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00A651" />
              <Text style={styles.featureText}>Visual selection indicators</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="phone-portrait" size={16} color="#00A651" />
              <Text style={styles.featureText}>Mobile-optimized design</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={16} color="#00A651" />
              <Text style={styles.featureText}>Error handling & validation</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="business" size={16} color="#00A651" />
              <Text style={styles.featureText}>Commercial & Microfinance banks</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="list" size={16} color="#00A651" />
              <Text style={styles.featureText}>Bank category indicators</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bank Selection Modal */}
      <BankSelectionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSelectBank={setSelectedBank}
        selectedBank={selectedBank}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  selectedInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00A651',
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  selectedText: {
    fontSize: 16,
    color: '#00A651',
    fontWeight: '500',
    marginBottom: 4,
  },
  bankCategory: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A651',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  categoryContainer: {
    marginTop: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  bankList: {
    marginTop: 12,
  },
  bankListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  bankListItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  featuresList: {
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  logoList: {
    marginTop: 12,
  },
  logoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  logoName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  logoFile: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  logoNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
}); 