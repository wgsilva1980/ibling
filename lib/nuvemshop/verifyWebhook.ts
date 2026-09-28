import { createHmac, timingSafeEqual } from 'crypto';

export function verificarAssinaturaNuvemshop(
  rawBody: string,
  assinaturaRecebida: string | null
): boolean {
  const secret = process.env.NUVEMSHOP_CLIENT_SECRET;
  if (!assinaturaRecebida || !secret) return false;

  const assinaturaCalculada = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(assinaturaCalculada);
  const b = Buffer.from(assinaturaRecebida);

  return a.length === b.length && timingSafeEqual(a, b);
}
