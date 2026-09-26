import { atualizarCategoria } from '@/lib/bling/categorias';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { descricao, categoriaPaiId } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json(
        { error: 'Descrição é obrigatória' },
        { status: 400 }
      );
    }

    const idNumerico = parseInt(id, 10);

    if (categoriaPaiId && Number(categoriaPaiId) === idNumerico) {
      return NextResponse.json(
        { error: 'Uma categoria não pode ser pai de si mesma' },
        { status: 400 }
      );
    }

    const categoria = await atualizarCategoria(idNumerico, descricao.trim(), categoriaPaiId || null);
    const { _avisoParentNaoAlterado, ...categoriaLimpa } = categoria;

    return NextResponse.json(
      _avisoParentNaoAlterado
        ? {
            message: 'Categoria atualizada, mas a categoria pai não pôde ser alterada',
            aviso: 'O Bling não permite alterar a categoria pai de uma categoria já existente por esta API - isso só é possível na criação. A descrição foi salva normalmente.',
            data: categoriaLimpa,
          }
        : { message: 'Categoria atualizada com sucesso', data: categoriaLimpa },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar categoria:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar categoria' },
      { status: 500 }
    );
  }
}
