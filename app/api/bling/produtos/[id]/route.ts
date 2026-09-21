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

    // Atualizar no Bling
    console.log(`Atualizando produto ${id} no Bling`);
    await blingRequest(`/produtos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nome,
        preco: parseFloat(preco.toString()),
        descricaoCurta: descricaoCurta || '',
        descricaoComplementar: descricaoComplementar || '',
        situacao: situacao === 'Ativo' ? 'A' : 'I',
      }),
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
