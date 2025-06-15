import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import DotLottieLoader from '@/components/DotLottieLoader';
import LoadingScreen from '@/components/LoadingScreen';

export default function LoaderDemoScreen() {
  const { colors } = useTheme();
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()} 
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Loader Demo</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>DotLottie Loader</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          A beautiful animated loader using the DotLottie format
        </Text>
        
        <View style={styles.loaderContainer}>
          <DotLottieLoader size={200} />
        </View>
        
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Note: This loader uses the DotLottie format which is optimized for web. 
          On native platforms, a fallback loader is displayed.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 300,
  },
  loaderContainer: {
    marginBottom: 40,
  },
  note: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 300,
  },
});