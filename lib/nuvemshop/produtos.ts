import { nuvemshopRequest } from './client';

interface VarianteNuvemshop {
  sku: string;
  price: string;
  stock_management: boolean;
  stock: number;
  values: { pt: string }[];
}

interface ProdutoNuvemshop {
  id: number;
  variants: { id: number; sku: string }[];
}

export async function buscarProdutoNuvemshop(id: number): Promise<ProdutoNuvemshop> {
  return nuvemshopRequest(`/products/${id}`);
}

export async function criarProdutoNuvemshop(payload: {
  nome: string;
  atributos: string[];
  variantes: VarianteNuvemshop[];
}): Promise<ProdutoNuvemshop> {
  return nuvemshopRequest('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: { pt: payload.nome },
      attributes: payload.atributos.map((a) => ({ pt: a })),
      variants: payload.variantes,
      published: true,
    }),
  });
}

export async function criarVarianteNuvemshop(
  produtoId: number,
  variante: VarianteNuvemshop
): Promise<{ id: number }> {
  return nuvemshopRequest(`/products/${produtoId}/variants`, {
    method: 'POST',
    body: JSON.stringify(variante),
  });
}

export async function atualizarVarianteNuvemshop(
  produtoId: number,
  varianteId: number,
  dados: { price?: string; stock?: number }
): Promise<void> {
  await nuvemshopRequest(`/products/${produtoId}/variants/${varianteId}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}
