import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarCheck, ChevronDown, ChevronUp, X, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface NewPlanInfoModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAddFunds?: () => void;
  onAddFundsAfterClose?: () => void;
}

const { width } = Dimensions.get('window');

interface InfoItem {
  id: string;
  question: string;
  answer: string;
}

const infoItems: InfoItem[] = [
  {
    id: '1',
    question: 'How do I create a payment plan?',
    answer: 'Creating a payment plan is simple! First, add funds to your wallet. Then, set the amount you want to receive, choose how often you want to receive it (daily, weekly, or monthly), and select the time, Your money will be automatically credited to your account according to your schedule.',
  },
  {
    id: '2',
    question: 'What happens to my money in a payout plan?',
    answer: 'Your money is safely locked in your payout plan until the payout date you set. You can view your plan progress anytime, and once the payout date arrives, the funds will be automatically released to your available balance.',
  },
  {
    id: '3',
    question: 'Can I cancel my payout plan?',
    answer: 'Yes! You can view and manage all your payout plans , cancel it anytime via emergency withdrawal option. Please note that you will be charged a fee for this.',
  },
  {
    id: '4',
    question: 'How do I add funds to create a plan?',
    answer: 'You can add funds using bank transfer Simply tap the "Add funds" button to claim your account number and send funds to to it. Once funds are added, you can create your payout plan.',
  },
];

export default function NewPlanInfoModal({
  isVisible,
  onClose,
  onAddFunds,
  onAddFundsAfterClose
}: NewPlanInfoModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const styles = createStyles(colors, isDark);

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

  const handleAddFunds = () => {
    haptics.mediumImpact();
    
    // For unauthenticated users, redirect to login
    if (!isAuthenticated) {
      onClose();
      setTimeout(() => {
        requireAuth(() => {}, '/(tabs)/index');
      }, 400);
      return;
    }
    
    // Close modal and navigate to create payout amount screen
    onClose();
    setTimeout(() => {
      router.push('/create-payout/amount');
    }, 400);
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
                <CalendarCheck size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>Create Your First Plan</Text>
              <Text style={styles.description}>
                Learn how payment plans work and start receiving your funds according to your schedule
              </Text>
            </View>

            {/* Info Sections */}
            <View style={styles.infoContainer}>
              {infoItems.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                return (
                  <View key={item.id} style={styles.infoItem}>
                    <Pressable 
                      style={styles.infoQuestionContainer}
                      onPress={() => toggleItem(item.id)}
                    >
                      <Text style={styles.infoQuestion}>{item.question}</Text>
                      {isExpanded ? (
                        <ChevronUp size={20} color={colors.text} />
                      ) : (
                        <ChevronDown size={20} color={colors.text} />
                      )}
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.infoAnswerContainer}>
                        <Text style={styles.infoAnswer}>{item.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Sticky Button Container with SafeArea */}
          <SafeAreaView edges={['bottom']} style={styles.stickyButtonContainer}>
            <Button
              title={isAuthenticated ? "Create Plan" : "Login to Create Plans"}
              onPress={handleAddFunds}
              hapticType="medium"
              variant="primary"
            />
            {/* Footer */}
            <Text style={styles.footer}>Control your finances with ease.</Text>
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
    maxHeight: '95%',
    minHeight: 660,
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
  infoContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  infoItem: {
    backgroundColor: colors.accentBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoQuestionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  infoQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? colors.text : '#374151',
    lineHeight: 22,
  },
  infoAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  infoAnswer: {
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
    alignItems: 'center',
    flexShrink: 0,
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

