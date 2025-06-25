import Button from '@/components/Button';
import { router } from 'expo-router';
import { TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

export default function PauseConfirmationScreen() {
  const handleConfirm = () => {
    // Navigate back and pass the pause state
    router.back();
    // Set a timeout to ensure the navigation is complete before sending the message
    setTimeout(() => {
      router.setParams({ updatePauseState: 'true' });
    }, 100);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <AlertTriangle size={32} color="#EF4444" />
        </View>
        
        <Text style={styles.title}>Pause Payout?</Text>
        <Text style={styles.description}>
          Are you sure you want to pause the next payout? Note that you will no longer receive anymore payouts until you Start again.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Yes, Pause Payout"
            onPress={handleConfirm}
            style={styles.confirmButton}
          />
          <Button
            title="No, Keep Active"
            onPress={() => router.back()}
            variant="outline"
            style={styles.cancelButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  confirmButton: {
    backgroundColor: '#EF4444',
  },
  cancelButton: {
    borderColor: '#E2E8F0',
  },
});