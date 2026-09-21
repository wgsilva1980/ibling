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

    // Se tem produto pai, atualizar produto pai com nova variação
    if (produtoPaiId) {
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;

      if (isNaN(idPai)) {
        throw new Error(`produtoPaiId inválido: ${produtoPaiId}`);
      }

      console.log(`Atualizando produto pai ${idPai} com nova variação`);

      // Buscar produto pai com suas variações atuais
      const produtoPai = await blingRequest(`/produtos/${idPai}`);
      console.log(`Produto pai atual:`, JSON.stringify(produtoPai.data, null, 2));

      // Preparar a nova variação
      // Variações não devem ter tipo nem formato, apenas dados básicos
      const novaVariacao: any = {
        codigo,
        nome,
        preco: parseFloat(preco.toString()),
        situacao: situacao === 'Ativo' ? 'A' : 'I',
      };

      // Manter variações antigas
      let variacoes: any[] = [];
      if (produtoPai.data.variacoes && Array.isArray(produtoPai.data.variacoes)) {
        variacoes = produtoPai.data.variacoes;
      }

      // Adicionar nova variação
      variacoes.push(novaVariacao);

      // Montar payload do PUT com todas as variações (antigas + nova)
      const corpoAtualizacao: any = {
        nome: produtoPai.data.nome,
        preco: produtoPai.data.preco,
        situacao: produtoPai.data.situacao,
        tipo: produtoPai.data.tipo || 'P',
        formato: 'E', // Quando tem variações, formato deve ser 'E' (Estrutura/Com composição)
        variacoes,
      };

      console.log(`Payload para atualizar produto pai:`, JSON.stringify(corpoAtualizacao, null, 2));

      // Atualizar produto pai com nova variação
      response = await blingRequest(`/produtos/${idPai}`, {
        method: 'PUT',
        body: JSON.stringify(corpoAtualizacao),
      });

      console.log(`Produto pai atualizado:`, JSON.stringify(response.data, null, 2));

      if (!response.data) {
        throw new Error('Falha ao atualizar produto pai no Bling');
      }
    } else {
      // Criar produto simples sem variações
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

      console.log(`Produto criado:`, JSON.stringify(response.data, null, 2));

      if (!response.data) {
        throw new Error('Falha ao criar produto no Bling: resposta vazia');
      }
    }

    // Se criou produto pai com variações, usar o ID do pai. Se criou produto novo, usar o novo ID
    const novoId = produtoPaiId ? produtoPaiId : response.data.id;
    console.log(`ID para salvar no Supabase: ${novoId}`);

    // Salvar/atualizar no Supabase
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
