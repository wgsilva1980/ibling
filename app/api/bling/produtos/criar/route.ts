import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await req.json();
    const { nome, preco, situacao, produtoPaiId } = body;

    if (!nome || !preco) {
      return NextResponse.json(
        { error: 'Nome e preço são obrigatórios' },
        { status: 400 }
      );
    }

    // Gerar SKU automaticamente baseado no timestamp + random
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const codigo = `VAR-${timestamp}-${random}`;

    console.log(`Criando novo produto no Bling: ${codigo} - ${nome}`);
    console.log(`produtoPaiId recebido: ${produtoPaiId}`);

    let response: any = null;
    let novoId: number;

    // Se tem produto pai, adicionar como variação do produto pai
    if (produtoPaiId) {
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;

      if (isNaN(idPai)) {
        throw new Error(`produtoPaiId inválido: ${produtoPaiId}`);
      }

      console.log(`Adicionando variação ao produto pai ${idPai}`);

      // Preparar a nova variação para adicionar ao produto pai
      const novaVariacao: any = {
        codigo,
        nome,
        preco: parseFloat(preco.toString()),
        situacao: situacao === 'Ativo' ? 'A' : 'I',
      };

      console.log(`Variação a adicionar:`, JSON.stringify(novaVariacao, null, 2));

      // Usar endpoint específico para variações: POST /produtos/variacoes/{idProdutoPai}
      response = await blingRequest(`/produtos/variacoes/${idPai}`, {
        method: 'POST',
        body: JSON.stringify(novaVariacao),
      });

      console.log(`Resposta ao adicionar variação:`, JSON.stringify(response.data, null, 2));

      if (!response.data) {
        throw new Error('Falha ao adicionar variação no Bling');
      }

      // A resposta pode ser o produto pai atualizado ou a variação criada
      novoId = response.data.id || idPai;
    } else {
      // Criar produto simples (sem variações)
      const corpo: any = {
        codigo,
        nome,
        preco: parseFloat(preco.toString()),
        situacao: situacao === 'Ativo' ? 'A' : 'I',
        tipo: 'P',
        formato: 'S',
      };

      console.log(`Criando produto simples:`, JSON.stringify(corpo, null, 2));

      response = await blingRequest('/produtos', {
        method: 'POST',
        body: JSON.stringify(corpo),
      });

      console.log(`Resposta ao criar produto:`, JSON.stringify(response.data, null, 2));

      if (!response.data) {
        throw new Error('Falha ao criar produto no Bling: resposta vazia');
      }

      novoId = response.data.id;
    }

    console.log(`Produto/Variação criado com sucesso no Bling: ${novoId}`);

    // Salvar no Supabase
    if (produtoPaiId) {
      // Se é variação, atualizar o produto pai no Supabase
      await supabase.from('bling_produtos').update({
        raw: response.data,
        atualizado_em: new Date().toISOString(),
      }).eq('id', produtoPaiId);
    } else {
      // Se é novo produto, inserir
      await supabase.from('bling_produtos').insert({
        id: response.data.id,
        codigo,
        nome,
        preco: parseFloat(preco.toString()),
        situacao,
        raw: response.data,
        atualizado_em: new Date().toISOString(),
      });
    }

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
