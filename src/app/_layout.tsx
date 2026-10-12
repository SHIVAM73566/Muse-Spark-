/**
 * RootLayout Component
 *
 * App-wide navigation shell:
 * - ThemeProvider: light/dark system color scheme synchronization
 * - Stack Navigator: headerless screen transitions
 * - StatusBar: dark icons on clean white surface
 */

import React from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { ToastProvider } from '@/context/ToastContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="tools" options={{ headerShown: false, animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="dark" />
      </ToastProvider>
    </ThemeProvider>
  );
}
