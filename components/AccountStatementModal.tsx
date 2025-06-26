import { Modal, View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface AccountStatementModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function AccountStatementModal({ isVisible, onClose }: AccountStatementModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  const styles = createStyles(colors, isDark, isSmallScreen);
  
  return (
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
              
              <View style={styles.dateInputsContainer}>
                <Pressable style={styles.dateInput}>
                  <Text style={styles.dateInputLabel}>Start Date</Text>
                  <Text style={styles.dateInputValue}>Select date</Text>
                </Pressable>
                
                <Pressable style={styles.dateInput}>
                  <Text style={styles.dateInputLabel}>End Date</Text>
                  <Text style={styles.dateInputValue}>Select date</Text>
                </Pressable>
              </View>
            </View>
            
            <View style={styles.formatContainer}>
              <Text style={styles.sectionTitle}>Format</Text>
              
              <View style={styles.formatOptions}>
                <Pressable style={[styles.formatOption, styles.formatOptionSelected]}>
                  <Text style={[styles.formatOptionText, styles.formatOptionTextSelected]}>PDF</Text>
                </Pressable>
                
                <Pressable style={styles.formatOption}>
                  <Text style={styles.formatOptionText}>CSV</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.generateButton}>
              <Text style={styles.generateButtonText}>Generate Statement</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  dateInputsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.backgroundTertiary,
  },
  dateInputLabel: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateInputValue: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textTertiary,
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
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
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
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  generateButton: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});