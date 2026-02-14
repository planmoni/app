import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { usePayoutPlanShare } from '@/hooks/usePayoutPlanShare';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';

interface AddPayoutPlanByCodeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateNewPlan?: () => void;
}

export default function AddPayoutPlanByCodeModal({
  isVisible,
  onClose,
  onSuccess,
  onCreateNewPlan,
}: AddPayoutPlanByCodeModalProps) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const { getPlanByShareCode, pairToPlan, isLoading: isAddingByCode } = usePayoutPlanShare();
  const { showToast } = useToast();
  const [planCodeInput, setPlanCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      setPlanCodeInput('');
      setError(null);
    }
  }, [isVisible]);

  const handleAddByCode = async () => {
    const code = planCodeInput.trim();
    if (!code) {
      setError('Enter a plan code');
      return;
    }
    setError(null);
    const plan = await getPlanByShareCode(code);
    if (!plan.found) {
      setError(plan.error || 'Invalid or expired code');
      return;
    }
    if (plan.is_owner) {
      setError('You already own this plan');
      return;
    }
    if (plan.is_paired) {
      setError("You're already following this plan");
      return;
    }
    if (!plan.id) {
      setError('Could not add plan');
      return;
    }
    const success = await pairToPlan(plan.id);
    if (success) {
      onClose();
      setPlanCodeInput('');
      showToast('Plan added. You can now track it with your other plans.');
      onSuccess?.();
    } else {
      setError('Failed to add plan. Try again.');
    }
  };

  const handleCreateNewPlan = () => {
    haptics.mediumImpact();
    onClose();
    onCreateNewPlan?.();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.content, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Add payout plan</Text>
            <Pressable onPress={() => { haptics.lightImpact(); onClose(); }} hitSlop={12}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Enter plan code</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g. ABC12XYZ"
            placeholderTextColor={colors.textTertiary}
            value={planCodeInput}
            onChangeText={(t) => { setPlanCodeInput(t.toUpperCase()); setError(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}
          <Button
            title="Add"
            onPress={handleAddByCode}
            isLoading={isAddingByCode}
            style={styles.addButton}
          />
          {onCreateNewPlan ? (
            <Pressable onPress={handleCreateNewPlan} style={styles.createNewLink}>
              <Text style={[styles.createNewLinkText, { color: colors.primary }]}>Create new payout plan</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
  },
  addButton: {
    marginTop: 4,
    marginBottom: 16,
  },
  createNewLink: {
    alignSelf: 'center',
  },
  createNewLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
