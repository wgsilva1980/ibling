import { getValidAccessToken } from '@/lib/bling/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('Cron: Renovando token de acesso...');
    const token = await getValidAccessToken();
    console.log('Token renovado com sucesso');

    return NextResponse.json(
      { message: 'Token renovado com sucesso', token: token.substring(0, 20) + '...' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Cron refresh-token error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao renovar token' },
      { status: 500 }
    );
  }
}
