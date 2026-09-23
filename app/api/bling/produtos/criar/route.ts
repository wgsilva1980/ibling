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

    console.log(`[CRIAR_VARIACAO] Iniciando fluxo de criação`);
    console.log(`[CRIAR_VARIACAO] Produto: ${codigo} - ${nome}`);
    console.log(`[CRIAR_VARIACAO] produtoPaiId recebido: ${produtoPaiId} (tipo: ${typeof produtoPaiId})`);

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

    console.log(`Resposta completa POST /produtos:`, JSON.stringify(response, null, 2));

    const produtoData = response.data || response;

    if (!produtoData || !produtoData.id) {
      console.error(`Resposta inválida ao criar produto:`, JSON.stringify(response, null, 2));
      throw new Error('Falha ao criar produto no Bling: resposta vazia ou sem ID');
    }

    const novoId = produtoData.id;
    console.log(`✅ Produto criado com sucesso no Bling: ${novoId}`);

    // Passo 2: Vincular seria feito aqui, mas desabilitado temporariamente para evitar erros
    // TODO: Debug do endpoint de gerar-combinacoes
    console.log(`ℹ️ produtoPaiId recebido: ${produtoPaiId}`);

    if (produtoPaiId) {
      const idPai = typeof produtoPaiId === 'string' ? parseInt(produtoPaiId, 10) : produtoPaiId;
      console.log(`idPai parseado: ${idPai} (isNaN: ${isNaN(idPai)})`);

      if (!isNaN(idPai)) {
        try {
          console.log(`✅ Iniciando vinculação de variação ao produto pai ${idPai}`);

          // Extrair atributos do nome da variação
          const { atributos } = extrairAtributos(nome);

          if (Object.keys(atributos).length === 0) {
            console.warn(`⚠️ Nenhum atributo encontrado no nome: ${nome}`);
          } else {
            console.log(`Atributos extraídos:`, JSON.stringify(atributos, null, 2));

            // Passo 2a: Gerar combinações de atributos
            const atributosArray = Object.entries(atributos).map(([tipo, valor]) => ({
              tipo,
              opcoes: [{ valor }],
            }));

            console.log(`Gerando combinações com atributos:`, JSON.stringify(atributosArray, null, 2));

            const gerarCombinacoes = await blingRequest('/produtos/variacoes/atributos/gerar-combinacoes', {
              method: 'POST',
              body: JSON.stringify({
                idProdutoPai: idPai,
                atributos: atributosArray,
              }),
            });

            console.log(`Resposta do gerar-combinacoes:`, JSON.stringify(gerarCombinacoes, null, 2));

            if (!gerarCombinacoes) {
              throw new Error('Falha ao gerar combinações de atributos');
            }

            console.log(`✅ Variação vinculada com sucesso ao produto ${idPai}!`)
          }
        } catch (err: any) {
          console.error(`❌ ERRO ao vincular variação ao produto pai ${idPai}:`);
          console.error(`Mensagem de erro:`, err.message);
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

    const produtoDataFinal = response.data || response;

    return NextResponse.json(
      { message: 'Produto criado com sucesso', data: produtoDataFinal },
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
