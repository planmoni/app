import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { X, CreditCard, Building2, Plus, Trash2, Check } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { usePaymentMethods, PaymentMethod } from '@/hooks/usePaymentMethods';
import { router } from 'expo-router';

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
  const { paymentMethods, isLoading, error, setDefaultMethod, deletePaymentMethod } = usePaymentMethods();
  
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const handleMethodSelect = (method: PaymentMethod) => {
    haptics.selection();
    setSelectedMethodId(method.id);
    
    if (onSelect) {
      onSelect(method);
      onClose();
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
    onClose();
    router.push('/add-card');
  };

  const handleAddBankAccount = () => {
    haptics.mediumImpact();
    onClose();
    router.push('/linked-accounts');
  };

  const getCardIcon = (cardType?: string) => {
    // In a real app, you would return different card icons based on the card type
    return <CreditCard size={24} color={colors.primary} />;
  };

  const styles = createStyles(colors, isDark);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {
        haptics.lightImpact();
        onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Payment Methods</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={() => {
                haptics.lightImpact();
                onClose();
              }}
            >
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading payment methods...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : paymentMethods.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No payment methods found</Text>
                <Text style={styles.emptySubtext}>Add a card or bank account to get started</Text>
              </View>
            ) : (
              <View style={styles.methodsList}>
                {paymentMethods.map(method => (
                  <Pressable
                    key={method.id}
                    style={[
                      styles.methodItem,
                      selectedMethodId === method.id && styles.selectedMethodItem
                    ]}
                    onPress={() => handleMethodSelect(method)}
                  >
                    <View style={styles.methodContent}>
                      <View style={styles.methodIcon}>
                        {method.type === 'card' ? (
                          getCardIcon(method.card_type)
                        ) : (
                          <Building2 size={24} color={colors.primary} />
                        )}
                      </View>
                      <View style={styles.methodInfo}>
                        <Text style={styles.methodTitle}>
                          {method.type === 'card' 
                            ? `${method.card_type?.toUpperCase() || 'Card'} •••• ${method.last_four}`
                            : `${method.bank} •••• ${method.last_four}`
                          }
                        </Text>
                        <Text style={styles.methodSubtitle}>
                          {method.type === 'card'
                            ? `Expires ${method.exp_month}/${method.exp_year}`
                            : method.bank
                          }
                        </Text>
                        {method.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>Default</Text>
                          </View>
                        )}
                      </View>
                    </View>
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
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          
          <View style={styles.footer}>
            <Button
              title="Add Card"
              onPress={handleAddCard}
              style={styles.addCardButton}
              icon={CreditCard}
              hapticType="medium"
            />
            <Button
              title="Add Bank Account"
              onPress={handleAddBankAccount}
              variant="outline"
              style={styles.addBankButton}
              icon={Building2}
              hapticType="medium"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.border : 'transparent',
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
    padding: 20,
    maxHeight: 400,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  methodsList: {
    gap: 16,
  },
  methodItem: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  selectedMethodItem: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  methodContent: {
    flexDirection: 'row',
    padding: 16,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  methodSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  defaultBadge: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  defaultText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  methodActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  actionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  deleteButton: {
    borderRightWidth: 0,
  },
  deleteText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addCardButton: {
    backgroundColor: colors.primary,
  },
  addBankButton: {
    borderColor: colors.border,
  },
});