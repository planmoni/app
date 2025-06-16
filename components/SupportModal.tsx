import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import { X, Send, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface SupportModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function SupportModal({ isVisible, onClose }: SupportModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // State for form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  
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
            <Text style={styles.modalTitle}>Contact Support</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={isSmallScreen ? 20 : 24} color={colors.text} />
            </Pressable>
          </View>
          
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconContainer}>
              <MessageSquare size={isSmallScreen ? 32 : 40} color={colors.primary} />
            </View>
            
            <Text style={styles.description}>
              Get in touch with our support team for assistance with your account or transactions.
            </Text>
            
            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryContainer}>
                  {['Account', 'Payment', 'Payout', 'Technical'].map((cat) => (
                    <Pressable 
                      key={cat}
                      style={[
                        styles.categoryOption,
                        category === cat && styles.categoryOptionSelected
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[
                        styles.categoryText,
                        category === cat && styles.categoryTextSelected
                      ]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter subject"
                  placeholderTextColor={colors.textTertiary}
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your issue in detail"
                  placeholderTextColor={colors.textTertiary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>
            </View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                Our support team typically responds within 24 hours. For urgent issues, please call our support line at +234 800 123 4567.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.submitButton} onPress={onClose}>
              <Text style={styles.submitButtonText}>Submit Ticket</Text>
              <Send size={isSmallScreen ? 16 : 20} color="#FFFFFF" />
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
    alignItems: 'center',
  },
  iconContainer: {
    width: isSmallScreen ? 64 : 80,
    height: isSmallScreen ? 64 : 80,
    borderRadius: isSmallScreen ? 32 : 40,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 16 : 20,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 20 : 24,
    marginBottom: isSmallScreen ? 20 : 24,
  },
  form: {
    width: '100%',
    marginBottom: isSmallScreen ? 16 : 20,
  },
  formGroup: {
    marginBottom: isSmallScreen ? 16 : 20,
  },
  label: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
  },
  textArea: {
    minHeight: isSmallScreen ? 100 : 120,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: isSmallScreen ? 70 : 80,
    alignItems: 'center',
  },
  categoryOptionSelected: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.text,
  },
  categoryTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  infoText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});