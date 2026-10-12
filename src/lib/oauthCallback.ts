import { supabase } from '@/lib/supabase';

export async function completeSupabaseOAuthCallback(callbackUrl: string): Promise<void> {
  const url = new URL(callbackUrl);
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const errorDescription =
    query.get('error_description') ??
    fragment.get('error_description') ??
    query.get('error') ??
    fragment.get('error');

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = query.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    await saveUserProfile(data.session?.user);
    return;
  }

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('OAuth callback did not include an authorization code or session tokens.');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  await saveUserProfile(data.session?.user);
}

async function saveUserProfile(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
} | undefined): Promise<void> {
  if (!user?.email) {
    throw new Error('The authenticated account did not provide an email address.');
  }

  const { error } = await supabase.from('users').upsert({
    email: user.email,
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '',
  });
  if (error) throw error;
}
