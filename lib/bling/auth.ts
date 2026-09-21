import { createSupabaseClient } from '@/lib/supabase/server';

const BLING_TOKEN_URL = 'https://api.bling.com.br/Api/v3/oauth/token';

interface BlingTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function getValidAccessToken(): Promise<string> {
  const supabase = createSupabaseClient();

  try {
    // Buscar token atual do banco
    const { data: tokenRow, error: selectError } = await supabase
      .from('bling_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (selectError || !tokenRow) {
      throw new Error('No token found. Please authorize first.');
    }

    const expiraEm = new Date(tokenRow.expires_at).getTime();
    const agora = Date.now();

    // Se token ainda é válido por mais de 10 minutos, retornar
    if (expiraEm - agora > 10 * 60 * 1000) {
      return tokenRow.access_token;
    }

    // Renovar token
    const credentials = Buffer.from(
      `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch(BLING_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'enable-jwt': '1',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data: BlingTokenResponse = await response.json();

    // Atualizar token no banco
    const { error: updateError } = await supabase
      .from('bling_tokens')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id);

    if (updateError) {
      throw new Error(`Failed to update token: ${updateError.message}`);
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    throw error;
  }
}

export async function storeTokens(code: string): Promise<void> {
  const supabase = createSupabaseClient();

  const credentials = Buffer.from(
    `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'enable-jwt': '1',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get tokens: ${error}`);
  }

  const data: BlingTokenResponse = await response.json();

  // Armazenar tokens
  const { error } = await supabase.from('bling_tokens').insert({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: data.scope,
  });

  if (error) {
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
}
