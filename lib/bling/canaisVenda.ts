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

// Acha o id do produto pai de um produto (o próprio id quando ele já é o pai
// ou um produto sem variações), a partir dos dois formatos em que essa
// relação pode vir salva no raw (lista vs. detalhe do Bling - mesmo fallback
// usado em produtos/[id]/route.ts e nas telas de grupo).
function idPaiDe(produto: { id: number; raw?: any }): number {
  return produto.raw?.idProdutoPai || produto.raw?.variacao?.produtoPai?.id || produto.id;
}

// Resolve o produto informado para o grupo inteiro (produto pai + todas as
// variações) - a sincronização com lojas sempre parte do pai e leva as
// variações junto, mesmo que o usuário tenha selecionado só uma variação.
async function resolverGrupoProdutoIds(produtoId: number): Promise<number[]> {
  const supabase = createSupabaseClient();
  const { data: todos } = await supabase
    .from('bling_produtos')
    .select('id, raw')
    .neq('situacao', 'Excluído');

  const produtos = todos || [];
  const alvo = produtos.find((p: any) => p.id === produtoId);
  if (!alvo) return [produtoId];

  const idPaiAlvo = idPaiDe(alvo);
  const idsGrupo = produtos.filter((p: any) => idPaiDe(p) === idPaiAlvo).map((p: any) => p.id);

  return idsGrupo.length > 0 ? idsGrupo : [produtoId];
}

// Sincroniza os vínculos de um produto específico e de todo o seu grupo
// (produto pai + variações), em vez de percorrer o catálogo inteiro - útil
// quando o usuário só quer atualizar/conferir um produto pontual com os
// canais de venda.
export async function syncProdutoLoja(produtoId: number): Promise<{
  totalVinculos: number;
  status: 'sucesso' | 'erro';
  erro?: string;
}> {
  const supabase = createSupabaseClient();
  let totalVinculos = 0;

  try {
    const idsGrupo = await resolverGrupoProdutoIds(produtoId);
    console.log(`Iniciando sincronização de produto x lojas (produto ${produtoId}, grupo: ${idsGrupo.join(', ')})...`);

    const { data: canaisExistentes } = await supabase.from('bling_canais_venda').select('id');
    const canaisConhecidos = new Set<number>((canaisExistentes || []).map((c: any) => c.id));

    let vinculosGrupo: any[] = [];

    for (const id of idsGrupo) {
      let pagina = 1;
      while (true) {
        const resp = await blingRequest(`/produtos/lojas?idProduto=${id}&pagina=${pagina}&limite=100`);

        if (!resp.data || resp.data.length === 0) break;

        vinculosGrupo = vinculosGrupo.concat(resp.data);
        pagina++;
        await sleep(350); // Respeitar rate limit
      }
    }

    console.log(`Vínculos encontrados para o grupo do produto ${produtoId}: ${vinculosGrupo.length}`);

    const idsCanais = new Set<number>(vinculosGrupo.map((v) => v.loja?.id).filter(Boolean));
    for (const idCanal of idsCanais) {
      if (!canaisConhecidos.has(idCanal)) {
        await sincronizarCanalVenda(idCanal, canaisConhecidos);
        await sleep(350);
      }
    }

    for (const v of vinculosGrupo) {
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

    await supabase.from('bling_sync_log').insert({
      tipo: 'produtos_lojas',
      status: 'sucesso',
      detalhes: { produto_id: produtoId, grupo: idsGrupo, total_vinculos: totalVinculos },
    });

    return { totalVinculos, status: 'sucesso' };
  } catch (error: any) {
    console.error(`Erro na sincronização do produto ${produtoId} x lojas:`, error);

    await supabase.from('bling_sync_log').insert({
      tipo: 'produtos_lojas',
      status: 'erro',
      detalhes: { produto_id: produtoId, erro: error.message },
    });

    return { totalVinculos, status: 'erro', erro: error.message };
  }
}
