import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { BRAND } from '@/constants/brand';
import { Colors } from '@/constants/colors';
import { completeSupabaseOAuthCallback } from '@/lib/oauthCallback';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedUrl = useRef<string | null>(null);

  useEffect(() => {
    const callbackUrl =
      incomingUrl ??
      (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null);

    if (!callbackUrl || processedUrl.current === callbackUrl) return;
    processedUrl.current = callbackUrl;

    void completeSupabaseOAuthCallback(callbackUrl)
      .then(() => router.replace('/(tabs)/chat'))
      .catch((error: unknown) => {
        console.error('[auth/callback] OAuth callback failed:', error);
        setErrorMessage(
          'Sign-in could not be completed. Check the Google provider and redirect URL settings, then try again.'
        );
      });
  }, [incomingUrl, router]);

  return (
    <View style={styles.container}>
      {errorMessage ? (
        <Text style={styles.message}>{errorMessage}</Text>
      ) : (
        <>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.message}>Completing sign-in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: BRAND.colors.background,
  },
  message: {
    marginTop: 16,
    color: Colors.iconDark,
    textAlign: 'center',
  },
});
