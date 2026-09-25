import { syncDetalhesCompletos } from '@/lib/bling/sync';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('Iniciando sincronização de detalhes completos...');
    const result = await syncDetalhesCompletos();

    if (result.status === 'erro') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Sincronização de detalhes concluída!',
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Sync detalhes error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erro durante sincronização de detalhes',
        status: 'erro',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
