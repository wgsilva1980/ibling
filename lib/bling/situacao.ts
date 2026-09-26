// Normaliza o código de situação do Bling ('A'/'I'/'E') para o texto usado
// em todo o app ('Ativo'/'Inativo'/'Excluído'). Idempotente: se já vier
// normalizado (ou em outro valor inesperado), retorna como está.
export function normalizarSituacao(situacaoBling: string | undefined | null): string {
  if (situacaoBling === 'A') return 'Ativo';
  if (situacaoBling === 'I') return 'Inativo';
  if (situacaoBling === 'E') return 'Excluído';
  return situacaoBling || 'Ativo';
}
