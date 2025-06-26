import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Dimensions, Platform, Modal } from 'react-native';
import { X, Copy, ArrowUpRight, ArrowDownRight, FileText, Image as LucideImage } from 'lucide-react-native';
import { Image } from 'react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useToast } from '@/contexts/ToastContext';
import React from 'react';
import { captureRef } from 'react-native-view-shot';

// Planmoni logo as base64 (truncated for brevity)
const PLANMONI_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABXwAAAFUCAYAAACXwfQTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAEtrSURBVHgB7d3LcxRX1...'; // Use the full string from logo-base64.txt

// Helper to get formatted file name
const getReceiptFileName = (transaction: TransactionModalProps['transaction'], ext = 'pdf') => {
  const date = transaction.date?.replace(/\//g, '-') || new Date().toISOString().slice(0, 10);
  return `Planmoni_Transaction_Receipt_${date}_${transaction.transactionId}.${ext}`;
};

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
  const { showToast } = useToast();
  
  // State for format selection modal
  const [showFormatModal, setShowFormatModal] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  const receiptViewRef = useRef<View>(null);
  
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
    Clipboard.setStringAsync(transaction.transactionId)
      .then(() => {
        showToast('Transaction ID copied to clipboard', 'success');
      })
      .catch(() => {
        showToast('Failed to copy transaction ID', 'error');
      });
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

  const generateReceiptHtml = () => {
    const isPositive = transaction?.type === 'Deposit';
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Planmoni Transaction Receipt - ${transaction.transactionId}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            margin: 0;
            padding: 0;
          }
          .receipt {
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 8px 32px rgba(30,58,138,0.10);
            max-width: 600px;
            margin: 40px auto;
            padding: 0 0 32px 0;
            border: 1.5px solid #e5e7eb;
          }
          .header {
            background: linear-gradient(90deg, #1E3A8A 0%, #3B82F6 100%);
            color: #fff;
            padding: 32px 32px 16px 32px;
            border-top-left-radius: 18px;
            border-top-right-radius: 18px;
            text-align: center;
          }
          .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 12px auto;
            display: block;
          }
          .receipt-title {
            font-size: 2rem;
            font-weight: 800;
            margin-bottom: 4px;
            letter-spacing: -0.5px;
          }
          .receipt-subtitle {
            font-size: 1rem;
            opacity: 0.92;
            font-weight: 400;
          }
          .amount-section {
            background: linear-gradient(90deg, ${isPositive ? '#F0FDF4' : '#FEF2F2'} 0%, ${isPositive ? '#DCFCE7' : '#FEE2E2'} 100%);
            border: 2px solid ${isPositive ? '#22C55E' : '#EF4444'};
            border-radius: 12px;
            padding: 24px;
            margin: 32px 32px 0 32px;
            text-align: center;
          }
          .amount {
            font-size: 2.2rem;
            font-weight: 800;
            color: ${isPositive ? '#166534' : '#991B1B'};
            margin-bottom: 6px;
          }
          .status {
            font-size: 1.1rem;
            font-weight: 700;
            color: ${isPositive ? '#166534' : '#991B1B'};
            text-transform: uppercase;
          }
          .content {
            padding: 32px;
          }
          .section {
            margin-bottom: 32px;
          }
          .section-title {
            font-size: 1.2rem;
            font-weight: 700;
            color: #1E3A8A;
            margin-bottom: 16px;
            border-bottom: 2px solid #E5E7EB;
            padding-bottom: 8px;
          }
          .field {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #F3F4F6;
          }
          .field:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: 600;
            color: #6B7280;
            min-width: 140px;
            font-size: 1rem;
          }
          .value {
            font-weight: 700;
            color: #111827;
            text-align: right;
            flex: 1;
            margin-left: 16px;
            font-size: 1rem;
          }
          .transaction-id {
            background: linear-gradient(135deg, #F3F4F6, #E5E7EB);
            padding: 12px;
            border-radius: 8px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            font-size: 0.95rem;
            word-break: break-all;
            border: 1px solid #D1D5DB;
            font-weight: 600;
            color: #374151;
          }
          .footer {
            background: linear-gradient(90deg, #F8FAFC 0%, #F1F5F9 100%);
            padding: 24px 32px;
            text-align: center;
            border-bottom-left-radius: 18px;
            border-bottom-right-radius: 18px;
            border-top: 1px solid #E2E8F0;
          }
          .footer-text {
            color: #64748B;
            font-size: 1rem;
            margin-bottom: 6px;
            font-weight: 500;
          }
          .timestamp {
            color: #94A3B8;
            font-size: 0.95rem;
            font-weight: 500;
            margin-top: 10px;
          }
          .company-info {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #E2E8F0;
          }
          .company-name {
            font-weight: 700;
            color: #1E3A8A;
            font-size: 1.1rem;
            margin-bottom: 3px;
          }
          .company-contact {
            color: #64748B;
            font-size: 0.98rem;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <img src="${PLANMONI_LOGO_BASE64}" class="logo" alt="Planmoni Logo" />
            <div class="receipt-title">Planmoni Transaction Receipt</div>
            <div class="receipt-subtitle">Official Transaction Document</div>
          </div>
          <div class="amount-section">
            <div class="amount">${transaction.amount}</div>
            <div class="status">${transaction.status}</div>
          </div>
          <div class="content">
            <div class="section">
              <div class="section-title">Transaction Information</div>
              <div class="field">
                <span class="label">Date & Time</span>
                <span class="value">${transaction.date} at ${transaction.time}</span>
              </div>
              <div class="field">
                <span class="label">Transaction Type</span>
                <span class="value">${transaction.type}</span>
              </div>
              <div class="field">
                <span class="label">Source</span>
                <span class="value">${transaction.source}</span>
              </div>
              <div class="field">
                <span class="label">Destination</span>
                <span class="value">${transaction.destination}</span>
              </div>
            </div>
            <div class="section">
              <div class="section-title">Reference Details</div>
              <div class="field">
                <span class="label">Transaction ID</span>
                <span class="value">
                  <div class="transaction-id">${transaction.transactionId}</div>
                </span>
              </div>
              <div class="field">
                <span class="label">Payout Plan Ref</span>
                <span class="value">${transaction.planRef}</span>
              </div>
            </div>
            <div class="section">
              <div class="section-title">Additional Details</div>
              <div class="field">
                <span class="label">Payment Method</span>
                <span class="value">${transaction.paymentMethod}</span>
              </div>
              <div class="field">
                <span class="label">Initiated By</span>
                <span class="value">${transaction.initiatedBy}</span>
              </div>
              <div class="field">
                <span class="label">Processing Time</span>
                <span class="value">${transaction.processingTime}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <div class="footer-text">Thank you for using Planmoni</div>
            <div class="company-info">
              <div class="company-name">Planmoni</div>
              <div class="company-contact">For support, contact us at support@planmoni.app</div>
            </div>
            <div class="timestamp">Receipt generated on ${currentDate} at ${currentTime}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadReceipt = () => {
    haptics.mediumImpact();
    setShowFormatModal(true);
  };

  // Helper for formatted date for file name
  const getFormattedDate = () => {
    if (transaction?.date) {
      // Expecting format: YYYY/MM/DD or DD/MM/YYYY
      return transaction.date.replace(/\//g, '-');
    }
    return new Date().toISOString().slice(0, 10);
  };

  // --- IMAGE (PNG) GENERATION ---
  const handleGenerateImage = async () => {
    haptics.mediumImpact();
    setShowFormatModal(false);
    try {
      if (!receiptViewRef.current) throw new Error('Receipt view not ready');
      const uri = await captureRef(receiptViewRef, {
        format: 'png',
        quality: 1,
      });
      // Move to temp directory with correct file name
      const fileName = `Planmoni Transaction Receipt ${getFormattedDate()}.png`;
      const destPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: destPath });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(destPath, {
          mimeType: 'image/png',
          dialogTitle: 'Planmoni Transaction Receipt',
        });
        showToast('Receipt image shared successfully', 'success');
      } else {
        showToast('Sharing not available', 'error');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      showToast('Failed to generate image', 'error');
    }
  };

  // --- PDF GENERATION ---
  const handleGeneratePDF = async () => {
    haptics.mediumImpact();
    setShowFormatModal(false);
    try {
      const receiptHtml = generateReceiptHtml();
      const { uri } = await Print.printToFileAsync({
        html: receiptHtml,
        base64: false,
      });
      // Rename/copy to correct file name
      const fileName = `Planmoni Transaction Receipt ${getFormattedDate()}.pdf`;
      const destPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: destPath });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(destPath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Planmoni Transaction Receipt',
          UTI: 'com.adobe.pdf',
        });
        showToast('PDF receipt shared successfully', 'success');
      } else {
        showToast('Sharing not available', 'error');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Failed to generate PDF', 'error');
    }
  };

  const handleCloseFormatModal = () => {
    haptics.lightImpact();
    setShowFormatModal(false);
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

  // --- RECEIPT VIEW FOR IMAGE CAPTURE ---
  // Only rendered offscreen for image capture
  const renderReceiptView = () => (
    <View
      ref={receiptViewRef}
      style={{ position: 'absolute', left: -9999, top: 0, width: 350, backgroundColor: '#fff', padding: 24, borderRadius: 18 }}
      collapsable={false}
    >
      {/* Professional receipt design, logo, etc. */}
      {/* You can reuse the HTML design as a React Native view here for image capture */}
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Image
          source={{ uri: PLANMONI_LOGO_BASE64 }}
          style={{ width: 64, height: 64, marginBottom: 8 }}
        />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1E3A8A' }}>Planmoni Transaction Receipt</Text>
        <Text style={{ fontSize: 14, color: '#3B82F6', marginTop: 2 }}>Official Receipt</Text>
      </View>
      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: isPositive ? '#22C55E' : '#EF4444' }}>{transaction.amount}</Text>
        <Text style={{ fontSize: 14, color: isPositive ? '#166534' : '#991B1B', fontWeight: '600' }}>{transaction.status}</Text>
      </View>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Date: {transaction.date} {transaction.time}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Transaction ID: {transaction.transactionId}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Type: {transaction.type}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Source: {transaction.source}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Destination: {transaction.destination}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Plan Ref: {transaction.planRef}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Payment Method: {transaction.paymentMethod}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Initiated By: {transaction.initiatedBy}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Processing Time: {transaction.processingTime}</Text>
    </View>
  );

  return (
    <>
      {/* Hidden receipt view for image capture */}
      {renderReceiptView()}
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
              hapticType="medium" />
            <Button
              title="Report an Issue"
              variant="outline"
              style={styles.reportButton}
              onPress={handleReportIssue}
              hapticType="warning" />
          </View>

          {/* Drag indicator for better UX */}
          <View style={styles.dragIndicator} />
        </Animated.View>
      </Animated.View>
      <Modal
        visible={showFormatModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseFormatModal}
      >
        <View style={styles.formatModalOverlay}>
          <View style={styles.formatModalContent}>
            <View style={styles.formatModalHeader}>
              <Text style={styles.formatModalTitle}>Choose Receipt Format</Text>
              <Pressable onPress={handleCloseFormatModal} style={styles.formatModalCloseButton}>
                <X size={24} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.formatOptions}>
              <Pressable style={styles.formatOption} onPress={handleGenerateImage}>
                <LucideImage size={32} color="#1E3A8A" />
                <Text style={styles.formatOptionTitle}>Image (PNG)</Text>
                <Text style={styles.formatOptionDescription}>Share as a real image</Text>
              </Pressable>
              <Pressable style={styles.formatOption} onPress={handleGeneratePDF}>
                <FileText size={32} color="#1E3A8A" />
                <Text style={styles.formatOptionTitle}>PDF (Detailed)</Text>
                <Text style={styles.formatOptionDescription}>Professional PDF receipt</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    height: '90%',
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
    marginBottom: 10,
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
    paddingBottom: Math.max(14, insets.bottom),
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  receiptButton: {
    backgroundColor: '#1E3A8A',
  },
  reportButton: {
    borderColor: colors.border,
  },
  formatModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  formatModalContent: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  formatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  formatModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  formatModalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 20,
  },
  formatOptions: {
    gap: 16,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    gap: 16,
  },
  formatOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  formatOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  formatOptionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});