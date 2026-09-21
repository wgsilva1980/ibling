import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const { id: produtoId } = await params;

  try {
    console.log(`Sincronizando fotos do produto ${produtoId} do Bling`);

    // Buscar produto completo do Bling para pegar as imagens
    const response = await blingRequest(`/produtos/${produtoId}`);

    if (!response.data) {
      return NextResponse.json(
        { error: 'Produto não encontrado no Bling' },
        { status: 404 }
      );
    }

    // Debug: Estrutura das imagens
    const imagensArray = response.data.imagens || response.data.fotos || [];
    const debugInfo = {
      tem_imagens: !!response.data.imagens,
      tem_fotos: !!response.data.fotos,
      imagens_length: imagensArray?.length || 0,
      primeira_imagem: imagensArray?.[0] || null,
      todas_as_chaves: Object.keys(response.data),
    };

    console.log(`Estrutura de imagens:`, debugInfo);

    // Atualizar no Supabase com dados atualizados (incluindo imagens)
    await supabase.from('bling_produtos').update({
      raw: response.data,
      atualizado_em: new Date().toISOString(),
    }).eq('id', produtoId);

    // Registrar log
    await supabase.from('bling_sync_log').insert({
      tipo: 'foto',
      status: 'sucesso',
      detalhes: {
        ação: 'fotos sincronizadas',
        produtoId,
        quantidadeFotos: imagensArray?.length || 0,
        debug: debugInfo,
      },
    });

    return NextResponse.json(
      {
        message: 'Fotos sincronizadas com sucesso',
        quantidadeFotos: imagensArray?.length || 0,
        debug: debugInfo,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao sincronizar fotos:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'foto',
        status: 'erro',
        detalhes: {
          ação: 'falha ao sincronizar fotos',
          produtoId: params,
          erro: error.message,
        },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar fotos' },
      { status: 500 }
    );
  }
}
