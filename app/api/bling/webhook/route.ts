import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const payload = await req.json();
    const event = payload.event as string;
    const data = payload.data;

    console.log(`Webhook recebido: ${event}`);

    // Produto atualizado ou criado
    if (event === 'product.updated' || event === 'product.created') {
      console.log(`Atualizando produto ${data.id}`);
      await supabase.from('bling_produtos').upsert(
        {
          id: data.id,
          codigo: data.codigo,
          nome: data.nome,
          preco: data.preco,
          situacao: data.situacao === 'A' ? 'Ativo' : (data.situacao === 'I' ? 'Inativo' : (data.situacao === 'E' ? 'Excluído' : data.situacao)),
          raw: data,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    // Produto deletado - apenas marcar como excluído, não deletar
    if (event === 'product.deleted') {
      console.log(`Marcando produto ${data.id} como excluído`);
      await supabase.from('bling_produtos').update({
        situacao: 'Excluído',
        atualizado_em: new Date().toISOString(),
      }).eq('id', data.id);
    }

    // Estoque alterado - buscar dados atualizados
    if (event === 'stock.updated' || event.includes('stock')) {
      try {
        const produtoId = data.produto?.id || data.id;
        console.log(`Atualizando estoque do produto ${produtoId}`);

        const estoqueResp = await blingRequest(
          `/estoques/saldos?idsProdutos[]=${produtoId}`
        );

        const item = estoqueResp.data?.[0];

        if (item) {
          // Atualizar saldo total
          await supabase
            .from('bling_produtos')
            .update({ saldo_fisico_total: item.saldoFisicoTotal })
            .eq('id', item.produto.id);

          // Atualizar estoque por depósito
          for (const dep of item.depositos || []) {
            await supabase.from('bling_estoque_depositos').upsert(
              {
                produto_id: item.produto.id,
                deposito_id: dep.id,
                deposito_nome: dep.nome,
                saldo_fisico: dep.saldoFisico,
                saldo_virtual: dep.saldoVirtual,
                atualizado_em: new Date().toISOString(),
              },
              { onConflict: 'produto_id,deposito_id' }
            );
          }
        }
      } catch (error) {
        console.error('Erro ao buscar estoque:', error);
      }
    }

    // Registrar no log
    await supabase.from('bling_sync_log').insert({
      tipo: 'webhook',
      status: 'sucesso',
      detalhes: { event, payload },
    });

    return NextResponse.json(
      { message: 'Webhook processado com sucesso' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);

    // Registrar erro
    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'webhook',
        status: 'erro',
        detalhes: { erro: error.message },
      });
    } catch (logError) {
      console.error('Erro ao registrar webhook error:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}
