import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Building2, CreditCard, Smartphone } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import SafeFooter from '@/components/SafeFooter';

type PaymentMethod = {
  id: string;
  type: 'bank' | 'card';
  title: string;
  subtitle: string;
  icon: any;
  isDefault?: boolean;
};

export default function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>('1');

  const savedMethods: PaymentMethod[] = [
    {
      id: '1',
      type: 'bank',
      title: 'GTBank •••• 6721',
      subtitle: 'Default',
      icon: Building2,
      isDefault: true,
    },
    {
      id: '2',
      type: 'card',
      title: 'Visa •••• 9087',
      subtitle: 'Make Default',
      icon: CreditCard,
    },
  ];

  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId);
  };

  const handleContinue = () => {
    if (selectedMethodId) {
      const selectedMethod = savedMethods.find(method => method.id === selectedMethodId);
      router.replace({
        pathname: '/deposit-flow/amount',
        params: {
          methodId: selectedMethodId,
          methodTitle: selectedMethod?.title
        }
      });
    }
  };

  const handleAddCard = () => {
    router.push('/add-card');
  };

  const handleAddUSSD = () => {
    router.push('/add-ussd');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
        <Text style={styles.stepText}>Step 1 of 3</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Select Payment Method</Text>
        <Text style={styles.description}>Choose your preferred payment option to add funds.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Payment Methods</Text>
          
          {savedMethods.map((method) => (
            <Pressable 
              key={method.id}
              style={[
                styles.paymentMethod,
                selectedMethodId === method.id && styles.selectedMethod
              ]}
              onPress={() => handleMethodSelect(method.id)}
            >
              <View style={styles.methodLeft}>
                <View style={styles.methodIconContainer}>
                  <method.icon size={24} color={colors.primary} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodTitle}>{method.title}</Text>
                  <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
                </View>
              </View>
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radioOuter,
                  selectedMethodId === method.id && styles.radioOuterSelected
                ]}>
                  {selectedMethodId === method.id && (
                    <View style={styles.radioInner} />
                  )}
                </View>
                <ChevronRight size={20} color={colors.textTertiary} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Payment Method</Text>
          
          <Pressable 
            style={styles.newMethodButton}
            onPress={handleAddCard}
          >
            <View style={styles.methodLeft}>
              <View style={styles.methodIconContainer}>
                <CreditCard size={24} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Debit/Credit Card</Text>
                <Text style={styles.methodSubtitle}>Visa, Mastercard, Verve</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.newMethodButton}
            onPress={handleAddUSSD}
          >
            <View style={styles.methodLeft}>
              <View style={styles.methodIconContainer}>
                <Smartphone size={24} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>USSD</Text>
                <Text style={styles.methodSubtitle}>Use USSD Code to pay</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Continue"
          onPress={handleContinue}
          style={styles.continueButton}
          disabled={!selectedMethodId}
        />
      </View>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedMethod: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    marginLeft: 0,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  methodSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderSecondary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  newMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
});