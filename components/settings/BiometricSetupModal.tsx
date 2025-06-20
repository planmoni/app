import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  Platform,
  Pressable
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BiometricSetup } from '@/components/biometrics/BiometricSetup';

interface BiometricSetupModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function BiometricSetupModal({ isVisible, onClose }: BiometricSetupModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get('window');
  
  // Animation values
  const [modalAnimation] = useState(new Animated.Value(height));
  const [backdropAnimation] = useState(new Animated.Value(0));
  
  useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.parallel([
        Animated.timing(backdropAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalAnimation, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(backdropAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalAnimation, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, height, modalAnimation, backdropAnimation]);
  
  const handleClose = () => {
    // Animate out before calling onClose
    Animated.parallel([
      Animated.timing(backdropAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalAnimation, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };
  
  const styles = createStyles(colors, isDark, insets);
  
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: backdropAnimation }
        ]}
      >
        <Pressable 
          style={styles.backdrop} 
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: modalAnimation }],
              paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Biometric Authentication</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleClose}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.content}>
            <BiometricSetup />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
});