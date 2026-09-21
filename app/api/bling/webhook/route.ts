import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const payload = await req.json();
    console.log('Webhook payload completo:', JSON.stringify(payload, null, 2));

    // Bling pode enviar em diferentes formatos
    const evento = (payload.evento || payload.type || payload.event) as string;
    const dados = payload.dados || payload.data || payload;

    console.log(`Webhook recebido: ${evento}`);

    // Tratar eventos de produto
    if (evento?.includes('produto')) {
      if (evento.includes('excluido')) {
        console.log(`Deletando produto ${dados.id}`);
        await supabase.from('bling_produtos').delete().eq('id', dados.id);
      } else {
        console.log(`Atualizando produto ${dados.id}`);
        await supabase.from('bling_produtos').upsert(
          {
            id: dados.id,
            codigo: dados.codigo,
            nome: dados.nome,
            preco: dados.preco,
            situacao: dados.situacao,
            raw: dados,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // Tratar eventos de estoque
    if (evento?.includes('estoque')) {
      console.log(`Atualizando estoque do produto ${dados.produto.id}`);
      try {
        const estoqueResp = await blingRequest(
          `/estoques/saldos?idsProdutos[]=${dados.produto.id}`
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
      detalhes: { evento, payload },
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
