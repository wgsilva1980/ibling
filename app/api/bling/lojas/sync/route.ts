import { syncProdutosLojas, syncProdutoLoja } from '@/lib/bling/canaisVenda';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const produtoIdParam = req.nextUrl.searchParams.get('produtoId');
    const produtoId = produtoIdParam ? Number(produtoIdParam) : null;

    if (produtoId) {
      console.log(`Iniciando sincronização de produto x lojas (produto ${produtoId})...`);
      const result = await syncProdutoLoja(produtoId);

      if (result.status === 'erro') {
        return NextResponse.json(result, { status: 500 });
      }

      return NextResponse.json(
        {
          message: 'Vínculos do produto sincronizados com sucesso!',
          ...result,
        },
        { status: 200 }
      );
    }

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
