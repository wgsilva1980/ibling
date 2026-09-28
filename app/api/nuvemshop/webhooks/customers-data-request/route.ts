import { NextRequest, NextResponse } from 'next/server';
import { verificarAssinaturaNuvemshop } from '@/lib/nuvemshop/verifyWebhook';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const assinatura = req.headers.get('x-linkedstore-hmac-sha256');

  if (!verificarAssinaturaNuvemshop(rawBody, assinatura)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    store_id: number;
    customer: { id: number; email?: string };
    orders_requested?: number[];
    data_request: { id: number };
  };
  console.log(
    `LGPD customers/data_request recebido para cliente ${payload.customer?.id} da store ${payload.store_id}`
  );

  return NextResponse.json({ message: 'ok' }, { status: 200 });
}
