import { View, Text, StyleSheet, Pressable, useWindowDimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Plus, Info, Check } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/Button';
import { useState, useEffect } from 'react';
import AddBankAccountModal from '@/components/AddBankAccountModal';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeBankAccounts } from '@/hooks/useRealtimeBankAccounts';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import { useBanks } from '@/hooks/useBanks';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import React from 'react'; // Added missing import for React

// Helper function to get bank icon
const getBankIcon = (bankName: string, bankCode?: string): { logo?: any; logoSvg?: any } => {
  if (!bankCode) {
    // Try to find bank code by name
    const bankNameToCode: { [key: string]: string } = {
      'Access Bank': '044',
      'Guaranty Trust Bank': '058',
      'First Bank of Nigeria': '011',
      'First City Monument Bank': '214',
      'United Bank for Africa': '033',
      'Zenith Bank': '057',
      'Ecobank Nigeria': '050',
      'Fidelity Bank': '070',
      'Union Bank of Nigeria': '032',
      'Wema Bank': '035',
      'Sterling Bank': '232',
      'Stanbic IBTC Bank': '221',
      'Standard Chartered Bank': '068',
      'Heritage Bank': '030',
      'Keystone Bank': '082',
      'Polaris Bank': '076',
      'Unity Bank': '215',
      'Jaiz Bank': '301',
      'Titan Trust Bank': '102',
      'Providus Bank': '101',
      'SunTrust Bank': '100',
      // Add more mappings as needed
    };
    
    bankCode = bankNameToCode[bankName];
  }
  
  if (!bankCode) {
    return {};
  }

  // Map bank codes to local asset names (PNG)
  const localBankIcons: { [key: string]: any } = {
    '035': require('@/assets/banks/wema_bank.png'),
    '057': require('@/assets/banks/zenith_bank.png'),
    '566': require('@/assets/banks/vfd_bank.png'),
    '51355': require('@/assets/banks/waya_bank.png'),
    '050020': require('@/assets/banks/vale_bank.png'),
    '215': require('@/assets/banks/unity_bank.png'),
    '033': require('@/assets/banks/united_bank.png'),
    '51322': require('@/assets/banks/uhuru_bank.png'),
    '102': require('@/assets/banks/titan_bank.png'),
    '302': require('@/assets/banks/taj_bank.png'),
    '100': require('@/assets/banks/suntrust_bank.png'),
    '51310': require('@/assets/banks/sparkle_bank.png'),
    '125': require('@/assets/banks/rubies_bank.png'),
    '50761': require('@/assets/banks/rehoboth_bank.png'),
    '90067': require('@/assets/banks/refuge_bank.png'),
    '51293': require('@/assets/banks/quick_fund_bank.png'),
    '050023': require('@/assets/banks/prosperis_bank.png'),
    '268': require('@/assets/banks/platinum_bank.png'),
    '51146': require('@/assets/banks/personal_trust_bank.png'),
    '311': require('@/assets/banks/parkway_readycash_bank.png'),
    '51142': require('@/assets/banks/navy_bank.png'),
    '090679': require('@/assets/banks/ndcc_bank.png'),
    '120003': require('@/assets/banks/mtn_mono_bank.png'),
    '090171': require('@/assets/banks/main_street_bank.png'),
    '303': require('@/assets/banks/lotus_bank.png'),
    '031': require('@/assets/banks/living_trust_bank.png'),
    '50549': require('@/assets/banks/links_bank.png'),
    '50200': require('@/assets/banks/kredi_bank.png'),
    '100025': require('@/assets/banks/kongapay_bank.png'),
    '899': require('@/assets/banks/kolomoni_bank.png'),
    '301': require('@/assets/banks/jaiz_bank.png'),
    '415': require('@/assets/banks/imperial_bank.png'),
    '51244': require('@/assets/banks/ibile_bank.png'),
    '50383': require('@/assets/banks/hasal_bank.png'),
    '562': require('@/assets/banks/greenwich_bank.png'),
    '812': require('@/assets/banks/gateway_bank.png'),
    '51314': require('@/assets/banks/firmus_bank.png'),
    '50298': require('@/assets/banks/fedeth_bank.png'),
    '51318': require('@/assets/banks/fair_money_bank.png'),
    '090678': require('@/assets/banks/excel_bank.png'),
    '50263': require('@/assets/banks/ekimogun_bank.png'),
    '51334': require('@/assets/banks/davenport_bank.png'),
    'FC40128': require('@/assets/banks/country_bank.png'),
    '50910': require('@/assets/banks/consumer_bank.png'),
    '070027': require('@/assets/banks/citycode_bank.png'),
    '50171': require('@/assets/banks/chanelle_bank.png'),
    '50823': require('@/assets/banks/cemcs_bank.png'),
    '865': require('@/assets/banks/cashconnect_bank.png'),
    '50931': require('@/assets/banks/bowen_bank.png'),
    '51100': require('@/assets/banks/bell_bank.png'),
    'MFB50992': require('@/assets/banks/baobab_bank.png'),
    '51351': require('@/assets/banks/awacash_bank.png'),
    'MFB50094': require('@/assets/banks/astrapolaris_bank.png'),
    '90077': require('@/assets/banks/ag_bank.png'),
    '602': require('@/assets/banks/accion_bank.png'),
    '120001': require('@/assets/banks/9mobile_bank.png'),
  };

  // Special handling for SVG files
  const getSvgIcon = (code: string) => {
    try {
      switch (code) {
        case '032':
          return require('@/assets/banks/union_bank.svg');
        case '076':
          return require('@/assets/banks/polaris_bank.svg');
        case '51269':
          return require('@/assets/banks/tangerine_bank.svg');
        case '232':
          return require('@/assets/banks/sterling_bank.svg');
        case '51253':
          return require('@/assets/banks/stallas_bank.svg');
        case '068':
          return require('@/assets/banks/standard_chartered_bank.svg');
        case '221':
          return require('@/assets/banks/stanbic_bank.svg');
        case '106':
          return require('@/assets/banks/signature_bank.svg');
        case '51113':
          return require('@/assets/banks/safe_haven_bank.svg');
        case '502':
          return require('@/assets/banks/rand_marchant_bank.svg');
        case '101':
          return require('@/assets/banks/providus_bank.svg');
        case '105':
          return require('@/assets/banks/premium_trust_bank.svg');
        case '00716':
          return require('@/assets/banks/pocket_bank.svg');
        case '51226':
          return require('@/assets/banks/pecan_trust_bank.svg');
        case '104':
          return require('@/assets/banks/parrallex_bank.svg');
        case '999991':
          return require('@/assets/banks/palmpay.svg');
        case '100002':
          return require('@/assets/banks/paga_bank.svg');
        case '107':
          return require('@/assets/banks/optimus_bank.svg');
        case '999992':
          return require('@/assets/banks/opay_bank.svg');
        case '50515':
          return require('@/assets/banks/moniepoint_bank.svg');
        case '50491':
          return require('@/assets/banks/loma_bank.svg');
        case '50211':
          return require('@/assets/banks/kuda_bank.svg');
        case '082':
          return require('@/assets/banks/keystone_bank.svg');
        case '120002':
          return require('@/assets/banks/hope_bank.svg');
        case '058':
          return require('@/assets/banks/gt_bank.svg');
        case '100022':
          return require('@/assets/banks/go_bank.svg');
        case '090574':
          return require('@/assets/banks/goldman_bank.svg');
        case '00103':
          return require('@/assets/banks/globus_bank.svg');
        case '501':
          return require('@/assets/banks/fsdh_bank.svg');
        case '413':
          return require('@/assets/banks/first_trust_bank.svg');
        case '011':
          return require('@/assets/banks/first_bank.svg');
        case '214':
          return require('@/assets/banks/fcmb_bank.svg');
        case '50126':
          return require('@/assets/banks/eyowo_bank.svg');
        case '050':
          return require('@/assets/banks/eco_bank.svg');
        case '098':
          return require('@/assets/banks/ekondo_bank.svg');
        case '50162':
          return require('@/assets/banks/dot_bank.svg');
        case '090560':
          return require('@/assets/banks/crust_bank.svg');
        case '40119':
          return require('@/assets/banks/credit_direct_bank.svg');
        case '559':
          return require('@/assets/banks/coronation_bank.svg');
        case '50204':
          return require('@/assets/banks/corestep_bank.svg');
        case '023':
          return require('@/assets/banks/citi_bank.svg');
        case '51353':
          return require('@/assets/banks/cashbridge_bank.svg');
        case '565':
          return require('@/assets/banks/carbon_bank.svg');
        case '50645':
          return require('@/assets/banks/buypower_bank.svg');
        case 'FC40163':
          return require('@/assets/banks/branch_bank.svg');
        case '51229':
          return require('@/assets/banks/baines_credit_bank.svg');
        case '401':
          return require('@/assets/banks/aso_savings_bank.svg');
        case '035A':
          return require('@/assets/banks/alat_wema_bank.svg');
        case '51336':
          return require('@/assets/banks/aku_bank.svg');
        case '120004':
          return require('@/assets/banks/airtel_smartcash_bank.svg');
        case '063':
          return require('@/assets/banks/access_diamond_bank.svg');
        case '044':
          return require('@/assets/banks/access_bank.svg');
        case '404':
          return require('@/assets/banks/abbey_bank.svg');
        default:
          return null;
      }
    } catch (error) {
      console.warn(`Failed to load SVG for bank code ${code}:`, error);
      return null;
    }
  };

  // Try to get SVG first
  const svgIcon = getSvgIcon(bankCode);
  if (svgIcon) {
    return { logoSvg: svgIcon };
  }

  // If no SVG, try regular image
  if (localBankIcons[bankCode]) {
    return { logo: localBankIcons[bankCode] };
  }

  // Return empty object for banks without logos (will show icon instead)
  return {};
};

