import { syncProdutosLojas } from '@/lib/bling/canaisVenda';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('Iniciando sincronização de produtos x lojas...');
    const result = await syncProdutosLojas();

    if (result.status === 'erro') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Vínculos com lojas sincronizados com sucesso!',
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Sync produtos lojas error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erro durante sincronização de produtos x lojas',
        status: 'erro',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
