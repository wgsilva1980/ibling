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

    // Passo 2: Se tem produto pai, gerar combinações de variações
    if (produtoPaiId) {
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;

      if (!isNaN(idPai)) {
        try {
          console.log(`Gerando combinações de variações para produto pai ${idPai}`);

          // Buscar o produto pai e todas as suas variações
          const produtoPai = await blingRequest(`/produtos/${idPai}`);
          const { nomeBase: baseDoGrupo } = extrairAtributos(produtoPai.data.nome);

          console.log(`Nome base do grupo: ${baseDoGrupo}`);

          // Buscar todas as variações do grupo (produtos com mesmo nome base)
          // Fazer uma busca por nome similar no Supabase
          const { data: todasAsVariacoes } = await supabase
            .from('bling_produtos')
            .select('id, nome, codigo, preco, situacao')
            .ilike('nome', `${baseDoGrupo}%`);

          console.log(`Encontradas ${todasAsVariacoes?.length || 0} variações do grupo`);

          // Agrupar os atributos e suas opções
          const atributosMap: { [key: string]: Set<string> } = {};

          for (const variacao of todasAsVariacoes || []) {
            const { atributos } = extrairAtributos(variacao.nome);
            for (const [nomeAtributo, opcao] of Object.entries(atributos)) {
              if (!atributosMap[nomeAtributo]) {
                atributosMap[nomeAtributo] = new Set();
              }
              atributosMap[nomeAtributo].add(opcao);
            }
          }

          // Converter para formato esperado pela API
          const atributos = Object.entries(atributosMap).map(([nome, opcoes]) => ({
            nome,
            opcoes: Array.from(opcoes).sort(),
          }));

          console.log(`Atributos encontrados:`, JSON.stringify(atributos, null, 2));

          if (atributos.length > 0) {
            // Chamar endpoint correto: POST /Api/v3/produtovariacao/atributo
            const payloadVariacao = {
              idProdutoPai: idPai.toString(),
              atributos: atributos.map(attr => ({
                nome: attr.nome,
                opcoes: attr.opcoes,
                opcaoUnica: attr.opcoes.length === 1,
              })),
            };

            console.log(`Payload para produtovariacao/atributo:`, JSON.stringify(payloadVariacao, null, 2));

            const variacaoResponse = await blingRequest('/produtovariacao/atributo', {
              method: 'POST',
              body: JSON.stringify(payloadVariacao),
            });

            console.log(`Produto pai com variações vinculadas:`, JSON.stringify(variacaoResponse.data, null, 2));
          }
        } catch (err: any) {
          console.error(`Erro ao vincular variações ao produto pai ${idPai}:`);
          console.error(`Mensagem:`, err.message);
          console.error(`Stack:`, err.stack);
          console.error(`Erro completo:`, JSON.stringify(err, null, 2));
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
