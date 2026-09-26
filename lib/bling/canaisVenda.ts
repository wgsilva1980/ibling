import { blingRequest } from './client';
import { createSupabaseClient } from '@/lib/supabase/server';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O Bling não tem um endpoint que liste todos os canais de venda de uma vez -
// só GET /canais-venda/{id}. Por isso descobrimos quais ids existem a partir
// dos vínculos em /produtos/lojas e buscamos o detalhe de cada um.
async function sincronizarCanalVenda(id: number, cache: Set<number>) {
  if (cache.has(id)) return;

  const resp = await blingRequest(`/canais-venda/${id}`);
  const canal = resp.data;
  if (!canal) return;

  const supabase = createSupabaseClient();
  await supabase.from('bling_canais_venda').upsert(
    {
      id: canal.id,
      descricao: canal.descricao,
      tipo: canal.tipo,
      situacao: canal.situacao,
      raw: canal,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  cache.add(id);
}

export async function syncProdutosLojas(): Promise<{
  totalVinculos: number;
  totalCanais: number;
  status: 'sucesso' | 'erro';
  erro?: string;
}> {
  const supabase = createSupabaseClient();
  let totalVinculos = 0;

  try {
    console.log('Iniciando sincronização de produtos x lojas...');

    const { data: canaisExistentes } = await supabase.from('bling_canais_venda').select('id');
    const canaisConhecidos = new Set<number>((canaisExistentes || []).map((c: any) => c.id));

    let pagina = 1;
    let todosVinculos: any[] = [];

    while (true) {
      const resp = await blingRequest(`/produtos/lojas?pagina=${pagina}&limite=100`);

      if (!resp.data || resp.data.length === 0) break;

      todosVinculos = todosVinculos.concat(resp.data);
      console.log(`  Encontrados ${resp.data.length} vínculos na página ${pagina}`);

      pagina++;
      await sleep(350); // Respeitar rate limit
    }

    console.log(`Total de vínculos produto x loja encontrados: ${todosVinculos.length}`);

    // Descobrir e sincronizar canais de venda ainda não conhecidos
    const idsCanais = new Set<number>(todosVinculos.map((v) => v.loja?.id).filter(Boolean));
    for (const idCanal of idsCanais) {
      if (!canaisConhecidos.has(idCanal)) {
        await sincronizarCanalVenda(idCanal, canaisConhecidos);
        await sleep(350);
      }
    }

    for (const v of todosVinculos) {
      try {
        await supabase.from('bling_produtos_lojas').upsert(
          {
            id: v.id,
            produto_id: v.produto?.id,
            canal_venda_id: v.loja?.id,
            codigo: v.codigo,
            preco: v.preco,
            preco_promocional: v.precoPromocional,
            raw: v,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        totalVinculos++;
      } catch (error) {
        console.error(`Erro ao armazenar vínculo ${v.id}:`, error);
      }
    }

    console.log(`Vínculos armazenados: ${totalVinculos}`);

    await supabase.from('bling_sync_log').insert({
      tipo: 'produtos_lojas',
      status: 'sucesso',
      detalhes: { total_vinculos: totalVinculos, total_canais: idsCanais.size },
    });

    return { totalVinculos, totalCanais: idsCanais.size, status: 'sucesso' };
  } catch (error: any) {
    console.error('Erro na sincronização de produtos x lojas:', error);

    await supabase.from('bling_sync_log').insert({
      tipo: 'produtos_lojas',
      status: 'erro',
      detalhes: { erro: error.message },
    });

    return { totalVinculos, totalCanais: 0, status: 'erro', erro: error.message };
  }
}
