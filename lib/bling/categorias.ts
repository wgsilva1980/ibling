import { blingRequest } from './client';
import { createSupabaseClient } from '@/lib/supabase/server';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncCategorias(): Promise<{
  totalCategorias: number;
  status: 'sucesso' | 'erro';
  erro?: string;
}> {
  const supabase = createSupabaseClient();
  let totalCategorias = 0;

  try {
    console.log('Iniciando sincronização de categorias...');

    let pagina = 1;
    let todasCategorias: any[] = [];

    while (true) {
      const resp = await blingRequest(`/categorias/produtos?pagina=${pagina}&limite=100`);

      if (!resp.data || resp.data.length === 0) break;

      todasCategorias = todasCategorias.concat(resp.data);
      console.log(`  Encontradas ${resp.data.length} categorias na página ${pagina}`);

      pagina++;
      await sleep(350); // Respeitar rate limit
    }

    console.log(`Total de categorias encontradas: ${todasCategorias.length}`);

    for (const c of todasCategorias) {
      try {
        const categoriaPaiId = c.categoriaPai?.id && c.categoriaPai.id !== 0 ? c.categoriaPai.id : null;

        await supabase.from('bling_categorias').upsert(
          {
            id: c.id,
            descricao: c.descricao,
            categoria_pai_id: categoriaPaiId,
            raw: c,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        totalCategorias++;
      } catch (error) {
        console.error(`Erro ao armazenar categoria ${c.id}:`, error);
      }
    }

    console.log(`Categorias armazenadas: ${totalCategorias}`);

    await supabase.from('bling_sync_log').insert({
      tipo: 'categorias',
      status: 'sucesso',
      detalhes: { total_categorias: totalCategorias },
    });

    return { totalCategorias, status: 'sucesso' };
  } catch (error: any) {
    console.error('Erro na sincronização de categorias:', error);

    await supabase.from('bling_sync_log').insert({
      tipo: 'categorias',
      status: 'erro',
      detalhes: { erro: error.message },
    });

    return { totalCategorias, status: 'erro', erro: error.message };
  }
}

async function salvarCategoriaLocal(categoria: any) {
  const supabase = createSupabaseClient();
  const categoriaPaiId = categoria.categoriaPai?.id && categoria.categoriaPai.id !== 0
    ? categoria.categoriaPai.id
    : null;

  await supabase.from('bling_categorias').upsert(
    {
      id: categoria.id,
      descricao: categoria.descricao,
      categoria_pai_id: categoriaPaiId,
      raw: categoria,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export async function criarCategoria(descricao: string, categoriaPaiId?: number | null) {
  const corpo = {
    descricao,
    categoriaPai: { id: categoriaPaiId || 0 },
  };

  const response = await blingRequest('/categorias/produtos', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });

  const categoriaCriada = response.data || response;

  if (!categoriaCriada || !categoriaCriada.id) {
    throw new Error('Falha ao criar categoria no Bling: resposta vazia ou sem ID');
  }

  // A resposta do POST pode vir sem os campos completos; buscar o detalhe
  const detalhe = await blingRequest(`/categorias/produtos/${categoriaCriada.id}`);
  await salvarCategoriaLocal(detalhe.data || categoriaCriada);

  return detalhe.data || categoriaCriada;
}

export async function atualizarCategoria(id: number, descricao: string, categoriaPaiId?: number | null) {
  const corpo = {
    descricao,
    categoriaPai: { id: categoriaPaiId || 0 },
  };

  await blingRequest(`/categorias/produtos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(corpo),
  });

  const detalhe = await blingRequest(`/categorias/produtos/${id}`);
  await salvarCategoriaLocal(detalhe.data);

  return detalhe.data;
}
