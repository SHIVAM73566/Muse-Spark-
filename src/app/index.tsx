/**
 * Sign In Screen Route ('/')
 *
 * All-in-one onboarding & Google Sign-in screen:
 * - Center: MuseSpark wordmark on the brand navy surface
 * - Bottom: Full-width Google Sign-in action button with SVG brand mark & press feedback
 */

import { BRAND } from '@/constants/brand';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { completeSupabaseOAuthCallback } from '@/lib/oauthCallback';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
/**
 * 4-Color Official Google Brand SVG Icon
 */
const GoogleBrandIcon = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
);

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/(tabs)/chat');
      }
    }).catch((error: unknown) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to check your sign-in status.'
      );
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        'Sign-in is not configured. Add your Supabase project URL and anon key to .env, then restart Expo.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;

      await completeSupabaseOAuthCallback(result.url);
      router.replace('/(tabs)/chat');
    } catch (error) {
      console.error('[auth] Google sign-in failed:', error);
      setErrorMessage(getGoogleSignInErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* MuseSpark brand wordmark */}
        <View style={styles.logoWrapper}>
          <Image
            source={BRAND.logo}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel={BRAND.name}
          />
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
        </View>

        {/* Bottom Action: Google Sign-In Button */}
        <View style={styles.actionContainer}>
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading || !isSupabaseConfigured}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
              !isSupabaseConfigured && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            accessibilityState={{ disabled: loading || !isSupabaseConfigured }}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.buttonContent}>
                <View style={styles.iconWrapper}>
                  <GoogleBrandIcon size={22} />
                </View>
                <Text style={styles.buttonText}>Sign in with Google</Text>
              </View>
            )}
          </Pressable>
          {!isSupabaseConfigured && (
            <Text style={styles.configurationMessage}>
              Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY to your .env file, then restart Expo.
            </Text>
          )}
          {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getGoogleSignInErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return 'Google sign-in is disabled in Supabase. Enable Google under Authentication → Providers and configure its OAuth Client ID and Client Secret.';
  }
  if (/cancel|dismiss/i.test(message)) {
    return 'Google sign-in was cancelled. Try again when you are ready.';
  }
  return 'Google sign-in failed. Check your Supabase OAuth settings and redirect URLs, then try again.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoWrapper: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  logoImage: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 360 / 93,
  },
  tagline: {
    color: BRAND.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    height: 54,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderFocus,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  configurationMessage: {
    marginTop: 12,
    color: Colors.brandTextSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 12,
    color: Colors.error,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
