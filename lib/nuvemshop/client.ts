import { getValidAccessToken } from './auth';

const BASE_URL = 'https://api.nuvemshop.com.br/2025-03';
const USER_AGENT = 'ibling (wagnergarnizet@gmail.com)';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function nuvemshopRequest(
  path: string,
  options: RequestInit = {},
  retries: number = 3
): Promise<any> {
  const { accessToken, storeId } = await getValidAccessToken();

  const response = await fetch(`${BASE_URL}/${storeId}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
  });

  // Rate limit handling (429 Too Many Requests - leaky bucket, 2 req/s)
  if (response.status === 429 && retries > 0) {
    console.warn(`Nuvemshop rate limited. Retrying in 600ms. Retries left: ${retries}`);
    await sleep(600);
    return nuvemshopRequest(path, options, retries - 1);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Nuvemshop API error ${response.status}: ${error}`);
  }

  const texto = await response.text();
  return texto ? JSON.parse(texto) : null;
}
