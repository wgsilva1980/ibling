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
    const { nome, preco, descricaoCurta, descricaoComplementar, situacao } = body;

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

    // Se for variação, buscar produto completo do Bling para obter todas as variações
    let blingProduto: any = null;
    if (formato === 'V') {
      try {
        const response = await blingRequest(`/produtos/${id}`);
        blingProduto = response.data;
        console.log(`Produto atual do Bling:`, JSON.stringify(blingProduto, null, 2));
      } catch (err) {
        console.error('Erro ao buscar produto do Bling:', err);
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

    // Atualizar no Supabase
    await supabase.from('bling_produtos').update({
      nome,
      preco: parseFloat(preco.toString()),
      situacao: situacao || 'Ativo',
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
