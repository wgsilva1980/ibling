import { createSupabaseClient } from '@/lib/supabase/server';
import { blingRequest } from '@/lib/bling/client';
import { idPaiDe, syncProdutoLoja } from '@/lib/bling/canaisVenda';
import { extrairAtributos } from '@/lib/bling/atributos';
import {
  atualizarVarianteNuvemshop,
  buscarProdutoNuvemshop,
  criarProdutoNuvemshop,
  criarVarianteNuvemshop,
} from './produtos';

interface ProdutoBling {
  id: number;
  codigo: string;
  nome: string;
  preco: number;
  saldo_fisico_total: number;
  raw?: any;
}

function valoresDoAtributo(produto: ProdutoBling): { pt: string }[] {
  const { cor, tamanho } = extrairAtributos(produto.nome, produto.raw);
  const values: { pt: string }[] = [];
  if (cor) values.push({ pt: cor });
  if (tamanho) values.push({ pt: tamanho });
  return values;
}

function estoqueDe(produto: ProdutoBling): number {
  return Math.max(0, Math.floor(Number(produto.saldo_fisico_total) || 0));
}

// Sincroniza um produto (e todo o seu grupo de variações) direto com a
// Nuvemshop via API, sem depender da sincronização nativa do Bling:
// - Se o grupo já foi publicado pelo Bling (bling_produtos_lojas.codigo
//   preenchido) ou por uma sincronização anterior desta função
//   (nuvemshop_product_mapping), só atualiza estoque/preço das variações
//   existentes e cria as que ainda faltarem no produto já existente.
// - Se nunca foi publicado, cria o produto inteiro (pai + variações) de uma
//   vez na Nuvemshop e registra o mapeamento local + o vínculo no Bling.
export async function syncGrupoComNuvemshop(produtoId: number): Promise<{
  produtoNuvemshopId: number | null;
  criados: number;
  atualizados: number;
  status: 'sucesso' | 'erro';
  erro?: string;
}> {
  const supabase = createSupabaseClient();
  let criados = 0;
  let atualizados = 0;

  try {
    const { data: canal } = await supabase
      .from('bling_canais_venda')
      .select('id')
      .eq('tipo', 'Nuvemshop')
      .single();

    if (!canal) {
      throw new Error('Canal Nuvemshop não encontrado. Sincronize os canais de venda primeiro.');
    }
    const canalId: number = canal.id;

    const { data: todos } = await supabase
      .from('bling_produtos')
      .select('id, codigo, nome, preco, saldo_fisico_total, raw')
      .neq('situacao', 'Excluído');

    const produtos: ProdutoBling[] = todos || [];
    const alvo = produtos.find((p) => p.id === produtoId);
    if (!alvo) throw new Error(`Produto ${produtoId} não encontrado`);

    const idPaiAlvo = idPaiDe(alvo);
    const grupo = produtos.filter((p) => idPaiDe(p) === idPaiAlvo);
    const pai = grupo.find((p) => p.id === idPaiAlvo) || alvo;
    const variacoes = grupo.filter((p) => p.id !== pai.id);
    const idsGrupo = grupo.map((p) => p.id);

    const [{ data: vinculosBling }, { data: mapeamentos }] = await Promise.all([
      supabase
        .from('bling_produtos_lojas')
        .select('produto_id, codigo')
        .eq('canal_venda_id', canalId)
        .in('produto_id', idsGrupo),
      supabase
        .from('nuvemshop_product_mapping')
        .select('bling_product_id, nuvemshop_product_code')
        .in('bling_product_id', idsGrupo),
    ]);

    const codigoBlingPorProduto = new Map<number, string>(
      (vinculosBling || [])
        .filter((v: any) => v.codigo && v.codigo !== '0')
        .map((v: any) => [v.produto_id, v.codigo])
    );
    const codigoMapeadoPorProduto = new Map<number, string>(
      (mapeamentos || []).map((m: any) => [m.bling_product_id, m.nuvemshop_product_code])
    );

    function nuvemshopIdDe(produto: ProdutoBling): string | null {
      return codigoBlingPorProduto.get(produto.id) || codigoMapeadoPorProduto.get(produto.id) || null;
    }

    // Registra localmente (nossa própria tabela de mapeamento, fonte de
    // verdade independente do Bling) e tenta registrar no Bling também -
    // formato do payload não pôde ser validado ao vivo antes desta
    // implementação (a escrita de teste foi bloqueada pelo classificador de
    // segurança), então isso é melhor-esforço: se falhar, o produto já foi
    // criado de verdade na Nuvemshop mesmo assim, só o Bling não fica sabendo.
    async function registrarMapeamento(produto: ProdutoBling, nuvemshopProductId: number, nuvemshopCode: string) {
      await supabase.from('nuvemshop_product_mapping').upsert(
        {
          bling_product_id: produto.id,
          nuvemshop_product_id: nuvemshopProductId,
          bling_product_code: produto.codigo,
          nuvemshop_product_code: nuvemshopCode,
          last_sync: new Date().toISOString(),
        },
        { onConflict: 'bling_product_id' }
      );

      try {
        await blingRequest('/produtos/lojas', {
          method: 'POST',
          body: JSON.stringify({
            produto: { id: produto.id },
            loja: { id: canalId },
            idProdutoLoja: nuvemshopCode,
            codigo: produto.codigo,
            preco: produto.preco,
          }),
        });
      } catch (error: any) {
        console.warn(`Não foi possível registrar o vínculo no Bling para produto ${produto.id}: ${error.message}`);
      }
    }

    const codigoPai = nuvemshopIdDe(pai);
    let produtoNuvemshopId: number;

    if (!codigoPai) {
      // Nunca publicado - cria o produto inteiro (pai + variações) de uma vez
      const itensParaCriar = variacoes.length > 0 ? variacoes : [pai];
      const atributosSet = new Set<string>();
      itensParaCriar.forEach((v) => {
        const { cor, tamanho } = extrairAtributos(v.nome, v.raw);
        if (cor) atributosSet.add('Cor');
        if (tamanho) atributosSet.add('Tamanho');
      });

      const variantesPayload = itensParaCriar.map((v) => ({
        sku: v.codigo,
        price: String(v.preco ?? pai.preco ?? 0),
        stock_management: true,
        stock: estoqueDe(v),
        values: valoresDoAtributo(v),
      }));

      const { nomeBase } = extrairAtributos(pai.nome, pai.raw);

      const criado = await criarProdutoNuvemshop({
        nome: nomeBase || pai.nome,
        atributos: Array.from(atributosSet),
        variantes: variantesPayload,
      });

      criados++;
      produtoNuvemshopId = criado.id;
      await registrarMapeamento(pai, criado.id, String(criado.id));

      for (let i = 0; i < itensParaCriar.length; i++) {
        const variante = criado.variants?.[i];
        if (variante) {
          await registrarMapeamento(itensParaCriar[i], criado.id, String(variante.id));
        }
      }
    } else {
      // Já publicado - atualiza estoque/preço das variações existentes e cria
      // as que ainda faltarem no produto já existente (ex: CALÇA ELLA, onde só
      // o pai tinha vínculo com a Nuvemshop)
      produtoNuvemshopId = Number(codigoPai);

      if (variacoes.length === 0) {
        const produtoAtual = await buscarProdutoNuvemshop(produtoNuvemshopId);
        const varianteUnica = produtoAtual.variants?.[0];
        if (varianteUnica) {
          await atualizarVarianteNuvemshop(produtoNuvemshopId, varianteUnica.id, {
            price: String(pai.preco ?? 0),
            stock: estoqueDe(pai),
          });
          atualizados++;
          await registrarMapeamento(pai, produtoNuvemshopId, String(varianteUnica.id));
        }
      } else {
        for (const v of variacoes) {
          const codigoAtual = nuvemshopIdDe(v);
          const stock = estoqueDe(v);
          const price = String(v.preco ?? pai.preco ?? 0);

          if (codigoAtual) {
            await atualizarVarianteNuvemshop(produtoNuvemshopId, Number(codigoAtual), { price, stock });
            atualizados++;
          } else {
            const novaVariante = await criarVarianteNuvemshop(produtoNuvemshopId, {
              sku: v.codigo,
              price,
              stock_management: true,
              stock,
              values: valoresDoAtributo(v),
            });
            criados++;
            await registrarMapeamento(v, produtoNuvemshopId, String(novaVariante.id));
          }
        }
      }
    }

    // Atualiza os timestamps locais do vínculo (a partir da própria cópia do
    // Bling, sem custo/risco - é a mesma leitura já usada na tela de Canais de
    // Venda) para que o produto pare de aparecer como pendente.
    await syncProdutoLoja(pai.id, canalId);

    await supabase.from('nuvemshop_sync_log').insert({
      tipo: 'produto_estoque',
      status: 'sucesso',
      detalhes: { produto_id: produtoId, produto_nuvemshop_id: produtoNuvemshopId, criados, atualizados },
    });

    return { produtoNuvemshopId, criados, atualizados, status: 'sucesso' };
  } catch (error: any) {
    console.error(`Erro ao sincronizar produto ${produtoId} com a Nuvemshop:`, error);
    await supabase.from('nuvemshop_sync_log').insert({
      tipo: 'produto_estoque',
      status: 'erro',
      detalhes: { produto_id: produtoId, erro: error.message },
    });
    return { produtoNuvemshopId: null, criados, atualizados, status: 'erro', erro: error.message };
  }
}
