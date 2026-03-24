import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import Constants from 'expo-constants';

const scheme = Constants.expoConfig?.scheme ?? 'myapp';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const monoRedirectPath = '/functions/v1/mono-redirect';

function parseQueryParams(url: string): { reference: string; status: string; reason: string } | null {
  try {
    const q = url.indexOf('?');
    if (q === -1) return null;
    const queryPart = url.slice(q + 1);
    const params: Record<string, string> = {};
    queryPart.split('&').forEach((pair) => {
      const eq = pair.indexOf('=');
      const k = eq >= 0 ? decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' ')) : '';
      const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
      if (k) params[k] = v;
    });
    if (!params.reference && !params.status) return null;
    return {
      reference: params.reference ?? '',
      status: params.status ?? '',
      reason: params.reason ?? '',
    };
  } catch {
    return null;
  }
}

/** Check if URL is our HTTPS redirect endpoint (so we can intercept and avoid loading HTML in WebView) */
function isMonoRedirectUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes(monoRedirectPath) || (!!supabaseUrl && url.startsWith(supabaseUrl.replace(/\/$/, '') + monoRedirectPath));
}

/**
 * Parse app deep link: myapp://deposit-flow/callback?reference=...&status=...
 * @see https://docs.mono.co/api/directpay/redirect-urls#overview
 */
function parseRedirectParams(url: string): { reference: string; status: string; reason: string } | null {
  try {
    if (!url.startsWith(scheme + '://')) return null;
    const withoutScheme = url.replace(scheme + '://', '');
    const [pathPart, queryPart] = withoutScheme.split('?');
    const hasCallback = pathPart.includes('callback') || pathPart.includes('deposit-flow');
    if (!hasCallback && !queryPart) return null;
    const params: Record<string, string> = {};
    if (queryPart) {
      queryPart.split('&').forEach((pair) => {
        const eq = pair.indexOf('=');
        const k = eq >= 0 ? decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' ')) : '';
        const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
        if (k) params[k] = v;
      });
    }
    if (!params.reference && !params.status) return null;
    return {
      reference: params.reference ?? '',
      status: params.status ?? '',
      reason: params.reason ?? '',
    };
  } catch {
    return null;
  }
}

export default function MonoDirectPayWidgetScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{ monoUrl: string }>();
  const monoUrl = params.monoUrl ?? '';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasHandledRedirect = useRef(false);
  const loadErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const redirectPrefix = `${scheme}://`;

  const handleBack = useCallback(() => {
    haptics.lightImpact();
    router.back();
  }, [haptics]);

  const navigateToCallback = useCallback((reference: string, status: string, reason: string) => {
    if (hasHandledRedirect.current) return;
    hasHandledRedirect.current = true;
    if (loadErrorTimeoutRef.current) {
      clearTimeout(loadErrorTimeoutRef.current);
      loadErrorTimeoutRef.current = null;
    }
    router.replace({
      pathname: '/deposit-flow/callback',
      params: { reference, status, reason },
    });
  }, []);

  const handleRedirect = useCallback((url: string) => {
    const parsed = parseRedirectParams(url);
    if (!parsed) return;
    navigateToCallback(parsed.reference, parsed.status, parsed.reason);
  }, [navigateToCallback]);

  // When app is opened via deep link (e.g. Mono redirect), handle it
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = parseRedirectParams(url);
        if (parsed) navigateToCallback(parsed.reference, parsed.status, parsed.reason);
      }
    });
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = parseRedirectParams(event.url);
      if (parsed) navigateToCallback(parsed.reference, parsed.status, parsed.reason);
    });
    return () => sub.remove();
  }, [navigateToCallback]);

  // PostMessage from our HTTPS redirect page (mono-redirect Edge Function)
  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data && data.type === 'mono_redirect') {
          navigateToCallback(
            data.reference ?? '',
            data.status ?? '',
            data.reason ?? ''
          );
        }
      } catch (_) {
        // ignore invalid JSON
      }
    },
    [navigateToCallback]
  );

  // Defer error: WebView often fires onError when Mono redirects to myapp:// (custom scheme).
  // Give redirect handlers time to run first so we don't show error after a successful payment.
  const handleLoadError = useCallback(() => {
    if (hasHandledRedirect.current) return;
    if (loadErrorTimeoutRef.current) clearTimeout(loadErrorTimeoutRef.current);
    loadErrorTimeoutRef.current = setTimeout(() => {
      loadErrorTimeoutRef.current = null;
      if (hasHandledRedirect.current) return;
      setLoadError('Could not load payment page. Check your connection and try again.');
    }, 2000);
  }, []);

  useEffect(() => () => {
    if (loadErrorTimeoutRef.current) clearTimeout(loadErrorTimeoutRef.current);
  }, []);

  const onShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const url = request.url;
      if (isMonoRedirectUrl(url)) {
        const parsed = parseQueryParams(url);
        if (parsed) {
          navigateToCallback(parsed.reference, parsed.status, parsed.reason);
          return false;
        }
      }
      if (url.startsWith(redirectPrefix) && parseRedirectParams(url)) {
        handleRedirect(url);
        return false;
      }
      return true;
    },
    [handleRedirect, navigateToCallback]
  );

  const onNavigationStateChange = useCallback(
    (navState: { url: string }) => {
      const url = navState.url;
      if (url && isMonoRedirectUrl(url)) {
        const parsed = parseQueryParams(url);
        if (parsed) navigateToCallback(parsed.reference, parsed.status, parsed.reason);
        return;
      }
      if (url && parseRedirectParams(url)) {
        handleRedirect(url);
      }
    },
    [handleRedirect, navigateToCallback]
  );

  if (loadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Pay with Bank</Text>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{loadError}</Text>
          <Text style={[styles.errorHint, { color: colors.textTertiary }]}>
            If you already completed payment, go to Dashboard and check your balance.
          </Text>
          <Pressable
            style={[styles.tryAgainButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setLoadError(null);
              handleBack();
            }}
          >
            <Text style={[styles.tryAgainText, { color: '#fff' }]}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.backLink} onPress={() => router.replace('/(tabs)')}>
            <Text style={[styles.backLinkText, { color: colors.primary }]}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!monoUrl) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Pay with Bank</Text>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Missing payment link. Go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Pay with Bank</Text>
      </View>
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <WebView
        source={{ uri: monoUrl }}
        style={[styles.webview, loading && styles.webviewHidden]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={handleLoadError}
        onHttpError={() => handleLoadError()}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        sharedCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        startInLoadingEnabled={false}
        scalesPageToFit
      />
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  webviewHidden: {
    opacity: 0,
  },
  loadingWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  tryAgainButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
