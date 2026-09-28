import { createSupabaseClient } from '@/lib/supabase/server';

const NUVEMSHOP_TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';

interface NuvemshopTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  user_id: number;
}

export async function storeTokens(code: string): Promise<void> {
  const supabase = createSupabaseClient();

  const response = await fetch(NUVEMSHOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.NUVEMSHOP_CLIENT_ID,
      client_secret: process.env.NUVEMSHOP_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Nuvemshop tokens: ${error}`);
  }

  const data: NuvemshopTokenResponse = await response.json();

  const { error } = await supabase.from('nuvemshop_tokens').insert({
    access_token: data.access_token,
    store_id: data.user_id,
    scope: data.scope,
  });

  if (error) {
    throw new Error(`Failed to store Nuvemshop tokens: ${error.message}`);
  }
}

export async function getValidAccessToken(): Promise<{
  accessToken: string;
  storeId: number;
}> {
  const supabase = createSupabaseClient();

  const { data: tokenRow, error } = await supabase
    .from('nuvemshop_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !tokenRow) {
    throw new Error('No Nuvemshop token found. Please authorize first.');
  }

  return { accessToken: tokenRow.access_token, storeId: tokenRow.store_id };
}
