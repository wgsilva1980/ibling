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

    // Passo 1: Criar a variação como produto simples
    const corpo: any = {
      codigo,
      nome,
      preco: parseFloat(preco.toString()),
      situacao: situacao === 'Ativo' ? 'A' : 'I',
      tipo: 'P',
      formato: 'S',
    };

    console.log(`Criando produto/variação no Bling:`, JSON.stringify(corpo, null, 2));

    const response = await blingRequest('/produtos', {
      method: 'POST',
      body: JSON.stringify(corpo),
    });

    console.log(`Resposta ao criar produto:`, JSON.stringify(response.data, null, 2));

    if (!response.data) {
      throw new Error('Falha ao criar produto no Bling: resposta vazia');
    }

    const novoId = response.data.id;
    console.log(`Produto criado com sucesso no Bling: ${novoId}`);

    // Passo 2: Se tem produto pai, fazer PUT no pai para reconhecer as variações
    if (produtoPaiId) {
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;

      if (!isNaN(idPai)) {
        try {
          console.log(`Atualizando produto pai ${idPai} para reconhecer variações`);

          // Buscar dados atuais do produto pai
          const produtoPai = await blingRequest(`/produtos/${idPai}`);
          console.log(`Dados atuais do produto pai:`, JSON.stringify(produtoPai.data, null, 2));

          // Fazer PUT no produto pai para reconhecer as variações criadas
          const payloadPai: any = {
            nome: produtoPai.data.nome,
            codigo: produtoPai.data.codigo,
            preco: produtoPai.data.preco,
            descricaoCurta: produtoPai.data.descricaoCurta || '',
            situacao: produtoPai.data.situacao,
            tipo: produtoPai.data.tipo || 'P',
            formato: produtoPai.data.formato || 'S',
          };

          // Preservar outros campos importantes
          if (produtoPai.data.descricaoComplementar) {
            payloadPai.descricaoComplementar = produtoPai.data.descricaoComplementar;
          }
          if (produtoPai.data.categoria) {
            payloadPai.categoria = produtoPai.data.categoria;
          }

          console.log(`Payload do PUT no produto pai:`, JSON.stringify(payloadPai, null, 2));

          const putResponse = await blingRequest(`/produtos/${idPai}`, {
            method: 'PUT',
            body: JSON.stringify(payloadPai),
          });

          console.log(`Produto pai atualizado:`, JSON.stringify(putResponse.data, null, 2));
        } catch (err: any) {
          console.error(`Erro ao atualizar produto pai ${idPai}:`, err.message);
          // Continuar mesmo se falhar, pois a variação foi criada
        }
      }
    }

    // Passo 3: Salvar no Supabase
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
