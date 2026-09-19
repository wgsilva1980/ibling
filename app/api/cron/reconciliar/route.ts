import { syncIncremental } from '@/lib/bling/sync';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Pegar data de ontem
    const ontem = new Date(Date.now() - 86400000);
    const dataAlteracaoInicial = ontem.toISOString().split('T')[0];

    console.log(`Cron: Reconciliando produtos alterados desde ${dataAlteracaoInicial}...`);

    const result = await syncIncremental(dataAlteracaoInicial);

    if (result.status === 'erro') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Reconciliação concluída com sucesso!',
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Cron reconciliar error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao reconciliar' },
      { status: 500 }
    );
  }
}
