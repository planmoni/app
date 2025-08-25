import { Modal, View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView, Alert } from 'react-native';
import { X, Calendar, FileText, Download, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import DateRangeModal from '@/components/DateRangeModal';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

interface AccountStatementModalProps {
  isVisible: boolean;
  onClose: () => void;
}

type Format = 'pdf' | 'csv';

export default function AccountStatementModal({ isVisible, onClose }: AccountStatementModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { session } = useAuth();
  const { transactions, isLoading } = useRealtimeTransactions();
  const haptics = useHaptics();
  const { showToast } = useToast();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // State management
  const [selectedFormat, setSelectedFormat] = useState<Format>('pdf');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isDateRangeModalVisible, setIsDateRangeModalVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const styles = createStyles(colors, isDark, isSmallScreen);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle date range selection
  const handleDateRangeSelect = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setIsDateRangeModalVisible(false);
  };

  // Filter transactions by date range
  const getFilteredTransactions = () => {
    if (!startDate || !endDate) return transactions;
    
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.created_at);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  // Generate CSV content
  const generateCSV = (filteredTransactions: any[]) => {
    const headers = ['Date', 'Type', 'Amount', 'Status', 'Description', 'Reference'];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.created_at).toLocaleDateString(),
      tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
      `₦${tx.amount.toLocaleString()}`,
      tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
      tx.description || '',
      tx.reference || ''
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  };

  // Generate PDF HTML
  const generatePDFHtml = (filteredTransactions: any[], userInfo: any) => {
    const totalDeposits = filteredTransactions
      .filter(tx => tx.type === 'deposit' && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalPayouts = filteredTransactions
      .filter(tx => tx.type === 'payout' && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const currentDate = new Date();
    const printTime = currentDate.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Statement</title>
        <style>
          @page {
            margin: 20px;
            size: A4;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            line-height: 1.4;
            background: white;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            color: rgba(30, 58, 138, 0.05);
            font-weight: bold;
            z-index: -1;
            white-space: nowrap;
          }
          .header {
            text-align: left;
            margin-bottom: 30px;
            border-bottom: 3px solid #1E3A8A;
            padding-bottom: 20px;
            position: relative;
          }
          .logo-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #1E3A8A;
            margin: 0;
          }
          .tagline {
            color: #666;
            font-size: 14px;
            margin: 5px 0 0 0;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1E3A8A;
            margin: 0;
            text-align: center;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            gap: 30px;
          }
          .account-summary {
            flex: 1;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }
          .account-details {
            flex: 1;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #1E3A8A;
            margin-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            align-items: center;
          }
          .info-label {
            font-size: 13px;
            color: #666;
            font-weight: 500;
          }
          .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            text-align: right;
          }
          .amount-positive {
            color: #22C55E;
            font-weight: bold;
          }
          .amount-negative {
            color: #EF4444;
            font-weight: bold;
          }
          .transaction-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          .transaction-table th {
            background-color: #1E3A8A;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #1E3A8A;
          }
          .transaction-table td {
            padding: 10px 8px;
            border: 1px solid #dee2e6;
            vertical-align: top;
          }
          .transaction-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .transaction-table tr:hover {
            background-color: #e9ecef;
          }
          .money-in {
            color: #22C55E;
            font-weight: 600;
          }
          .money-out {
            color: #EF4444;
            font-weight: 600;
          }
          .footer {
            margin-top: 40px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }
          .footer-title {
            font-size: 14px;
            font-weight: bold;
            color: #1E3A8A;
            margin-bottom: 10px;
          }
          .footer-text {
            font-size: 12px;
            color: #666;
            line-height: 1.5;
            margin-bottom: 8px;
          }
          .contact-info {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #dee2e6;
          }
          .contact-title {
            font-size: 13px;
            font-weight: bold;
            color: #1E3A8A;
            margin-bottom: 8px;
          }
          .contact-item {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }
          .page-number {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f8f9fa;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
            border: 1px solid #dee2e6;
          }
        </style>
      </head>
      <body>
        <div class="watermark">Planmoni</div>
        
        <div class="header">
          <div class="logo-section">
            <div>
              <div class="logo">Planmoni</div>
              <div class="tagline">Digital Finance That Fits Your Life</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: #666;">Print Time</div>
              <div style="font-size: 14px; font-weight: 600;">${printTime}</div>
            </div>
          </div>
          <div class="title">Account Statement</div>
        </div>

        <div class="info-section">
          <div class="account-summary">
            <div class="section-title">Account Summary</div>
            <div class="info-row">
              <span class="info-label">Total Money In:</span>
              <span class="info-value amount-positive">₦${totalDeposits.toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Money Out:</span>
              <span class="info-value amount-negative">₦${totalPayouts.toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Transactions:</span>
              <span class="info-value">${filteredTransactions.length}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Completed Transactions:</span>
              <span class="info-value">${filteredTransactions.filter(tx => tx.status === 'completed').length}</span>
            </div>
          </div>
          
          <div class="account-details">
            <div class="section-title">Account Holder Details</div>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value">${userInfo.firstName.toUpperCase()} ${userInfo.lastName.toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${userInfo.email}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Statement Period:</span>
              <span class="info-value">${startDate ? formatDate(startDate) : 'All Time'} - ${endDate ? formatDate(endDate) : 'Present'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Generated On:</span>
              <span class="info-value">${currentDate.toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <table class="transaction-table">
          <thead>
            <tr>
              <th>Transaction Date</th>
              <th>Transaction Detail</th>
              <th>Money In (NGN)</th>
              <th>Money Out (NGN)</th>
              <th>Transaction ID</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.map(tx => {
              const transactionDate = new Date(tx.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              });
              
              const transactionDetail = tx.description || 
                (tx.type === 'deposit' ? 'Wallet Deposit' : 
                 tx.type === 'payout' ? 'Payout Transfer' : 
                 tx.type === 'withdrawal' ? 'Withdrawal' : 'Transaction');
              
              const moneyIn = tx.type === 'deposit' ? `₦${tx.amount.toLocaleString()}` : '';
              const moneyOut = tx.type !== 'deposit' ? `₦${tx.amount.toLocaleString()}` : '';
              
              return `
                <tr>
                  <td>${transactionDate}</td>
                  <td>${transactionDetail}</td>
                  <td class="money-in">${moneyIn}</td>
                  <td class="money-out">${moneyOut}</td>
                  <td>${tx.reference || tx.id}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div class="footer-title">Important Information</div>
          <div class="footer-text">
            This statement contains all transactions within the specified period. The amounts shown may indicate that Planmoni has processed the corresponding payment transaction.
          </div>
          <div class="footer-text">
            Due to system reasons, communication failures and other contingencies, there may be discrepancies between this statement and actual transaction results. The actual transaction situation shall prevail.
          </div>
          <div class="footer-text">
            Due to different statistical logic, the detailed amounts may be inconsistent with the summary amounts. Please refer to the actual transaction amounts.
          </div>
          <div class="footer-text">
            <strong>Important:</strong> The use of this statement for illegal purposes is strictly prohibited. This statement only shows transactions in the current period and is for personal reconciliation purposes only.
          </div>
          
          <div class="contact-info">
            <div class="contact-title">Please reach us via the following contact:</div>
            <div class="contact-item">Website: https://www.planmoni.com</div>
            <div class="contact-item">Email: support@planmoni.com</div>
            <div class="contact-item">Phone: +234 700 000 0000</div>
          </div>
        </div>
        
        <div class="page-number">1</div>
      </body>
      </html>
    `;
  };

  // Generate and download statement
  const handleGenerateStatement = async () => {
    if (!startDate || !endDate) {
      showToast('Please select a date range', 'error');
      return;
    }

    setIsGenerating(true);
    haptics.mediumImpact();

    try {
      const filteredTransactions = getFilteredTransactions();
      const userInfo = {
        firstName: session?.user?.user_metadata?.first_name || '',
        lastName: session?.user?.user_metadata?.last_name || '',
        email: session?.user?.email || ''
      };

      if (selectedFormat === 'pdf') {
        const html = generatePDFHtml(filteredTransactions, userInfo);
        const { uri } = await Print.printToFileAsync({ html });
        
        const fileName = `Planmoni_Statement_${formatDate(startDate)}_${formatDate(endDate)}.pdf`;
        const destPath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: destPath });
        
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(destPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Planmoni Account Statement',
            UTI: 'com.adobe.pdf',
          });
          showToast('PDF statement shared successfully', 'success');
        } else {
          showToast('Sharing not available', 'error');
        }
      } else {
        // CSV format
        const csvContent = generateCSV(filteredTransactions);
        const fileName = `Planmoni_Statement_${formatDate(startDate)}_${formatDate(endDate)}.csv`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(filePath, csvContent);
        
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: 'Planmoni Account Statement',
            UTI: 'public.comma-separated-values-text',
          });
          showToast('CSV statement shared successfully', 'success');
        } else {
          showToast('Sharing not available', 'error');
        }
      }
    } catch (error) {
      console.error('Error generating statement:', error);
      showToast('Failed to generate statement', 'error');
    } finally {
      // Reset generating state immediately
      setIsGenerating(false);
    }
  };

  // Reset dates when modal closes
  useEffect(() => {
    if (!isVisible) {
      setStartDate(null);
      setEndDate(null);
    }
  }, [isVisible]);

  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <View style={styles.centeredView}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.modalView}>
            <View style={styles.header}>
              <Text style={styles.modalTitle}>Account Statement</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.description}>
                Generate and download your account statements in PDF or CSV format.
              </Text>
              
              <View style={styles.dateRangeContainer}>
                <Text style={styles.sectionTitle}>Select Date Range</Text>
                
                <Pressable 
                  style={styles.dateRangeButton}
                  onPress={() => setIsDateRangeModalVisible(true)}
                >
                  <View style={styles.dateRangeButtonContent}>
                    <Calendar size={20} color={colors.primary} />
                    <View style={styles.dateRangeButtonText}>
                      <Text style={styles.dateRangeButtonLabel}>Date Range</Text>
                      <Text style={[
                        styles.dateRangeButtonValue,
                        startDate && endDate && { color: colors.text }
                      ]}>
                        {startDate && endDate 
                          ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                          : 'Select start and end dates'
                        }
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>
                
                {startDate && endDate && (
                  <View style={styles.dateRangeInfo}>
                    <Calendar size={16} color={colors.primary} />
                    <Text style={styles.dateRangeText}>
                      {getFilteredTransactions().length} transactions in selected range
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.formatContainer}>
                <Text style={styles.sectionTitle}>Format</Text>
                
                <View style={styles.formatOptions}>
                  <Pressable 
                    style={[
                      styles.formatOption, 
                      selectedFormat === 'pdf' && styles.formatOptionSelected
                    ]}
                    onPress={() => setSelectedFormat('pdf')}
                  >
                    <FileText size={20} color={selectedFormat === 'pdf' ? colors.primary : colors.text} />
                    <Text style={[
                      styles.formatOptionText, 
                      selectedFormat === 'pdf' && styles.formatOptionTextSelected
                    ]}>
                      PDF
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    style={[
                      styles.formatOption, 
                      selectedFormat === 'csv' && styles.formatOptionSelected
                    ]}
                    onPress={() => setSelectedFormat('csv')}
                  >
                    <Download size={20} color={selectedFormat === 'csv' ? colors.primary : colors.text} />
                    <Text style={[
                      styles.formatOptionText, 
                      selectedFormat === 'csv' && styles.formatOptionTextSelected
                    ]}>
                      CSV
                    </Text>
                  </Pressable>
                </View>
              </View>

              {startDate && endDate && (
                <View style={styles.previewContainer}>
                  <Text style={styles.sectionTitle}>Preview</Text>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewText}>
                      {getFilteredTransactions().length} transactions will be included
                    </Text>
                    <Text style={styles.previewText}>
                      Format: {selectedFormat.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable 
                style={[
                  styles.generateButton,
                  (!startDate || !endDate || isGenerating) && styles.generateButtonDisabled
                ]}
                onPress={handleGenerateStatement}
                disabled={!startDate || !endDate || isGenerating}
              >
                <Text style={styles.generateButtonText}>
                  {isGenerating ? 'Generating...' : 'Generate Statement'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <DateRangeModal
        isVisible={isDateRangeModalVisible}
        onClose={() => setIsDateRangeModalVisible(false)}
        onSelect={handleDateRangeSelect}
        initialStartDate={startDate || undefined}
        initialEndDate={endDate || undefined}
      />
    </>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: isSmallScreen ? 18 : 24,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: '70%',
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 24,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 20 : 24,
    marginBottom: isSmallScreen ? 20 : 24,
  },
  dateRangeContainer: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: isSmallScreen ? 12 : 16,
  },
  dateRangeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.backgroundTertiary,
    marginBottom: 12,
  },
  dateRangeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dateRangeButtonText: {
    flexDirection: 'column',
    flex: 1,
  },
  dateRangeButtonLabel: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dateRangeButtonValue: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  dateRangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderRadius: 8,
  },
  dateRangeText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.primary,
    fontWeight: '500',
  },
  formatContainer: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  formatOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  formatOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    gap: 8,
  },
  formatOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  formatOptionText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
    fontWeight: '500',
  },
  formatOptionTextSelected: {
    color: colors.primary,
  },
  previewContainer: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  previewInfo: {
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  previewText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  generateButton: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
  },
  generateButtonDisabled: {
    backgroundColor: colors.borderSecondary,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',

  },
});