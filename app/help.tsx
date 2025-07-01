import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, MessageSquare, FileText, Mail, Phone, ExternalLink } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import Card from '@/components/Card';
import SafeFooter from '@/components/SafeFooter';

export default function HelpScreen() {
  const { colors, isDark } = useTheme();
  
  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>How can we help you?</Text>
          <Text style={styles.heroSubtitle}>
            Get answers to your questions and learn how to make the most of Planmoni
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          
          <Card style={styles.contactCard}>
            <Pressable style={styles.contactOption}>
              <View style={[styles.contactIcon, { backgroundColor: '#F0F9FF' }]}>
                <MessageSquare size={24} color="#0EA5E9" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>Live Chat</Text>
                <Text style={styles.contactDescription}>Chat with our support team</Text>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.contactOption}>
              <View style={[styles.contactIcon, { backgroundColor: '#F0FDF4' }]}>
                <Mail size={24} color="#22C55E" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>Email Support</Text>
                <Text style={styles.contactDescription}>support@planmoni.com</Text>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.contactOption}>
              <View style={[styles.contactIcon, { backgroundColor: '#FEF3C7' }]}>
                <Phone size={24} color="#D97706" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>Phone Support</Text>
                <Text style={styles.contactDescription}>+234 800 123 4567</Text>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </Pressable>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <Card style={styles.faqCard}>
            <Pressable style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I create a payout plan?</Text>
              <Text style={styles.faqAnswer}>
                To create a payout plan, go to the Home tab and tap on "Plan" or the "+" button. Follow the steps to set up your payout schedule and amount.
              </Text>
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I add funds to my wallet?</Text>
              <Text style={styles.faqAnswer}>
                You can add funds by tapping on "Deposit" on the Home screen. Choose your preferred payment method and follow the instructions.
              </Text>
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Can I change my payout schedule?</Text>
              <Text style={styles.faqAnswer}>
                Yes, you can modify your payout schedule by viewing the payout details and selecting "Edit". Note that changes will apply to future payouts only.
              </Text>
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I link a bank account?</Text>
              <Text style={styles.faqAnswer}>
                Go to Settings {'>'} Linked Bank Accounts and tap "Add New Account". You'll need to provide your bank details for verification.
              </Text>
            </Pressable>
          </Card>
          
          <Pressable style={styles.viewAllFaqButton}>
            <Text style={styles.viewAllFaqText}>View All FAQs</Text>
            <ExternalLink size={16} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>
          
          <Card style={styles.resourcesCard}>
            <Pressable style={styles.resourceItem}>
              <View style={[styles.resourceIcon, { backgroundColor: '#EFF6FF' }]}>
                <FileText size={24} color="#1E3A8A" />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>User Guide</Text>
                <Text style={styles.resourceDescription}>Learn how to use Planmoni</Text>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.resourceItem}>
              <View style={[styles.resourceIcon, { backgroundColor: '#F0FDF4' }]}>
                <FileText size={24} color="#22C55E" />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>Terms of Service</Text>
                <Text style={styles.resourceDescription}>Read our terms and conditions</Text>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </Pressable>
            
            <View style={styles.divider} />
            
            <Pressable style={styles.resourceItem}>
              <View style={[styles.resourceIcon, { backgroundColor: '#F0F9FF' }]}>
                <FileText size={24} color="#0EA5E9" />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>Privacy Policy</Text>
                <Text style={styles.resourceDescription}>Learn how we protect your data</Text>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </Pressable>
          </Card>
        </View>
      </ScrollView>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  heroSection: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
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
  contactCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  faqCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  faqItem: {
    padding: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  viewAllFaqButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  viewAllFaqText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  resourcesCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  resourceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});