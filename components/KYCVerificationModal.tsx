import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle,BadgeCheck, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface KYCVerificationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onStartVerification?: () => void;
}

const { width } = Dimensions.get('window');

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    id: '1',
    question: 'What information do I need to provide in order to start using Planmoni?',
    answer: 'You will need to conduct a live face recognition test, provide your personal information including your full name, date of birth, phone number, and address. You\'ll also need to verify your identity using your BVN (Bank Verification Number) and upload a valid government-issued ID card such as National ID, Passport, or Driver\'s License.',
  },
  {
    id: '2',
    question: 'How long before the process is complete?',
    answer: 'The verification process is typically instant but in rare cases up to 24 hours after you submit all required documents. Our team reviews your information to ensure everything is accurate. You\'ll receive a notification once your verification is complete.',
  },
  {
    id: '3',
    question: 'Is my personal information safe?',
    answer: 'Yes, absolutely. We use industry-standard encryption and security measures to protect your personal information. Your data is stored securely and only used for verification purposes. We are compliant with data protection regulations and never share your information with third parties without your consent.',
  },
  {
    id: '4',
    question: 'What will I get after the verification?',
    answer: 'After successful verification, you\'ll get access to all Planmoni features including creating payout plans, receiving a virtual account number for deposits, higher transaction limits, and the ability to link multiple bank accounts. You\'ll also be able to access advanced financial management tools.',
  },
];

export default function KYCVerificationModal({
  isVisible,
  onClose,
  onStartVerification
}: KYCVerificationModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const styles = createStyles(colors, isDark);

  // Debug log
  useEffect(() => {
    console.log('KYCVerificationModal isVisible:', isVisible);
  }, [isVisible]);

  // Handle slide in/out animation
  useEffect(() => {
    if (isVisible) {
      // Show modal first, then animate in
      setModalVisible(true);
      // Reset animation values
      slideAnim.setValue(Dimensions.get('window').height);
      fadeAnim.setValue(0);
      
      // Slide in from bottom
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      // Slide out to bottom, then hide modal
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide modal after animation completes
        setModalVisible(false);
      });
    }
  }, [isVisible, modalVisible]);

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

  const handleStartVerification = () => {
    haptics.mediumImpact();
    // Call onStartVerification first - it will handle closing the modal
    if (onStartVerification) {
      onStartVerification();
    } else {
      // If no callback, close modal and navigate
      onClose();
      router.push('/kyc-upgrade');
    }
  };

  const toggleItem = (id: string) => {
    haptics.selection();
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Modal
      visible={modalVisible}
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
      animationType="none"
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
        pointerEvents={isVisible && modalVisible ? 'auto' : 'none'}
      >
        {isVisible && modalVisible && (
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        )}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            }
          ]}
          pointerEvents={isVisible && modalVisible ? 'auto' : 'none'}
        >
          {/* Close Button */}
          <Pressable 
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <BadgeCheck size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>Verify your identity</Text>
              <Text style={styles.description}>
                Complete your account verification to access all that Planmoni has to offer
              </Text>
            </View>

            {/* Q&A Sections */}
            <View style={styles.faqContainer}>
              {faqs.map((faq) => {
                const isExpanded = expandedItems.has(faq.id);
                return (
                  <View key={faq.id} style={styles.faqItem}>
                    <Pressable 
                      style={styles.faqQuestionContainer}
                      onPress={() => toggleItem(faq.id)}
                    >
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                      {isExpanded ? (
                        <ChevronUp size={20} color={colors.text} />
                      ) : (
                        <ChevronDown size={20} color={colors.text} />
                      )}
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.faqAnswerContainer}>
                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Sticky Button Container with SafeArea */}
          <SafeAreaView edges={['bottom']} style={styles.stickyButtonContainer}>
            <Pressable 
              style={styles.startButton}
              onPress={handleStartVerification}
            >
              <Text style={styles.startButtonText}>Start verification</Text>
            </Pressable>
            {/* Footer */}
            <Text style={styles.footer}>Powered by Dojah</Text>
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '100%',
    minHeight: 750,
    width: '100%',
    position: 'relative',
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 16,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? colors.text : '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: isDark ? colors.textSecondary : '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  faqContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  faqItem: {
    backgroundColor: colors.accentBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  faqQuestionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? colors.text : '#374151',
    lineHeight: 22,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  faqAnswer: {
    fontSize: 14,
    fontWeight: '400',
    color: isDark ? colors.textSecondary : '#6B7280',
    lineHeight: 20,
  },
  stickyButtonContainer: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: isDark ? colors.border : '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  startButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 20,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 55,
    width: '100%',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    fontSize: 12,
    fontWeight: '400',
    color: isDark ? colors.textSecondary : '#9CA3AF',
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    marginTop: 4,
  },
});

