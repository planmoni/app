// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import React from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   Pressable,
//   Platform,
// } from 'react-native';
// import { ChevronRight } from 'lucide-react-native';
// import { router } from 'expo-router';
// import { useTheme } from '@/contexts/ThemeContext';
// import { useTextSize } from '@/contexts/TextSizeContext';
// import { getScaledFontSize } from '@/lib/textSize';
// import { useHaptics } from '@/hooks/useHaptics';
// import { useRequireAuth } from '@/hooks/useRequireAuth';
// 
// const CARD_WIDTH = 200;
// const CARD_SPACING = 12;
// 
// const FAQ_ITEMS: string[] = [
//   'How do payout plans work?',
//   'Who is Planmoni for?',
//   'How do I set up a payout?',
//   'When do I receive my payouts?',
//   'What happens once a payout is created?',
//   'What schedules are available?',
//   'How do I add a payout account?',
// ];
// 
// interface LearnWithPlanmoniCarouselProps {
//   onUnauthenticatedPress?: () => void;
// }
// 
// export default function LearnWithPlanmoniCarousel({ onUnauthenticatedPress }: LearnWithPlanmoniCarouselProps) {
//   const { colors, isDark } = useTheme();
//   const { textSizeMultiplier } = useTextSize();
//   const { impact } = useHaptics();
//   const { requireAuth, isAuthenticated } = useRequireAuth();
// 
//   const handleFaqPress = (question: string) => {
//     if (!isAuthenticated) {
//       onUnauthenticatedPress?.();
//       return;
//     }
//     impact();
//     router.push({
//       pathname: '/(tabs)/ai-assistant',
//       params: { query: question },
//     });
//   };
// 
//   const styles = createStyles(colors, isDark, textSizeMultiplier);
// 
//   return (
//     <View style={styles.container}>
//       <View style={styles.titleContainer}>
//         <Text style={styles.sectionTitle}>Learn with Planmoni AI</Text>
//       </View>
//       <ScrollView
//         horizontal
//         showsHorizontalScrollIndicator={false}
//         snapToInterval={CARD_WIDTH + CARD_SPACING}
//         decelerationRate="fast"
//         contentContainerStyle={styles.scrollContent}
//       >
//         {FAQ_ITEMS.map((question, index) => (
//           <Pressable
//             key={`faq-${index}`}
//             style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}
//             onPress={() => handleFaqPress(question)}
//           >
//             <Text style={[styles.faqText, { color: colors.text }]} numberOfLines={3}>
//               {question}
//             </Text>
//             <View style={styles.arrowContainer}>
//               <ChevronRight size={18} color={colors.primary} />
//             </View>
//           </Pressable>
//         ))}
//       </ScrollView>
//     </View>
//   );
// }
// 
// const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
//   StyleSheet.create({
//     container: {
//       marginTop: 5,
//       marginBottom: 15,
//     },
//     titleContainer: {
//       marginBottom: 10,
//       paddingHorizontal: 4,
//     },
//     sectionTitle: {
//       fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 13, textSizeMultiplier),
//       fontWeight: '500',
//       color: colors.text,
//     },
//     scrollContent: {
//       paddingHorizontal: 5,
//     },
//     faqCard: {
//       width: CARD_WIDTH,
//       marginRight: CARD_SPACING,
//       borderRadius: 12,
//       padding: 12,
//       borderWidth: 0.5,
//       minHeight: 72,
//       justifyContent: 'space-between',
//     },
//     faqText: {
//       fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
//       fontWeight: '500',
//       flex: 1,
//     },
//     arrowContainer: {
//       alignSelf: 'flex-end',
//       marginTop: 6,
//     },
//   });
// 
