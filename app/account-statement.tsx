import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Calendar, FileText, Mail, Clock, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import SafeFooter from '@/components/SafeFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';
import DateRangeModal from '@/components/DateRangeModal';
import Button from '@/components/Button';
import { useAccountStatement } from '@/hooks/useAccountStatement';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

export default function AccountStatementScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const { isLoading, error, status, requestStatement } = useAccountStatement();
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isDateRangeModalVisible, setIsDateRangeModalVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Select date';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const handleDateRangeSelect = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setIsDateRangeModalVisible(false);
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Date Range Required', 'Please select a date range before generating your statement.');
      return;
    }

    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }

    const success = await requestStatement(startDate, endDate);
    
    if (success) {
      setShowSuccess(true);
      // Reset dates after successful generation
      setTimeout(() => {
        setStartDate(null);
        setEndDate(null);
        setShowSuccess(false);
      }, 3000);
    } else {
      Alert.alert(
        'Error',
        error || 'Failed to generate account statement. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const canGenerate = startDate && endDate && !isLoading;
  const requestsRemaining = status ? status.maxRequests - status.requestsToday : 0;

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Generate Account Statement</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <FileText size={24} color={colors.primary} />
          </View>
          <Text style={styles.infoTitle}>Account Statement</Text>
          <Text style={styles.infoDescription}>
            Generate a detailed PDF statement of your account activity for the selected date range. 
            The statement will be sent to your registered email address.
          </Text>
        </View>

        {/* Date Range Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date Range</Text>
          
          <Pressable
            style={[
              styles.dateRangeButton,
              (startDate && endDate) && styles.dateRangeButtonSelected,
              isDateRangeModalVisible && styles.dateRangeButtonActive
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                haptics.lightImpact();
              }
              setIsDateRangeModalVisible(true);
            }}
            disabled={isLoading}
          >
            <View style={styles.dateRangeContent}>
              <Calendar size={20} color={startDate && endDate ? colors.primary : colors.textSecondary} />
              <View style={styles.dateRangeTextContainer}>
                {startDate && endDate ? (
                  <>
                    <Text style={[styles.dateRangeLabel, { color: colors.primary }]}>
                      Selected Range
                    </Text>
                    <Text style={[styles.dateRangeValue, { color: colors.text }]}>
                      {formatDate(startDate)} - {formatDate(endDate)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.dateRangeLabel, { color: colors.textSecondary }]}>
                      Select Date Range
                    </Text>
                    <Text style={[styles.dateRangeHint, { color: colors.textTertiary }]}>
                      Tap to choose start and end dates
                    </Text>
                  </>
                )}
              </View>
            </View>
            <ChevronRight 
              size={20} 
              color={startDate && endDate ? colors.primary : colors.textTertiary} 
            />
          </Pressable>
        </View>

        {/* Request Limit Info */}
        {status && (
          <View style={styles.limitCard}>
            <View style={styles.limitHeader}>
              <Clock size={18} color={colors.textSecondary} />
              <Text style={styles.limitTitle}>Daily Request Limit</Text>
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitText}>
                {status.requestsToday} of {status.maxRequests} requests used today
              </Text>
              {!status.canRequest && (
                <Text style={styles.limitWarning}>
                  You've reached your daily limit. Please try again tomorrow.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Success Message */}
        {showSuccess && (
          <View style={styles.successCard}>
            <Mail size={24} color="#22C55E" />
            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Statement Generated!</Text>
              <Text style={styles.successText}>
                Your account statement has been sent to your email address.
              </Text>
            </View>
          </View>
        )}

        {/* Error Message */}
        {error && !showSuccess && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <View style={styles.instructionBullet} />
              <Text style={styles.instructionText}>
                Select a start date and end date for your statement
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <View style={styles.instructionBullet} />
              <Text style={styles.instructionText}>
                Click "Generate Statement" to create your PDF
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <View style={styles.instructionBullet} />
              <Text style={styles.instructionText}>
                Your statement will be emailed to you within minutes
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.footer}>
        <Button
          title={isLoading ? 'Generating...' : 'Generate Statement'}
          onPress={handleGenerate}
          disabled={!canGenerate || isLoading || (status && !status.canRequest)}
          loading={isLoading}
        />
      </View>
      
      <SafeFooter />

      {/* Date Range Modal */}
      {isDateRangeModalVisible && (
        <DateRangeModal
          isVisible={isDateRangeModalVisible}
          onClose={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            setIsDateRangeModalVisible(false);
          }}
          onSelect={handleDateRangeSelect}
          initialStartDate={startDate || undefined}
          initialEndDate={endDate || undefined}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSecondary,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  dateRangeButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderSecondary,
  },
  dateRangeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  dateRangeButtonActive: {
    borderColor: colors.primary,
  },
  dateRangeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateRangeTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  dateRangeValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  dateRangeHint: {
    fontSize: 13,
  },
  limitCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderSecondary,
  },
  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  limitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  limitInfo: {
    marginTop: 8,
  },
  limitText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  limitWarning: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  successContent: {
    marginLeft: 12,
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  successText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    lineHeight: 18,
  },
  instructionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  footer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSecondary,
  },
});

