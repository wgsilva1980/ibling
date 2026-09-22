import { blingRequest } from '@/lib/bling/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idProduto, atributos } = body;

    console.log(`\n🔍 [DEBUG GERAR-COMBINACOES] Iniciando...`);
    console.log(`   idProduto: ${idProduto}`);
    console.log(`   atributos: ${JSON.stringify(atributos)}`);

    // Validar input
    if (!idProduto) {
      return NextResponse.json(
        { error: 'idProduto é obrigatório' },
        { status: 400 }
      );
    }

    if (!Array.isArray(atributos) || atributos.length === 0) {
      return NextResponse.json(
        { error: 'atributos deve ser um array não-vazio' },
        { status: 400 }
      );
    }

    console.log(`✓ Input validado`);

    // Preparar payload
    const payload = {
      idProduto,
      atributos,
    };

    console.log(`📤 Enviando para Bling:`);
    console.log(`   POST /produtos/variacoes/atributos/gerar-combinacoes`);
    console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

    // Chamar endpoint
    const startTime = Date.now();
    console.log(`⏱️  Iniciando requisição...`);

    let response;
    try {
      response = await blingRequest('/produtos/variacoes/atributos/gerar-combinacoes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const elapsed = Date.now() - startTime;
      console.log(`✓ Requisição completada em ${elapsed}ms`);
    } catch (fetchErr: any) {
      console.error(`❌ Erro ao fazer requisição:`);
      console.error(`   Mensagem: ${fetchErr.message}`);
      console.error(`   Stack: ${fetchErr.stack}`);
      throw fetchErr;
    }

    console.log(`📥 Resposta recebida:`);
    console.log(`   Tipo: ${typeof response}`);
    console.log(`   É null? ${response === null}`);
    console.log(`   É undefined? ${response === undefined}`);
    console.log(`   Conteúdo: ${JSON.stringify(response, null, 2)}`);

    // Validar resposta
    if (!response) {
      console.error(`❌ Resposta vazia ou null!`);
      return NextResponse.json(
        {
          error: 'Bling retornou resposta vazia',
          debug: {
            response,
            type: typeof response,
          }
        },
        { status: 500 }
      );
    }

    console.log(`✅ Resposta válida!`);

    return NextResponse.json({
      message: 'Combinações geradas com sucesso',
      debug: {
        requestPayload: payload,
        responseReceived: response,
      },
      data: response,
    });
  } catch (error: any) {
    console.error(`\n❌ [DEBUG GERAR-COMBINACOES] ERRO GERAL:`);
    console.error(`   Tipo: ${error.constructor.name}`);
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Status: ${error.status}`);
    console.error(`   Stack: ${error.stack}`);
    console.error(`   Erro completo: ${JSON.stringify(error, null, 2)}`);

    return NextResponse.json(
      {
        error: error.message || 'Erro ao gerar combinações',
        debug: {
          type: error.constructor.name,
          status: error.status,
          message: error.message,
          fullError: JSON.stringify(error),
        },
      },
      { status: error.status || 500 }
    );
  }
}
