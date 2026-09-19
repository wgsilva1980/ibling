import { blingRequest } from './client';
import { createSupabaseClient } from '@/lib/supabase/server';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncInicial(): Promise<{
  totalProdutos: number;
  totalEstoques: number;
  status: 'sucesso' | 'erro';
  erro?: string;
}> {
  const supabase = createSupabaseClient();
  let totalProdutos = 0;
  let totalEstoques = 0;

  try {
    console.log('Iniciando sincronização inicial de produtos...');

    // Buscar todos os produtos
    let pagina = 1;
    let todosProdutos: any[] = [];

    while (true) {
      try {
        console.log(`Buscando página ${pagina} de produtos...`);
        const resp = await blingRequest(`/produtos?pagina=${pagina}&limite=100`);

        if (!resp.data || resp.data.length === 0) break;

        todosProdutos = todosProdutos.concat(resp.data);
        console.log(`  Encontrados ${resp.data.length} produtos nesta página`);

        pagina++;
        await sleep(350); // Respeitar rate limit
      } catch (error) {
        console.error(`Erro ao buscar página ${pagina}:`, error);
        throw error;
      }
    }

    console.log(`Total de produtos encontrados: ${todosProdutos.length}`);

    // Armazenar produtos
    for (const p of todosProdutos) {
      try {
        await supabase.from('bling_produtos').upsert(
          {
            id: p.id,
            codigo: p.codigo,
            nome: p.nome,
            preco: p.preco,
            situacao: p.situacao,
            raw: p,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        totalProdutos++;
      } catch (error) {
        console.error(`Erro ao armazenar produto ${p.id}:`, error);
      }
    }

    console.log(`Produtos armazenados: ${totalProdutos}`);

    // Buscar saldo de estoque em lotes de 50 ids
    const ids = todosProdutos.map((p) => p.id);
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50);
      console.log(`Buscando estoque para lote ${Math.floor(i / 50) + 1}...`);

      try {
        const query = lote.map((id) => `idsProdutos[]=${id}`).join('&');
        const estoqueResp = await blingRequest(`/estoques/saldos?${query}`);

        for (const item of estoqueResp.data || []) {
          try {
            // Atualizar saldo total do produto
            await supabase
              .from('bling_produtos')
              .update({ saldo_fisico_total: item.saldoFisicoTotal })
              .eq('id', item.produto.id);

            // Armazenar estoque por depósito
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
              totalEstoques++;
            }
          } catch (error) {
            console.error(`Erro ao armazenar estoque do produto ${item.produto.id}:`, error);
          }
        }

        await sleep(350); // Respeitar rate limit
      } catch (error) {
        console.error(`Erro ao buscar estoque do lote:`, error);
        throw error;
      }
    }

    console.log(`Estoques armazenados: ${totalEstoques}`);

    // Registrar sucesso
    await supabase.from('bling_sync_log').insert({
      tipo: 'inicial',
      status: 'sucesso',
      detalhes: { total_produtos: totalProdutos, total_estoques: totalEstoques },
    });

    return {
      totalProdutos,
      totalEstoques,
      status: 'sucesso',
    };
  } catch (error: any) {
    console.error('Erro na sincronização inicial:', error);

    // Registrar erro
    await supabase.from('bling_sync_log').insert({
      tipo: 'inicial',
      status: 'erro',
      detalhes: { erro: error.message },
    });

    return {
      totalProdutos,
      totalEstoques,
      status: 'erro',
      erro: error.message,
    };
  }
}

export async function syncIncremental(dataAlteracaoInicial: string): Promise<{
  totalProdutos: number;
  status: 'sucesso' | 'erro';
  erro?: string;
}> {
  const supabase = createSupabaseClient();
  let totalProdutos = 0;

  try {
    console.log(`Sincronizando produtos alterados desde ${dataAlteracaoInicial}...`);

    const resp = await blingRequest(
      `/produtos?dataAlteracaoInicial=${dataAlteracaoInicial}&limite=100`
    );

    for (const p of resp.data || []) {
      try {
        await supabase.from('bling_produtos').upsert(
          {
            id: p.id,
            codigo: p.codigo,
            nome: p.nome,
            preco: p.preco,
            situacao: p.situacao,
            raw: p,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        totalProdutos++;
      } catch (error) {
        console.error(`Erro ao armazenar produto ${p.id}:`, error);
      }
    }

    console.log(`Produtos sincronizados: ${totalProdutos}`);

    // Registrar sucesso
    await supabase.from('bling_sync_log').insert({
      tipo: 'incremental',
      status: 'sucesso',
      detalhes: { total_produtos: totalProdutos, data_inicial: dataAlteracaoInicial },
    });

    return {
      totalProdutos,
      status: 'sucesso',
    };
  } catch (error: any) {
    console.error('Erro na sincronização incremental:', error);

    // Registrar erro
    await supabase.from('bling_sync_log').insert({
      tipo: 'incremental',
      status: 'erro',
      detalhes: { erro: error.message },
    });

    return {
      totalProdutos,
      status: 'erro',
      erro: error.message,
    };
  }
}
