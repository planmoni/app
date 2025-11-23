import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, Home, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';

interface AccountCreationSuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  firstName: string;
  lastName: string;
  email: string;
  onStartVerification: () => void;
  onGoToDashboard: () => void;
}

export default function AccountCreationSuccessModal({
  isVisible,
  onClose,
  firstName,
  lastName,
  email,
  onStartVerification,
  onGoToDashboard
}: AccountCreationSuccessModalProps) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const styles = createStyles(colors);

  const handleStartVerification = () => {
    haptics.mediumImpact();
    onStartVerification();
  };

  const handleGoToDashboard = () => {
    haptics.lightImpact();
    onGoToDashboard();
  };

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <Pressable 
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>
          
          <View style={styles.content}>
            <SuccessAnimation />
            
            <Text style={styles.title}>Congratulations, {firstName}!</Text>
            <Text style={styles.subtitle}>
              Your account has been successfully created. Get verified in order to receive a virtual account number for deposits.
            </Text>
            
            <View style={styles.buttonContainer}>
              <Button
                title="Start Verification"
                onPress={handleStartVerification}
                style={styles.primaryButton}
                icon={ArrowRight}
                hapticType="medium"
              />
              
              <Button
                title="Go to Dashboard"
                onPress={handleGoToDashboard}
                variant="outline"
                style={styles.secondaryButton}
                icon={Home}
                hapticType="light"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    borderColor: colors.border,
  },
}); 