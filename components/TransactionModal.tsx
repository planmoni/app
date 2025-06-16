import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import { X, Copy, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TransactionModalProps = {
  isVisible: boolean;
  onClose: () => void;
  transaction: {
    amount: string;
    status: string;
    date: string;
    time: string;
    type: string;
    source: string;
    destination: string;
    transactionId: string;
    planRef: string;
    paymentMethod: string;
    initiatedBy: string;
    processingTime: string;
  };
};

export default function TransactionModal({ isVisible, onClose, transaction }: TransactionModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  
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
    } else {
      // Animate modal out
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
      ]).start();
    }
  }, [isVisible]);

  const handleCopyTransactionId = () => {
    haptics.selection();
    // Implement copy functionality
  };

  const handleClose = () => {
    haptics.lightImpact();
    
    // Animate out before calling onClose
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
      onClose();
    });
  };

  const handleDownloadReceipt = () => {
    haptics.mediumImpact();
    // Implement download functionality
  };

  const handleReportIssue = () => {
    haptics.mediumImpact();
    // Implement report functionality
  };

  const isPositive = transaction?.type === 'Deposit';

  // Calculate modal height - limit to 90% of screen height
  const modalMaxHeight = screenHeight * 0.9;

  if (!isVisible || !transaction) return null;

  const styles = createStyles(colors, isDark, insets);

  return (
    <Animated.View 
      style={[
        styles.overlay,
        { opacity: overlayOpacity }
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable style={styles.overlayPressable} onPress={handleClose} />
      
      <Animated.View 
        style={[
          styles.modal,
          { 
            transform: [{ translateY: slideAnim }],
            maxHeight: modalMaxHeight
          }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Transaction Details</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.amountSection}>
            <View style={[styles.amountIcon, { backgroundColor: isPositive ? '#DCFCE7' : '#FEE2E2' }]}>
              {isPositive ? (
                <ArrowUpRight size={24} color="#22C55E" />
              ) : (
                <ArrowDownRight size={24} color="#EF4444" />
              )}
            </View>
            <View>
              <Text style={[styles.amount, isPositive ? styles.positiveAmount : styles.negativeAmount]}>
                {transaction.amount}
              </Text>
              <Text style={[styles.status, isPositive ? styles.positiveStatus : styles.negativeStatus]}>
                {transaction.status}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Information</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Date & Time</Text>
              <Text style={styles.value}>{transaction.date} at {transaction.time}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Transaction Type</Text>
              <Text style={styles.value}>{transaction.type}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Source</Text>
              <Text style={styles.value}>{transaction.source}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Destination</Text>
              <Text style={styles.value}>{transaction.destination}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reference Details</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Transaction ID</Text>
              <View style={styles.idContainer}>
                <Text style={styles.value}>{transaction.transactionId}</Text>
                <Pressable onPress={handleCopyTransactionId} style={styles.copyButton}>
                  <Copy size={20} color="#1E3A8A" />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Payout Plan Ref</Text>
              <Text style={styles.value}>{transaction.planRef}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>{transaction.paymentMethod}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Initiated By</Text>
              <Text style={styles.value}>{transaction.initiatedBy}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Processing Time</Text>
              <Text style={styles.value}>{transaction.processingTime}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Download Receipt"
            style={styles.receiptButton}
            onPress={handleDownloadReceipt}
            hapticType="medium"
          />
          <Button
            title="Report an Issue"
            variant="outline"
            style={styles.reportButton}
            onPress={handleReportIssue}
            hapticType="warning"
          />
        </View>
        
        {/* Drag indicator for better UX */}
        <View style={styles.dragIndicator} />
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  overlay: {
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
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    overflow: 'hidden',
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
    position: 'absolute',
    top: 8,
    zIndex: 10,
  },
  header: {
    backgroundColor: '#1E3A8A',
    padding: 24,
    paddingTop: 32, // Extra padding for drag indicator
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  amountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  positiveAmount: {
    color: '#22C55E',
  },
  negativeAmount: {
    color: '#EF4444',
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  positiveStatus: {
    color: '#22C55E',
  },
  negativeStatus: {
    color: '#EF4444',
  },
  scrollView: {
    maxHeight: '60%', // Limit scroll view height
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
  },
  copyButton: {
    padding: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  footer: {
    padding: 24,
    paddingBottom: Math.max(24, insets.bottom),
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  receiptButton: {
    backgroundColor: '#1E3A8A',
  },
  reportButton: {
    borderColor: colors.border,
  },
});