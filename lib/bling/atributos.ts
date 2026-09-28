// Suporta dois formatos:
// 1. Produtos criados pela própria app: atributos embutidos no nome ("NOME COR:x;TAM:y")
// 2. Produtos sincronizados direto do Bling: nome idêntico ao pai, atributos em raw.variacao.nome
export function extrairAtributos(nome: string, raw?: any) {
  const padraoAtributo = /(?:COR[,:]{1,2}|Cor[,:]{1,2}|TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})/i;

  const textoParaExtrairAtributos = (() => {
    const nomeVariacao = raw?.variacao?.nome as string | undefined;
    if (nomeVariacao && padraoAtributo.test(nomeVariacao)) return nomeVariacao;
    return nome;
  })();

  let nomeBase = nome;
  let cor = '';
  let tamanho = '';

  // O nome base só é recortado a partir do próprio campo "nome" (não do nome aninhado da variação)
  const primeiroAtributo = nome.search(padraoAtributo);
  if (primeiroAtributo !== -1) {
    nomeBase = nome.substring(0, primeiroAtributo).trim();
  }

  const matchCor = textoParaExtrairAtributos.match(/(?:COR[,:]{1,2}|Cor[,:]{1,2})\s*([^;]+)/i);
  if (matchCor) {
    cor = matchCor[1].trim();
  }

  const matchTam = textoParaExtrairAtributos.match(/(?:TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})\s*([^;]+)/i);
  if (matchTam) {
    tamanho = matchTam[1].trim();
  }

  return { nomeBase, cor, tamanho };
}
