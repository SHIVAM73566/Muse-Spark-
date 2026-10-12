import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  '';

/**
 * Check if Supabase environment configuration is set up.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !/your_|placeholder/i.test(supabaseUrl) &&
    !/your_|placeholder/i.test(supabaseAnonKey)
);

const isWebServer = Platform.OS === 'web' && typeof window === 'undefined';

/**
 * Single Supabase client instance for interacting with database and authentication.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage:
        Platform.OS === 'web'
          ? typeof window === 'undefined'
            ? undefined
            : window.localStorage
          : AsyncStorage,
      persistSession: !isWebServer,
      autoRefreshToken: !isWebServer,
      detectSessionInUrl: false,
    },
  }
);
