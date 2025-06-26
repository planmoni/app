import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Animated, Dimensions, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Building2, Plus, Trash2, Check, Smartphone, ChevronRight } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { usePaymentMethods, PaymentMethod } from '@/hooks/usePaymentMethods';
import { router } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PaymentMethodsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect?: (method: PaymentMethod) => void;
}

export default function PaymentMethodsModal({ 
  isVisible, 
  onClose,
  onSelect
}: PaymentMethodsModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const { paymentMethods, isLoading, error, setDefaultMethod, deletePaymentMethod } = usePaymentMethods();
  
  // Filter payment methods by type
  const cardMethods = paymentMethods.filter(method => method.type === 'card');
  const bankMethods = paymentMethods.filter(method => method.type === 'bank');
  
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Animate modal in
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isVisible]);

  const handleMethodSelect = (method: PaymentMethod) => {
    haptics.selection();
    setSelectedMethodId(method.id);
    
    if (onSelect) {
      onSelect(method);
      handleClose();
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      haptics.impact();
      await setDefaultMethod(methodId);
      haptics.success();
    } catch (error) {
      haptics.error();
      console.error('Error setting default method:', error);
    }
  };

  const handleDelete = (method: PaymentMethod) => {
    haptics.warning();
    
    Alert.alert(
      "Delete Payment Method",
      `Are you sure you want to delete this ${method.type === 'card' ? 'card' : 'account'}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => haptics.lightImpact()
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              haptics.heavyImpact();
              await deletePaymentMethod(method.id);
              if (selectedMethodId === method.id) {
                setSelectedMethodId(null);
              }
              haptics.success();
            } catch (error) {
              haptics.error();
              console.error('Error deleting payment method:', error);
            }
          }
        }
      ]
    );
  };

  const handleAddCard = () => {
    haptics.mediumImpact();
    handleClose();
    router.push('/add-card');
  };

  const handleAddBankAccount = () => {
    haptics.mediumImpact();
    handleClose();
    router.push('/linked-accounts');
  };

  const handleAddUSSD = () => {
    haptics.mediumImpact();
    handleClose();
    router.push('/add-ussd');
  };

  const handleContinue = () => {
    if (selectedMethodId) {
      haptics.mediumImpact();
      const selectedMethod = paymentMethods.find(method => method.id === selectedMethodId);
      if (selectedMethod && onSelect) {
        onSelect(selectedMethod);
      }
      handleClose();
    }
  };

  const handleClose = () => {
    // Animate out before closing
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      haptics.lightImpact();
      onClose();
    });
  };

  const getCardIcon = (cardType?: string) => {
    // In a real app, you would return different card icons based on the card type
    return <CreditCard size={24} color={colors.primary} />;
  };

  // Calculate modal height - limit to 90% of screen height
  const modalMaxHeight = screenHeight * 0.9;

  const styles = createStyles(colors, isDark, insets);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.modalOverlay,
        { opacity: overlayOpacity }
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable style={styles.overlayPressable} onPress={handleClose} />
      
      <Animated.View 
        style={[
          styles.modalContent,
          { 
            transform: [{ translateY: slideAnim }],
            maxHeight: modalMaxHeight
          }
        ]}
      >
        <View style={styles.dragIndicator} />
        
        <View style={styles.header}>
          <Text style={styles.title}>Payment Methods</Text>
          <Pressable 
            style={styles.closeButton} 
            onPress={handleClose}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading payment methods...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <>
              {(cardMethods.length > 0 || bankMethods.length > 0) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Saved Payment Methods</Text>
                  
                  {cardMethods.length > 0 && (
                    <View style={styles.methodTypeContainer}>
                      <View style={styles.methodTypeHeader}>
                        <Text style={styles.methodTypeTitle}>Cards</Text>
                        <Pressable style={styles.seeAllButton}>
                          <Text style={styles.seeAllText}>See All</Text>
                        </Pressable>
                      </View>
                      
                      {cardMethods.map((method) => (
                        <View key={method.id} style={styles.methodItem}>
                          <Pressable 
                            style={[
                              styles.methodCard,
                              selectedMethodId === method.id && styles.selectedMethodCard
                            ]}
                            onPress={() => handleMethodSelect(method)}
                          >
                            <View style={styles.methodLeft}>
                              <View style={styles.methodIconContainer}>
                                {getCardIcon(method.card_type)}
                              </View>
                              <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>
                                  {method.card_type?.toUpperCase() || 'Card'} •••• {method.last_four}
                                </Text>
                                <Text style={styles.methodSubtitle}>
                                  {method.is_default ? 'Default' : `Expires ${method.exp_month}/${method.exp_year}`}
                                </Text>
                              </View>
                            </View>
                            <Pressable 
                              style={styles.useButton}
                              onPress={() => handleMethodSelect(method)}
                            >
                              <Text style={styles.useButtonText}>Use this card</Text>
                            </Pressable>
                          </Pressable>
                          
                          <View style={styles.methodActions}>
                            {!method.is_default && (
                              <Pressable
                                style={styles.actionButton}
                                onPress={() => handleSetDefault(method.id)}
                              >
                                <Check size={16} color={colors.primary} />
                                <Text style={styles.actionText}>Set Default</Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={[styles.actionButton, styles.deleteButton]}
                              onPress={() => handleDelete(method)}
                            >
                              <Trash2 size={16} color="#EF4444" />
                              <Text style={styles.deleteText}>Remove</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {bankMethods.length > 0 && (
                    <View style={styles.methodTypeContainer}>
                      <View style={styles.methodTypeHeader}>
                        <Text style={styles.methodTypeTitle}>Linked Bank Accounts</Text>
                        <Pressable style={styles.seeAllButton}>
                          <Text style={styles.seeAllText}>See All</Text>
                        </Pressable>
                      </View>
                      
                      {bankMethods.map((method) => (
                        <View key={method.id} style={styles.methodItem}>
                          <Pressable 
                            style={[
                              styles.methodCard,
                              selectedMethodId === method.id && styles.selectedMethodCard
                            ]}
                            onPress={() => handleMethodSelect(method)}
                          >
                            <View style={styles.methodLeft}>
                              <View style={styles.methodIconContainer}>
                                <Building2 size={24} color={colors.primary} />
                              </View>
                              <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>
                                  {method.bank || 'Bank'} •••• {method.last_four}
                                </Text>
                                <Text style={styles.methodSubtitle}>
                                  Martins Osodi
                                </Text>
                              </View>
                            </View>
                            <Pressable 
                              style={styles.useButton}
                              onPress={() => handleMethodSelect(method)}
                            >
                              <Text style={styles.useButtonText}>Use this Bank</Text>
                            </Pressable>
                          </Pressable>
                          
                          <View style={styles.methodActions}>
                            {!method.is_default && (
                              <Pressable
                                style={styles.actionButton}
                                onPress={() => handleSetDefault(method.id)}
                              >
                                <Check size={16} color={colors.primary} />
                                <Text style={styles.actionText}>Set Default</Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={[styles.actionButton, styles.deleteButton]}
                              onPress={() => handleDelete(method)}
                            >
                              <Trash2 size={16} color="#EF4444" />
                              <Text style={styles.deleteText}>Remove</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose a new payment method</Text>
                
                <Pressable 
                  style={styles.newMethodButton}
                  onPress={handleAddCard}
                >
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIconContainer}>
                      <CreditCard size={24} color={colors.primary} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>Debit/Credit Card</Text>
                      <Text style={styles.methodSubtitle}>Visa, Mastercard, Verve</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>

                <Pressable 
                  style={styles.newMethodButton}
                  onPress={handleAddUSSD}
                >
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIconContainer}>
                      <Smartphone size={24} color={colors.primary} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>USSD</Text>
                      <Text style={styles.methodSubtitle}>Use USSD Code to pay</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>
                
                <Pressable 
                  style={styles.newMethodButton}
                  onPress={handleAddBankAccount}
                >
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIconContainer}>
                      <Building2 size={24} color={colors.primary} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>Link Bank Account</Text>
                      <Text style={styles.methodSubtitle}>Add your bank account for transfers</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
        
        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!selectedMethodId || isLoading}
            style={styles.continueButton}
            hapticType="medium"
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  overlayPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.border : 'transparent',
    // Add shadow for iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    maxHeight: '70%',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  methodTypeContainer: {
    marginBottom: 20,
  },
  methodTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  methodTypeTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  seeAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  methodItem: {
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedMethodCard: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    marginLeft: 0,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  methodSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  useButton: {
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  useButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  methodActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.backgroundTertiary,
  },
  actionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
  },
  deleteText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  newMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    padding: 20,
    paddingBottom: Math.max(20, insets.bottom),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButton: {
    backgroundColor: colors.primary,
  },
});