import { getValidAccessToken } from './auth';

const BASE_URL = 'https://www.bling.com.br/Api/v3';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function blingRequest(
  path: string,
  options: RequestInit = {},
  retries: number = 3
): Promise<any> {
  const token = await getValidAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  // Rate limit handling (429 Too Many Requests)
  if (response.status === 429 && retries > 0) {
    console.warn(`Rate limited. Retrying in 1200ms. Retries left: ${retries}`);
    await sleep(1200);
    return blingRequest(path, options, retries - 1);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bling API error ${response.status}: ${error}`);
  }

  return response.json();
}
