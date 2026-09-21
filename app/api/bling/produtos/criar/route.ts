import { blingRequest } from '@/lib/bling/client';
import { createSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Função para extrair nome base e atributos do nome do produto
function extrairAtributos(nome: string) {
  let nomeBase = nome;
  const atributos: { [key: string]: string } = {};

  const primeiroAtributo = nome.search(/(?:COR[,:]{1,2}|Cor[,:]{1,2}|TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})/i);

  if (primeiroAtributo !== -1) {
    nomeBase = nome.substring(0, primeiroAtributo).trim();
  }

  const matchCor = nome.match(/(?:COR[,:]{1,2}|Cor[,:]{1,2})\s*([^;]+)/i);
  if (matchCor) {
    atributos['COR'] = matchCor[1].trim();
  }

  const matchTam = nome.match(/(?:TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})\s*([^;]+)/i);
  if (matchTam) {
    atributos['TAM'] = matchTam[1].trim();
  }

  return { nomeBase, atributos };
}

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

    // Passo 2: Se tem produto pai, vincular a nova variação ao produto pai
    if (produtoPaiId) {
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;

      if (!isNaN(idPai)) {
        try {
          console.log(`Vinculando variação ao produto pai ${idPai}`);

          // Buscar o produto pai com todas as suas variações
          const produtoPaiResponse = await blingRequest(`/produtos/${idPai}`);
          const produtoPai = produtoPaiResponse.data;

          console.log(`Produto pai encontrado: ${produtoPai.nome}`);
          console.log(`Variações existentes: ${produtoPai.variacoes?.length || 0}`);

          // Preparar payload para PATCH: incluir todas as variações existentes + nova
          const variacoes: any[] = [];

          // Adicionar variações existentes com seus IDs
          if (produtoPai.variacoes && Array.isArray(produtoPai.variacoes)) {
            for (const varExistente of produtoPai.variacoes) {
              variacoes.push({
                id: varExistente.id,
              });
            }
          }

          // Adicionar a nova variação
          variacoes.push({
            nomeVariacao: nome,
            tipo: 'P',
            formato: 'S',
            codigo: codigo,
            preco: parseFloat(preco.toString()),
            situacao: situacao === 'Ativo' ? 'A' : 'I',
          });

          console.log(`Total de variações (existentes + nova): ${variacoes.length}`);

          // Preparar payload para PATCH
          const patchPayload = {
            nome: produtoPai.nome,
            codigo: produtoPai.codigo,
            preco: produtoPai.preco,
            tipo: produtoPai.tipo,
            formato: 'V', // Garantir que é formato variação
            situacao: produtoPai.situacao,
            unidade: produtoPai.unidade || 'UN',
            variacoes: variacoes,
          };

          console.log(`Payload para PATCH:`, JSON.stringify(patchPayload, null, 2));

          // Fazer PATCH no produto pai
          const patchResponse = await blingRequest(`/produtos/${idPai}`, {
            method: 'PATCH',
            body: JSON.stringify(patchPayload),
          });

          console.log(`Produto pai atualizado com nova variação:`, JSON.stringify(patchResponse.data, null, 2));
        } catch (err: any) {
          console.error(`Erro ao vincular variação ao produto pai ${idPai}:`);
          console.error(`Mensagem:`, err.message);
          console.error(`Erro completo:`, JSON.stringify(err, null, 2));
          // Continuar mesmo se falhar, pois a variação foi criada como produto independente
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