export default function DestinationScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'payout' | 'linked'>('payout');
  const { width } = useWindowDimensions();
  const haptics = useHaptics();
  
  // Get both account types
  const { 
    payoutAccounts, 
    isLoading: payoutAccountsLoading, 
    error: payoutAccountsError 
  } = usePayoutAccounts();
  
  const { 
    bankAccounts, 
    isLoading: bankAccountsLoading, 
    error: bankAccountsError 
  } = useRealtimeBankAccounts();

  // Get banks for icon mapping
  const { banks } = useBanks();

  // Combine loading and error states
  const isLoading = payoutAccountsLoading || bankAccountsLoading;
  const error = payoutAccountsError || bankAccountsError;

  // Set default selection based on the active tab type
  useEffect(() => {
    if (accountType === 'payout' && payoutAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = payoutAccounts.find(account => account.is_default);
      setSelectedAccountId(defaultAccount?.id || payoutAccounts[0].id);
    } else if (accountType === 'linked' && bankAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = bankAccounts.find(account => account.is_default);
      setSelectedAccountId(defaultAccount?.id || bankAccounts[0].id);
    }
  }, [payoutAccounts, bankAccounts, selectedAccountId, accountType]);

  // Helper function to get bank code from bank name
  const getBankCode = (bankName: string): string | undefined => {
    const bank = banks.find(b => b.name.toLowerCase() === bankName.toLowerCase());
    return bank?.code;
  };

  // Helper function to render bank icon
  const renderBankIcon = (bankName: string, isSelected: boolean) => {
    const bankCode = getBankCode(bankName);
    const bankIcon = getBankIcon(bankName, bankCode);
    
    if (bankIcon.logoSvg) {
      // Handle SVG components
      return (
        <View style={[
          styles.bankIcon,
          isSelected && styles.selectedBankIcon
        ]}>
          {React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
            width: isSmallScreen ? 20 : 24,
            height: isSmallScreen ? 20 : 24,
            fill: isSelected ? '#1E3A8A' : colors.textSecondary
          })}
        </View>
      );
    } else if (bankIcon.logo) {
      return (
        <Image
          source={bankIcon.logo}
          style={[
            styles.bankIcon,
            isSelected && styles.selectedBankIcon
          ]}
          resizeMode="contain"
        />
      );
    } else {
      // Fallback to Building2 icon
      return (
        <View style={[
          styles.bankIcon,
          isSelected && styles.selectedBankIcon
        ]}>
          <Building2 size={isSmallScreen ? 20 : 24} color={isSelected ? '#1E3A8A' : colors.textSecondary} />
        </View>
      );
    }
  };

  const handleContinue = () => {
    if (selectedAccountId) {
      haptics.mediumImpact();
      
      let selectedAccount;
      let accountName, bankName, accountNumber;
      
      if (accountType === 'payout') {
        selectedAccount = payoutAccounts.find(account => account.id === selectedAccountId);
        if (selectedAccount) {
          accountName = selectedAccount.account_name;
          bankName = selectedAccount.bank_name;
          accountNumber = selectedAccount.account_number;
        }
      } else {
        selectedAccount = bankAccounts.find(account => account.id === selectedAccountId);
        if (selectedAccount) {
          accountName = selectedAccount.account_name;
          bankName = selectedAccount.bank_name;
          accountNumber = selectedAccount.account_number;
        }
      }
      
      if (selectedAccount) {
        router.push({
          pathname: '/create-payout/rules',
          params: {
            ...params,
            bankAccountId: accountType === 'linked' ? selectedAccountId : null,
            payoutAccountId: accountType === 'payout' ? selectedAccountId : null,
            bankName,
            accountNumber,
            accountName,
            totalAmount: params.totalAmount || '',
            frequency: params.frequency || '',
            payoutAmount: params.payoutAmount || '',
            duration: params.duration || '',
            startDate: params.startDate || '',
            customDates: params.customDates || '',
            dayOfWeek: params.dayOfWeek || '',
          }
        });
      }
    }
  };

  // Responsive styles based on screen width
  const isSmallScreen = width < 380;

  const styles = createStyles(colors, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '60%' }]} />
        </View>
        <Text style={styles.stepText}>Step 3 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Choose Payout Destination</Text>
          <Text style={styles.description}>
            Select a bank account to receive your payouts
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.accountTypeSelector}>
            {/* <Pressable
              style={[
                styles.accountTypeOption,
                accountType === 'payout' && styles.activeAccountType
              ]}
              onPress={() => {
                haptics.selection();
                setAccountType('payout');
                setSelectedAccountId(null);
              }}
            >
              <Text style={[
                styles.accountTypeText,
                accountType === 'payout' && styles.activeAccountTypeText
              ]}>
                Payout Accounts
              </Text>
            </Pressable> */}
            
            {/* <Pressable
              style={[
                styles.accountTypeOption,
                accountType === 'linked' && styles.activeAccountType
              ]}
              onPress={() => {
                haptics.selection();
                setAccountType('linked');
                setSelectedAccountId(null);
              }}
            >
              <Text style={[
                styles.accountTypeText,
                accountType === 'linked' && styles.activeAccountTypeText
              ]}>
                Linked Accounts
              </Text>
            </Pressable> */}
          </View>

          <View style={styles.accountsList}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading bank accounts...</Text>
              </View>
            ) : accountType === 'payout' ? (
              payoutAccounts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No payout accounts found</Text>
                  <Text style={styles.emptySubtext}>Add a payout account to continue</Text>
                </View>
              ) : (
                payoutAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    style={[
                      styles.accountOption,
                      selectedAccountId === account.id && styles.selectedAccount
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedAccountId(account.id);
                      setAccountType('payout');
                    }}
                  >
                    <View style={styles.accountInfo}>
                      {renderBankIcon(account.bank_name, selectedAccountId === account.id)}
                      <View style={styles.accountDetails}>
                        <Text style={[
                          styles.accountName,
                          selectedAccountId === account.id && styles.selectedText
                        ]}>
                          {account.bank_name} •••• {account.account_number.slice(-4)}
                        </Text>
                        <Text style={styles.accountHolder}>{account.account_name}</Text>
                        {account.is_default && (
                          <View style={styles.defaultTag}>
                            <Text style={styles.defaultText}>Default Account</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.radioOuter,
                      selectedAccountId === account.id && styles.radioOuterSelected
                    ]}>
                      {selectedAccountId === account.id && (
                        <Check size={16} color="#1E3A8A" />
                      )}
                    </View>
                  </Pressable>
                ))
              )
            ) : (
              bankAccounts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No linked accounts found</Text>
                  <Text style={styles.emptySubtext}>Add a linked account to continue</Text>
                </View>
              ) : (
                bankAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    style={[
                      styles.accountOption,
                      selectedAccountId === account.id && styles.selectedAccount
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedAccountId(account.id);
                      setAccountType('linked');
                    }}
                  >
                    <View style={styles.accountInfo}>
                      {renderBankIcon(account.bank_name, selectedAccountId === account.id)}
                      <View style={styles.accountDetails}>
                        <Text style={[
                          styles.accountName,
                          selectedAccountId === account.id && styles.selectedText
                        ]}>
                          {account.bank_name} •••• {account.account_number.slice(-4)}
                        </Text>
                        <Text style={styles.accountHolder}>{account.account_name}</Text>
                        {account.is_default && (
                          <View style={styles.defaultTag}>
                            <Text style={styles.defaultText}>Default Account</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.radioOuter,
                      selectedAccountId === account.id && styles.radioOuterSelected
                    ]}>
                      {selectedAccountId === account.id && (
                        <Check size={16} color="#1E3A8A" />
                      )}
                    </View>
                  </Pressable>
                ))
              )
            )}

            <Pressable
              style={styles.addAccountButton}
              onPress={() => {
                haptics.mediumImpact();
                setShowAddAccount(true);
              }}
            >
              <Plus size={20} color={colors.primary} />
              <Text style={styles.addAccountText}>
                Add New {accountType === 'payout' ? 'Payout' : 'Bank'} Account
              </Text>
            </Pressable>
          </View>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={styles.noticeText}>
              Your funds will be securely transferred to your selected bank account on the scheduled dates.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={selectedAccountId === null || isLoading}
        hapticType="medium"
      />

      {accountType === 'payout' ? (
        <AddPayoutAccountModal
          isVisible={showAddAccount}
          onClose={(newAccount) => {
            haptics.lightImpact();
            setShowAddAccount(false);
            // If a new account was added, select it and auto-advance
            if (newAccount && newAccount.id) {
              setSelectedAccountId(newAccount.id);
              router.push({
                pathname: '/create-payout/rules',
                params: {
                  ...params,
                  payoutAccountId: newAccount.id,
                  bankName: newAccount.bank_name,
                  accountNumber: newAccount.account_number,
                  accountName: newAccount.account_name,
                  totalAmount: params.totalAmount || '',
                  frequency: params.frequency || '',
                  payoutAmount: params.payoutAmount || '',
                  duration: params.duration || '',
                  startDate: params.startDate || '',
                  customDates: params.customDates || '',
                  dayOfWeek: params.dayOfWeek || '',
                }
              });
            }
          }}
        />
      ) : (
        <AddBankAccountModal
          isVisible={showAddAccount}
          onClose={() => {
            haptics.lightImpact();
            setShowAddAccount(false);
          }}
          onAdd={async (account) => {
            // This is handled by the modal
          }}
          loading={isLoading}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
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
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: isSmallScreen ? 15 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  accountTypeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 4,
  },
  accountTypeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeAccountType: {
    backgroundColor: colors.primary,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeAccountTypeText: {
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  accountsList: {
    gap: 12,
    marginBottom: 24,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedAccount: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.primary,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 12 : 16,
    flex: 1,
  },
  bankIcon: {
    width: isSmallScreen ? 40 : 48,
    height: isSmallScreen ? 40 : 48,
    borderRadius: isSmallScreen ? 20 : 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBankIcon: {
    backgroundColor: colors.backgroundTertiary,
  },
  accountDetails: {
    gap: 4,
    flex: 1,
  },
  accountName: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  selectedText: {
    color: '#1E3A8A',
  },
  accountHolder: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
  },
  defaultTag: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  defaultText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  radioOuterSelected: {
    borderColor: '#1E3A8A',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
  },
  addAccountText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    borderRadius: 12,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    lineHeight: 20,
  },
});