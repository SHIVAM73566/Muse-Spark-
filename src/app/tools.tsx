/**
 * Tools & Connections Screen ('/tools')
 *
 * Minimal list view for tool connections under Settings:
 * - Uncategorized flat list ("Show All")
 * - Displays Tool Icon, Name, and Connect/Disconnect/Manage actions
 * - Real backend Composio OAuth linking flow with polling and AppState auto-refresh
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import RefreshIcon from '@hugeicons/core-free-icons/RefreshIcon';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  fetchToolsWithUserConnection,
  getBundledToolCatalog,
  startToolConnectionApi,
  checkToolConnectionStatusApi,
  disconnectToolApi,
} from '@/services/tools';
import { ToolWithConnection } from '@/types/tools';
import { ToolCard } from '@/components/tools/ToolCard';
import { ManageToolModal } from '@/components/tools/ManageToolModal';
import { showToast } from '@/context/ToastContext';

// Enable WebBrowser auth completion handling
WebBrowser.maybeCompleteAuthSession();

export default function ToolsConnectionsScreen() {
  const router = useRouter();

  const [tools, setTools] = useState<ToolWithConnection[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingBundledCatalog, setUsingBundledCatalog] = useState(false);
  const [authState, setAuthState] = useState<'checking' | 'signedOut' | 'signedIn'>('checking');

  // Track per-tool loading state during connect/disconnect/status check
  const [loadingToolIds, setLoadingToolIds] = useState<Record<string, boolean>>({});

  // Active tool for Manage modal
  const [selectedManageTool, setSelectedManageTool] = useState<ToolWithConnection | null>(null);

  // Refs for tracking active polling to prevent duplicate checks
  const checkingStatusRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? 'signedIn' : 'signedOut');
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('[tools.tsx] Failed to check sign-in status:', error.message);
      }
      if (mounted) {
        setAuthState(data.session ? 'signedIn' : 'signedOut');
      }
    }).catch((error: unknown) => {
      console.error('[tools.tsx] Failed to check sign-in status:', error);
      if (mounted) setAuthState('signedOut');
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 1. Load tools dataset from data layer
  const loadTools = useCallback(async (isRefresh = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await fetchToolsWithUserConnection();
      setTools(data);
      setLoadError(null);
      setUsingBundledCatalog(false);
    } catch (err: unknown) {
      if (isMissingToolsTableError(err)) {
        setTools(getBundledToolCatalog());
        setLoadError(null);
        setUsingBundledCatalog(true);
      } else {
        logToolsLoadError(err);
        setLoadError(getToolsLoadErrorMessage(err));
        showToast('Failed to load tools');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let cancelled = false;
    const loadInitialTools = async () => {
      try {
        const data = await fetchToolsWithUserConnection();
        if (!cancelled) {
          setTools(data);
          setLoadError(null);
          setUsingBundledCatalog(false);
        }
      } catch (err: unknown) {
        if (!cancelled && isMissingToolsTableError(err)) {
          setTools(getBundledToolCatalog());
          setLoadError(null);
          setUsingBundledCatalog(true);
        } else if (!cancelled) {
          logToolsLoadError(err);
          setLoadError(getToolsLoadErrorMessage(err));
          showToast('Failed to load tools');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitialTools();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Refresh tools when user returns to app (AppState foreground transition)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          loadTools(true);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [loadTools]);

  // 3. Helper to check status of a single tool via backend status endpoint
  const checkSingleToolStatus = useCallback(async (toolId: string, silent = false) => {
    if (checkingStatusRef.current[toolId]) return;
    checkingStatusRef.current[toolId] = true;

    try {
      const statusRes = await checkToolConnectionStatusApi(toolId);

      setTools((prevTools) =>
        prevTools.map((item) => {
          if (item.id === toolId) {
            const oldStatus = item.status;
            const newStatus = statusRes.status;

            if (oldStatus !== 'connected' && newStatus === 'connected' && !silent) {
              showToast(`Successfully connected to ${item.name}!`);
            } else if (newStatus === 'failed' && !silent) {
              showToast(`Connection to ${item.name} failed. Please try again.`);
            }

            return {
              ...item,
              status: newStatus,
              connected_email: statusRes.connectedEmail || item.connected_email,
              connected_label: statusRes.connectedLabel || item.connected_label,
            };
          }
          return item;
        })
      );

      // Keep selectedManageTool up to date if open
      setSelectedManageTool((prev) => {
        if (prev?.id === toolId) {
          return {
            ...prev,
            status: statusRes.status,
            connected_email: statusRes.connectedEmail || prev.connected_email,
            connected_label: statusRes.connectedLabel || prev.connected_label,
          };
        }
        return prev;
      });

      return statusRes;
    } catch (err: any) {
      console.warn(`[tools.tsx] Status check error for ${toolId}:`, err?.message || err);
    } finally {
      checkingStatusRef.current[toolId] = false;
    }
  }, []);

  // 4. Poll pending tools every 3.5 seconds
  useEffect(() => {
    const pendingTools = tools.filter((t) => t.status === 'pending');
    if (pendingTools.length === 0) return;

    const intervalId = setInterval(() => {
      pendingTools.forEach((tool) => {
        checkSingleToolStatus(tool.id, false);
      });
    }, 3500);

    return () => clearInterval(intervalId);
  }, [tools, checkSingleToolStatus]);

  // 5. Handle Connect action (Backend endpoint -> WebBrowser -> Status polling)
  const handleConnect = async (targetTool: ToolWithConnection) => {
    if (authState !== 'signedIn') {
      showToast('Sign in with Google before connecting a tool.');
      return;
    }

    setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: true }));

    try {
      // Deep link callback for Expo app
      const callbackUrl = Linking.createURL('/tools');

      // Step 1: Call backend start connection endpoint
      const res = await startToolConnectionApi(targetTool.id, callbackUrl);

      if (res.success && res.status === 'connected') {
        setTools((prevTools) =>
          prevTools.map((item) =>
            item.id === targetTool.id
              ? {
                  ...item,
                  status: 'connected',
                  composio_connected_account_id: res.composioConnectedAccountId ?? null,
                }
              : item
          )
        );
        showToast(`${targetTool.name} is already connected.`);
        return;
      }

      if (!res.success || !res.connectUrl) {
        throw new Error('No authorization URL returned from server.');
      }

      // Step 2: Show pending state immediately
      setTools((prevTools) =>
        prevTools.map((item) =>
          item.id === targetTool.id ? { ...item, status: 'pending' } : item
        )
      );

      showToast(`Opening authentication for ${targetTool.name}...`);

      // Step 3: Open returned Composio connect URL using Expo WebBrowser
      let browserResult;
      try {
        browserResult = await WebBrowser.openAuthSessionAsync(
          res.connectUrl,
          callbackUrl
        );
      } catch (browserErr) {
        console.warn('[tools.tsx] openAuthSessionAsync fallback:', browserErr);
        await WebBrowser.openBrowserAsync(res.connectUrl);
      }

      // Step 4: After browser closes/resolves, check status with backend
      const statusRes = await checkSingleToolStatus(targetTool.id);

      if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
        if (statusRes?.status === 'pending') {
          showToast(`Authorization window closed. Connection pending...`);
        }
      }
    } catch (err: any) {
      logToolConnectionError('Connect', targetTool, err);
      showToast(getToolConnectionErrorMessage(err, targetTool.name));
      // Fallback status check
      await checkSingleToolStatus(targetTool.id, true);
    } finally {
      setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: false }));
    }
  };

  // 6. Handle Disconnect action (Backend endpoint -> State update)
  const handleDisconnect = async (targetTool: ToolWithConnection) => {
    if (authState !== 'signedIn') {
      showToast('Sign in with Google before managing connected tools.');
      return;
    }

    setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: true }));

    try {
      const res = await disconnectToolApi(targetTool.id);

      if (res.success) {
        setTools((prevTools) =>
          prevTools.map((item) =>
            item.id === targetTool.id
              ? {
                  ...item,
                  status: 'not_connected',
                  connected_email: null,
                  connected_label: null,
                }
              : item
          )
        );

        if (selectedManageTool?.id === targetTool.id) {
          setSelectedManageTool(null);
        }

        showToast(`Disconnected from ${targetTool.name}`);
      } else {
        throw new Error(res.message || 'Failed to disconnect tool');
      }
    } catch (err: any) {
      logToolConnectionError('Disconnect', targetTool, err);
      showToast(getToolConnectionErrorMessage(err, targetTool.name));
    } finally {
      setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: false }));
    }
  };

  // 7. Handle Manage action (Opens Manage Modal)
  const handleManage = (targetTool: ToolWithConnection) => {
    setSelectedManageTool(targetTool);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={22}
              color={Colors.iconDark}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Tools & Connections</Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => loadTools(true)}
            activeOpacity={0.7}>
            <HugeiconsIcon
              icon={RefreshIcon}
              size={20}
              color={Colors.iconDark}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching tool connections...</Text>
          </View>
        ) : !isSupabaseConfigured ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.headerTitle}>Connect Supabase to load tools</Text>
            <Text style={styles.loadingText}>
              Add your Supabase URL and public key to .env, then restart Expo.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadTools(true)}
                tintColor={Colors.primary}
              />
            }>
            {authState !== 'signedIn' && (
              <View style={styles.catalogNotice}>
                <Text style={styles.catalogNoticeTitle}>
                  {authState === 'checking' ? 'Checking sign-in…' : 'Sign in to connect tools'}
                </Text>
                <Text style={styles.catalogNoticeText}>
                  Connect with Google first. Tool connections are linked securely to your account.
                </Text>
                {authState === 'signedOut' && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => router.push('/')}
                    activeOpacity={0.8}>
                    <Text style={styles.retryButtonText}>Go to sign in</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {usingBundledCatalog && (
              <View style={styles.catalogNotice}>
                <Text style={styles.catalogNoticeTitle}>Showing available tools</Text>
                <Text style={styles.catalogNoticeText}>
                  Run the MuseSpark database migration in Supabase to enable tool connections.
                </Text>
              </View>
            )}
            {loadError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Could not load tools</Text>
                <Text style={styles.errorText}>{loadError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => loadTools(true)}
                  activeOpacity={0.8}>
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : tools.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No tools are available yet.</Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                {tools.map((tool, index) => (
                  <React.Fragment key={tool.id}>
                    {index > 0 && <View style={styles.rowDivider} />}
                    <ToolCard
                      tool={tool}
                      isLoading={!!loadingToolIds[tool.id]}
                      readOnly={usingBundledCatalog || authState !== 'signedIn'}
                      readOnlyLabel={
                        usingBundledCatalog
                          ? 'Setup required'
                          : authState === 'checking'
                            ? 'Checking…'
                            : 'Sign in first'
                      }
                      onConnect={usingBundledCatalog || authState !== 'signedIn' ? undefined : handleConnect}
                      onDisconnect={usingBundledCatalog || authState !== 'signedIn' ? undefined : handleDisconnect}
                      onManage={usingBundledCatalog || authState !== 'signedIn' ? undefined : handleManage}
                    />
                  </React.Fragment>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Manage Tool Connection Modal */}
        <ManageToolModal
          visible={!!selectedManageTool}
          tool={selectedManageTool}
          isLoading={selectedManageTool ? !!loadingToolIds[selectedManageTool.id] : false}
          onClose={() => setSelectedManageTool(null)}
          onReconnect={(toolToReconnect) => {
            setSelectedManageTool(null);
            handleConnect(toolToReconnect);
          }}
          onDisconnect={(toolToDisconnect) => {
            handleDisconnect(toolToDisconnect);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function getToolConnectionErrorMessage(error: unknown, toolName: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/sign in/i.test(message)) {
    return 'Sign in with Google before connecting or managing tools.';
  }
  if (/COMPOSIO_API_KEY|not configured on this server/i.test(message)) {
    return 'Tool connections are not configured on this server. Add COMPOSIO_API_KEY to the server .env file and restart Expo.';
  }
  if (/auth config|toolkit configuration/i.test(message)) {
    return `${toolName} is missing its Composio authentication configuration. Ask the app administrator to configure it.`;
  }
  return `Could not ${message.toLowerCase().includes('disconnect') ? 'disconnect from' : 'connect to'} ${toolName}. Check the server configuration and try again.`;
}

function logToolConnectionError(
  action: 'Connect' | 'Disconnect',
  tool: ToolWithConnection,
  error: unknown
): void {
  const details =
    typeof error === 'object' && error !== null
      ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
      : {};
  console.error(`[tools.tsx] ${action} error for ${tool.slug}:`, {
    message: details.message ?? (error instanceof Error ? error.message : String(error)),
    details: details.details,
    hint: details.hint,
    code: details.code,
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  catalogNotice: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  catalogNoticeTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  catalogNoticeText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  errorTitle: {
    color: Colors.error,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 68,
  },
});

function logToolsLoadError(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const details = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    console.error('[tools.tsx] Error loading tools:', {
      message: details.message,
      details: details.details,
      hint: details.hint,
      code: details.code,
    });
    return;
  }

  console.error('[tools.tsx] Error loading tools:', error);
}

function getToolsLoadErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const details = error as { code?: unknown; message?: unknown };
    if (details.code === 'PGRST205' || details.code === '42P01') {
      return 'The public.tools table is missing. Run the MuseSpark database migration in your Supabase SQL Editor, then try again.';
    }
    if (details.code === '42501') {
      return 'Supabase denied access to the tools table. Check its SELECT grants and row-level security policy.';
    }
    if (typeof details.message === 'string') {
      return details.message;
    }
  }

  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function isMissingToolsTableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const details = error as { code?: unknown };
  return details.code === 'PGRST205' || details.code === '42P01';
}
