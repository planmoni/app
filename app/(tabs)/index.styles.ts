import { StyleSheet, Platform } from 'react-native';
import { getScaledFontSize } from '@/lib/textSize';

export const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.09,
    shadowRadius: 9,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  gradientContainer: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  gradientContent: {
    paddingBottom: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarButton: {
    borderRadius: 24,
    overflow: 'visible',
  },
  whiteAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#153875',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C3F57E',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarAppIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  loginButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  loginButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    marginTop: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  greeting: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 17, textSizeMultiplier),
    fontWeight: '500',
    color: isDark ? '#fff' : '#000',
    flex: 1,
  },
  subGreeting: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    fontWeight: '400',
    color: colors.backgroundSecondary,
    lineHeight: 18,
  },
  balanceCard: {
    borderRadius: 20,
    backgroundColor: isDark ? colors.card : '#fff',
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: isDark ? '#29323E' : '#E2E8F0',
  },
  balanceCardContent: {
    paddingVertical: Platform.OS === 'ios' ? 16 : 15,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 15,
  },
  balanceHeaderPressable: {
    width: '100%',
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  historyButton: {
    padding: 4,
  },
  eyeIconButton: {
    padding: 4,
  },
  balanceAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 45 : 40, textSizeMultiplier),
    fontWeight: '700',
    color: isDark ? '#fff' : colors.primary,
    marginBottom: -15,
    marginTop: 10,
  },
  lockedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    marginBottom: 12,
  },
  lockedLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '400',
  },
  lockedAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 1,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: isDark ? colors.card : colors.primary,
    paddingHorizontal: Platform.OS === 'ios' ? 15 : 12,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 50,
    minHeight: Platform.OS === 'ios' ? 44 : 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: isDark ? '#fff' : '#C3F57E',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 14, textSizeMultiplier),
    fontWeight: '500',
    marginLeft: 6,
  },
  addFundsButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: isDark ? colors.card : '#F7F7F7',
    paddingHorizontal: Platform.OS === 'ios' ? 15 : 12,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    borderRadius: 50,
    minHeight: Platform.OS === 'ios' ? 44 : 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFundsText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 14, textSizeMultiplier),
    fontWeight: '500',
    marginLeft: 6,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  bottomPadding: {
    height: 40,
  },
  stickyButtons: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
});
