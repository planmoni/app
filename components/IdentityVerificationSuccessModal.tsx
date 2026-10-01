import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { X, Wallet } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { router } from 'expo-router';

interface IdentityVerificationSuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function IdentityVerificationSuccessModal({
  isVisible,
  onClose,
}: IdentityVerificationSuccessModalProps) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const styles = createStyles(colors);

  const handleAddFunds = () => {
    haptics.mediumImpact();
    onClose();
    router.push('/add-funds');
  };

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
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
            
            <Text style={styles.title}>Your Identity has been verified and your account has been created.</Text>
            
            <View style={styles.buttonContainer}>
              <Button
                title="Add Funds"
                onPress={handleAddFunds}
                variant="primary"
                style={styles.primaryButton}
                icon={Wallet}
                hapticType="medium"
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 28,
    width: '100%',
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
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 32,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 28,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
});

