import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await req.json();
    const { codigo, nome, preco, situacao } = body;

    if (!codigo || !nome || !preco) {
      return NextResponse.json(
        { error: 'Código, nome e preço são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`Criando novo produto no Bling: ${codigo} - ${nome}`);

    // Criar no Bling
    const response = await blingRequest('/produtos', {
      method: 'POST',
      body: JSON.stringify({
        codigo,
        nome,
        preco: parseFloat(preco.toString()),
        situacao: situacao === 'Ativo' ? 'A' : 'I',
        tipo: 'P',
        formato: 'S',
      }),
    });

    if (!response.data) {
      throw new Error('Falha ao criar produto no Bling');
    }

    const novoId = response.data.id;

    // Salvar no Supabase
    await supabase.from('bling_produtos').insert({
      id: novoId,
      codigo,
      nome,
      preco: parseFloat(preco.toString()),
      situacao,
      raw: response.data,
      atualizado_em: new Date().toISOString(),
    });

    // Registrar log
    await supabase.from('bling_sync_log').insert({
      tipo: 'criação',
      status: 'sucesso',
      detalhes: {
        ação: 'novo produto criado',
        codigo,
        nome,
        novoId,
      },
    });

    return NextResponse.json(
      { message: 'Produto criado com sucesso', data: response.data },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);

    try {
      const supabase = createSupabaseClient();
      await supabase.from('bling_sync_log').insert({
        tipo: 'criação',
        status: 'erro',
        detalhes: {
          ação: 'falha ao criar produto',
          erro: error.message,
        },
      });
    } catch (logError) {
      console.error('Erro ao registrar erro:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar produto' },
      { status: 500 }
    );
  }
}
