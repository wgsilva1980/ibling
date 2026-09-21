import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface EstoqueUpdate {
  depositoId: number;
  saldoFisico: number;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const { id: produtoId } = await params;

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

    const movimentacoes: any[] = [];

    // Atualizar cada depósito no Bling
    for (const dep of depositos) {
      try {
        // Buscar saldo atual no banco com nome do depósito
        const { data: saldoAtual } = await supabase
          .from('bling_estoque_depositos')
          .select('saldo_fisico, deposito_nome')
          .eq('produto_id', produtoId)
          .eq('deposito_id', dep.depositoId)
          .single();

        const saldoAtualFisico = saldoAtual?.saldo_fisico || 0;
        const depositoNome = saldoAtual?.deposito_nome || `Depósito ${dep.depositoId}`;
        const novoSaldoFisico = parseInt(dep.saldoFisico.toString());
        const diferenca = novoSaldoFisico - saldoAtualFisico;

        // Se há diferença, registrar como movimentação
        if (diferenca !== 0) {
          const tipoOperacao = diferenca > 0 ? 'E' : 'S'; // E = Entrada, S = Saída
          const quantidade = Math.abs(diferenca);
          const tipoOperacaoNome = tipoOperacao === 'E' ? 'Entrada' : 'Saída';

          await blingRequest('/estoques', {
            method: 'POST',
            body: JSON.stringify({
              produto: {
                id: produtoId,
              },
              deposito: {
                id: dep.depositoId,
              },
              tipoOperacao,
              quantidade,
            }),
          });

          // Registrar movimentação para log detalhado
          movimentacoes.push({
            deposito_id: dep.depositoId,
            deposito_nome: depositoNome,
            tipo_operacao: tipoOperacaoNome,
            quantidade,
            saldo_anterior: saldoAtualFisico,
            saldo_novo: novoSaldoFisico,
          });
        }

        // Atualizar no Supabase
        await supabase.from('bling_estoque_depositos').update({
          saldo_fisico: novoSaldoFisico,
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

    // Registrar no log com detalhes de cada movimentação
    if (movimentacoes.length > 0) {
      await supabase.from('bling_sync_log').insert({
        tipo: 'movimentação',
        status: 'sucesso',
        detalhes: {
          ação: 'estoque movimentado',
          produtoId,
          movimentacoes,
        },
      });
    }

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
