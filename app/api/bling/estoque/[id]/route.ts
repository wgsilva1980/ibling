import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface EstoqueUpdate {
  depositoId: number;
  saldoFisico: number;
  saldoVirtual: number;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseClient();
  const produtoId = params.id;

  try {
    const body = await req.json();
    const { depositos } = body as { depositos: EstoqueUpdate[] };

    if (!Array.isArray(depositos) || depositos.length === 0) {
      return NextResponse.json(
        { error: 'Lista de depósitos é obrigatória' },
        { status: 400 }
      );
    }

    console.log(`Atualizando estoque do produto ${produtoId}`);

    // Atualizar cada depósito no Bling
    for (const dep of depositos) {
      try {
        await blingRequest('/estoques', {
          method: 'POST',
          body: JSON.stringify({
            produto: {
              id: produtoId,
            },
            deposito: {
              id: dep.depositoId,
            },
            saldoFisico: parseInt(dep.saldoFisico.toString()),
            saldoVirtual: parseInt(dep.saldoVirtual.toString()),
          }),
        });

        // Atualizar no Supabase
        await supabase.from('bling_estoque_depositos').update({
          saldo_fisico: parseInt(dep.saldoFisico.toString()),
          saldo_virtual: parseInt(dep.saldoVirtual.toString()),
          atualizado_em: new Date().toISOString(),
        }).eq('produto_id', produtoId).eq('deposito_id', dep.depositoId);
      } catch (depError) {
        console.error(`Erro ao atualizar depósito ${dep.depositoId}:`, depError);
        throw depError;
      }
    }

    // Atualizar saldo total do produto
    const estoqueResp = await blingRequest(
      `/estoques/saldos?idsProdutos[]=${produtoId}`
    );
    const item = estoqueResp.data?.[0];

    if (item) {
      await supabase
        .from('bling_produtos')
        .update({ saldo_fisico_total: item.saldoFisicoTotal })
        .eq('id', produtoId);
    }

    // Registrar no log
    await supabase.from('bling_sync_log').insert({
      tipo: 'edição',
      status: 'sucesso',
      detalhes: {
        ação: 'estoque atualizado',
        produtoId,
        depositos: depositos.length,
      },
    });

    return NextResponse.json(
      { message: 'Estoque atualizado com sucesso' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar estoque:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'edição',
        status: 'erro',
        detalhes: {
          ação: 'falha ao atualizar estoque',
          produtoId,
          erro: error.message,
        },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar estoque' },
      { status: 500 }
    );
  }
}
