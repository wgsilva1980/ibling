import { syncCategorias } from '@/lib/bling/categorias';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('Iniciando sincronização de categorias...');
    const result = await syncCategorias();

    if (result.status === 'erro') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Categorias sincronizadas com sucesso!',
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Sync categorias error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erro durante sincronização de categorias',
        status: 'erro',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
