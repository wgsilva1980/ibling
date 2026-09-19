import { syncInicial } from '@/lib/bling/sync';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('Iniciando sincronização inicial...');
    const result = await syncInicial();

    if (result.status === 'erro') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Sincronização inicial concluída com sucesso!',
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erro durante sincronização',
        status: 'erro',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
