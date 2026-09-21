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
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não fornecido' },
        { status: 400 }
      );
    }

    // Converter arquivo para buffer
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    console.log(`Upload de foto para produto ${produtoId}`);

    // Enviar para Bling
    const response = await blingRequest(`/produtos/${produtoId}/imagens`, {
      method: 'POST',
      body: JSON.stringify({
        nome: file.name,
        conteudo: base64,
        tipo: file.type,
      }),
    });

    // Buscar produto atualizado do Bling para sincronizar
    const produtoAtualizado = await blingRequest(`/produtos/${produtoId}`);

    // Atualizar no Supabase com dados atualizados
    await supabase.from('bling_produtos').update({
      raw: produtoAtualizado.data,
      atualizado_em: new Date().toISOString(),
    }).eq('id', produtoId);

    // Registrar log
    await supabase.from('bling_sync_log').insert({
      tipo: 'foto',
      status: 'sucesso',
      detalhes: {
        ação: 'foto enviada',
        produtoId,
        arquivo: file.name,
      },
    });

    return NextResponse.json(
      { message: 'Foto enviada com sucesso', data: response.data },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao fazer upload de foto:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'foto',
        status: 'erro',
        detalhes: {
          ação: 'falha no upload',
          produtoId: params,
          erro: error.message,
        },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const { id: produtoId } = await params;

  try {
    const { fotoId } = await req.json();

    if (!fotoId) {
      return NextResponse.json(
        { error: 'ID da foto não fornecido' },
        { status: 400 }
      );
    }

    console.log(`Removendo foto ${fotoId} do produto ${produtoId}`);

    // Remover foto no Bling
    await blingRequest(`/produtos/${produtoId}/imagens/${fotoId}`, {
      method: 'DELETE',
    });

    // Buscar produto atualizado para sincronizar
    const produtoAtualizado = await blingRequest(`/produtos/${produtoId}`);

    // Atualizar no Supabase
    await supabase.from('bling_produtos').update({
      raw: produtoAtualizado.data,
      atualizado_em: new Date().toISOString(),
    }).eq('id', produtoId);

    // Registrar log
    await supabase.from('bling_sync_log').insert({
      tipo: 'foto',
      status: 'sucesso',
      detalhes: {
        ação: 'foto removida',
        produtoId,
        fotoId,
      },
    });

    return NextResponse.json(
      { message: 'Foto removida com sucesso' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao remover foto:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'foto',
        status: 'erro',
        detalhes: {
          ação: 'falha ao remover foto',
          produtoId: params,
          erro: error.message,
        },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao remover foto' },
      { status: 500 }
    );
  }
}
