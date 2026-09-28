import { syncGrupoComNuvemshop } from '@/lib/nuvemshop/sync';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const produtoId = req.nextUrl.searchParams.get('produtoId');

  if (!produtoId) {
    return NextResponse.json({ error: 'produtoId é obrigatório' }, { status: 400 });
  }

  const resultado = await syncGrupoComNuvemshop(Number(produtoId));

  if (resultado.status === 'erro') {
    return NextResponse.json({ error: resultado.erro }, { status: 500 });
  }

  return NextResponse.json(resultado);
}
