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

    // Se há produto pai, criar como variação (tipo V)
    let isVariacao = false;
    let produtoMae: any = null;

    if (produtoPaiId) {
      // Garantir que produtoPaiId é um número
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;

      if (isNaN(idPai)) {
        throw new Error(`produtoPaiId inválido: ${produtoPaiId}`);
      }

      console.log(`Buscando produto pai com ID: ${idPai}`);

      // Buscar dados do produto pai para usar o mesmo formato
      try {
        const response = await blingRequest(`/produtos/${idPai}`);
        produtoMae = response.data;
        console.log(`Produto pai encontrado:`, JSON.stringify(produtoMae, null, 2));
      } catch (err: any) {
        console.error(`Erro ao buscar produto pai ${idPai}:`, err);
        // Continuar mesmo se não conseguir buscar, pois pode ser timeout
      }
      isVariacao = true;
    }

    // Montar corpo do request
    const corpo: any = {
      codigo,
      nome,
      preco: parseFloat(preco.toString()),
      situacao: situacao === 'Ativo' ? 'A' : 'I',
    };

    // Adicionar formato apenas para produtos simples, não para variações
    if (!isVariacao) {
      corpo.formato = 'S';
      corpo.tipo = 'P';
    } else {
      corpo.tipo = 'V';
      corpo.pai = { id: produtoPaiId };
      // Usar formato do produto pai se disponível
      if (produtoMae?.formato) {
        corpo.formato = produtoMae.formato;
      }
    }

    // Criar no Bling
    console.log(`Payload enviado para Bling:`, JSON.stringify(corpo, null, 2));

    const response = await blingRequest('/produtos', {
      method: 'POST',
      body: JSON.stringify(corpo),
    });

    console.log(`Resposta do Bling:`, JSON.stringify(response, null, 2));

    if (!response.data) {
      throw new Error('Falha ao criar produto no Bling: resposta vazia');
    }

    const novoId = response.data.id;
    console.log(`Produto criado com sucesso no Bling: ${novoId}`);

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
