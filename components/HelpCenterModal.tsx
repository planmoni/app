import { Modal, View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Animated } from 'react-native';
import { X, Search, CircleHelp as HelpCircle, MessageSquare, FileText, ExternalLink } from 'lucide-react-native';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { PanGestureHandler } from 'react-native-gesture-handler';

interface HelpCenterModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DRAG_DISMISS_THRESHOLD = 120;

export default function HelpCenterModal({ isVisible, onClose }: HelpCenterModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  
  const styles = createStyles(colors, isDark, isSmallScreen);
  
  // Mock FAQ data
  const faqs = [
    {
      id: '1',
      question: 'How do I create a payout plan?',
      answer: 'To create a payout plan, go to the Home tab and tap on " New Plan" or the "+" button. Follow the steps to set up your payout schedule and amount.'
    },
    {
      id: '2',
      question: 'How do I add funds to my wallet?',
      answer: 'You can add funds by tapping on "Add Funds" on the Home screen. Choose your preferred payment method and follow the instructions.'
    },
    {
      id: '3',
      question: 'Can I change my payout schedule?',
      answer: 'Yes, you can modify your payout schedule by viewing the payout details and selecting "Edit". Note that changes will apply to future payouts only.'
    },
    {
      id: '4',
      question: 'How do I link a bank account?',
      answer: 'Go to Settings > Linked Bank Accounts and tap "Add New Account". You\'ll need to provide your bank details for verification.'
    },
  ];
  
  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const handleGestureEnd = (event: any) => {
    setDragging(false);
    if (event.nativeEvent.translationY > DRAG_DISMISS_THRESHOLD) {
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        translateY.setValue(0);
        onClose();
      });
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    if (isVisible) {
      translateY.setValue(0);
    }
  }, [isVisible]);

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.centeredView}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onBegan={() => setDragging(true)}
          onEnded={handleGestureEnd}
        >
          <Animated.View style={[styles.modalView, { transform: [{ translateY }] }]}> 
            <View style={styles.header}>
              <Text style={styles.modalTitle}>Help Center</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.searchContainer}>
                <Search size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                <Pressable style={styles.searchInput}>
                  <Text style={styles.searchPlaceholder}>Search for help...</Text>
                </Pressable>
              </View>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                
                {faqs.map(faq => (
                  <Pressable key={faq.id} style={styles.faqItem}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </Pressable>
                ))}
              </View>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Support</Text>
                
                <Pressable style={styles.supportOption}>
                  <View style={styles.supportIconContainer}>
                    <MessageSquare size={isSmallScreen ? 16 : 20} color="#1E3A8A" />
                  </View>
                  <View style={styles.supportInfo}>
                    <Text style={styles.supportTitle}>Chat with Support</Text>
                    <Text style={styles.supportDescription}>Available 24/7</Text>
                  </View>
                  <ExternalLink size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                </Pressable>
                
                <Pressable style={styles.supportOption}>
                  <View style={styles.supportIconContainer}>
                    <FileText size={isSmallScreen ? 16 : 20} color="#22C55E" />
                  </View>
                  <View style={styles.supportInfo}>
                    <Text style={styles.supportTitle}>Submit a Ticket</Text>
                    <Text style={styles.supportDescription}>Get help with complex issues</Text>
                  </View>
                  <ExternalLink size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                </Pressable>
                
                <Pressable style={styles.supportOption}>
                  <View style={styles.supportIconContainer}>
                    <HelpCircle size={isSmallScreen ? 16 : 20} color="#F97316" />
                  </View>
                  <View style={styles.supportInfo}>
                    <Text style={styles.supportTitle}>Knowledge Base</Text>
                    <Text style={styles.supportDescription}>Browse detailed guides</Text>
                  </View>
                  <ExternalLink size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.closeButton2} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </Animated.View>
        </PanGestureHandler>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginBottom: isSmallScreen ? 20 : 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
  },
  searchPlaceholder: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textTertiary,
  },
  section: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: isSmallScreen ? 12 : 16,
  },
  faqItem: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqQuestion: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportIconContainer: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  supportDescription: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeButton2: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});