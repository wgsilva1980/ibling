'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';
import Link from 'next/link';

interface Movimentacao {
  deposito_id: number;
  deposito_nome: string;
  tipo_operacao: string;
  quantidade: number;
  saldo_anterior: number;
  saldo_novo: number;
}

interface Log {
  id: number;
  tipo: string;
  status: string;
  detalhes: {
    ação: string;
    produtoId: string;
    movimentacoes?: Movimentacao[];
  };
  created_at: string;
}

interface Produto {
  id: number;
  codigo: string;
  nome: string;
}

export default function LogsPage() {
  const params = useParams();
  const produtoId = params.id as string;
  const supabase = createSupabaseClientBrowser();

  const [produto, setProduto] = useState<Produto | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Buscar produto
        const { data: produtoData, error: produtoError } = await supabase
          .from('bling_produtos')
          .select('id, codigo, nome')
          .eq('id', parseInt(produtoId))
          .single();

        if (produtoError) throw produtoError;
        setProduto(produtoData);

        // Buscar logs de movimentação
        const { data: logsData, error: logsError } = await supabase
          .from('bling_sync_log')
          .select('*')
          .eq('detalhes->>produtoId', produtoId)
          .eq('tipo', 'movimentação')
          .order('created_at', { ascending: false });

        if (logsError) throw logsError;
        setLogs(logsData || []);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar logs');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [produtoId, supabase]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Carregando logs...
      </div>
    );
  }

  if (error || !produto) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#c00', marginBottom: '16px' }}>
          {error || 'Produto não encontrado'}
        </div>
        <Link href="/produtos" style={{ color: '#0066cc' }}>
          ← Voltar para produtos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/produtos/${produtoId}`} style={{
        color: '#0066cc',
        textDecoration: 'none',
        fontSize: '14px',
        marginBottom: '16px',
        display: 'inline-block'
      }}>
        ← Voltar para {produto.codigo}
      </Link>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ marginTop: 0, marginBottom: '24px' }}>
          Histórico de Movimentações: {produto.codigo}
        </h1>

        {logs.length === 0 ? (
          <p style={{ color: '#666', fontSize: '14px' }}>
            Nenhuma movimentação registrada para este produto.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  backgroundColor: log.status === 'sucesso' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${log.status === 'sucesso' ? '#86efac' : '#fecaca'}`,
                  borderRadius: '6px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600' }}>
                      {log.detalhes.ação}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '4px 8px',
                      backgroundColor: log.status === 'sucesso' ? '#22c55e' : '#ef4444',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}
                  >
                    {log.status}
                  </span>
                </div>

                {log.detalhes.movimentacoes && log.detalhes.movimentacoes.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                          <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Depósito</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Operação</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Quantidade</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Saldo Anterior</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Saldo Novo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.detalhes.movimentacoes.map((mov, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '8px' }}>{mov.deposito_nome}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 6px',
                                backgroundColor: mov.tipo_operacao === 'Entrada' ? '#dcfce7' : '#fee2e2',
                                color: mov.tipo_operacao === 'Entrada' ? '#15803d' : '#991b1b',
                                borderRadius: '3px',
                                fontWeight: '600',
                              }}>
                                {mov.tipo_operacao === 'Entrada' ? '➕' : '➖'} {mov.tipo_operacao}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>
                              {mov.quantidade}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{mov.saldo_anterior}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>
                              {mov.saldo_novo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
