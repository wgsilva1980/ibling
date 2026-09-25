import { criarCategoria } from '@/lib/bling/categorias';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descricao, categoriaPaiId } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json(
        { error: 'Descrição é obrigatória' },
        { status: 400 }
      );
    }

    const categoria = await criarCategoria(descricao.trim(), categoriaPaiId || null);

    return NextResponse.json(
      { message: 'Categoria criada com sucesso', data: categoria },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar categoria:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar categoria' },
      { status: 500 }
    );
  }
}
