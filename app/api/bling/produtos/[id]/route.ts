import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const { id } = await params;

  try {
    const body = await req.json();
    const { nome, preco, descricaoCurta, descricaoComplementar, situacao, categoriaId } = body;

    if (!nome || !preco) {
      return NextResponse.json(
        { error: 'Nome e preço são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar produto atual para obter tipo e formato
    const { data: produtoAtual, error: fetchError } = await supabase
      .from('bling_produtos')
      .select('raw')
      .eq('id', id)
      .single();

    if (fetchError || !produtoAtual) {
      return NextResponse.json(
        { error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const tipo = produtoAtual.raw?.tipo || 'P';
    const formato = produtoAtual.raw?.formato || 'S';

    // Se for produto pai (com variações), o Bling exige que o array de
    // variações seja reenviado em todo PUT, então buscamos o produto
    // completo primeiro. Se essa busca falhar, é preciso interromper aqui
    // (e não seguir com formato: 'V' sem variações) - senão o Bling rejeita
    // a atualização por completo com um erro de validação confuso.
    let blingProduto: any = null;
    if (formato === 'V') {
      const response = await blingRequest(`/produtos/${id}`);
      blingProduto = response.data;

      if (!blingProduto?.variacoes || blingProduto.variacoes.length === 0) {
        throw new Error('O Bling não retornou nenhuma variação vinculada a este produto pai - a atualização foi interrompida para não enviar um payload inválido. Verifique se as variações ainda estão vinculadas a este produto no Bling.');
      }
    }

    // Preparar payload para o Bling
    const blingPayload: any = {
      nome,
      preco: parseFloat(preco.toString()),
      descricaoCurta: descricaoCurta || '',
      descricaoComplementar: descricaoComplementar || '',
      situacao: situacao === 'Ativo' ? 'A' : 'I',
      tipo,
      formato,
    };

    if (categoriaId) {
      blingPayload.categoria = { id: Number(categoriaId) };
    }

    // Se for variação, incluir variações do Bling
    if (formato === 'V' && blingProduto?.variacoes) {
      blingPayload.variacoes = blingProduto.variacoes;
    }

    // Atualizar no Bling
    console.log(`Atualizando produto ${id} no Bling`);
    console.log(`Payload enviado:`, JSON.stringify(blingPayload, null, 2));
    await blingRequest(`/produtos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(blingPayload),
    });

    // Atualizar no Supabase (mescla a categoria no raw já salvo, sem perder outros campos)
    const rawAtualizado = categoriaId
      ? { ...(produtoAtual.raw || {}), categoria: { id: Number(categoriaId) } }
      : produtoAtual.raw;

    await supabase.from('bling_produtos').update({
      nome,
      preco: parseFloat(preco.toString()),
      situacao: situacao || 'Ativo',
      raw: rawAtualizado,
      atualizado_em: new Date().toISOString(),
    }).eq('id', id);

    // Registrar no log
    await supabase.from('bling_sync_log').insert({
      tipo: 'edição',
      status: 'sucesso',
      detalhes: { ação: 'produto atualizado', id, dados: { nome, preco, situacao } },
    });

    return NextResponse.json(
      { message: 'Produto atualizado com sucesso' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'edição',
        status: 'erro',
        detalhes: { ação: 'falha ao atualizar produto', id, erro: error.message },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar produto' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const { id } = await params;

  try {
    console.log(`Deletando produto ${id}`);

    // Deletar do Supabase
    const { error: deleteError } = await supabase
      .from('bling_produtos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Registrar no log
    await supabase.from('bling_sync_log').insert({
      tipo: 'deleção',
      status: 'sucesso',
      detalhes: { ação: 'produto deletado', id },
    });

    return NextResponse.json(
      { message: 'Produto deletado com sucesso' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao deletar produto:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'deleção',
        status: 'erro',
        detalhes: { ação: 'falha ao deletar produto', id, erro: error.message },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao deletar produto' },
      { status: 500 }
    );
  }
}
