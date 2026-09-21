'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';
import Link from 'next/link';

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  preco: number;
  situacao: string;
  saldo_fisico_total: number;
}

interface Deposito {
  produto_id: number;
  deposito_id: number;
  deposito_nome: string;
  saldo_fisico: number;
}

export default function ProdutoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const produtoId = params.id as string;

  const [produto, setProduto] = useState<Produto | null>(null);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseClientBrowser();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Buscar produto
        const { data: produtoData, error: produtoError } = await supabase
          .from('bling_produtos')
          .select('*')
          .eq('id', parseInt(produtoId))
          .single();

        if (produtoError) throw produtoError;
        setProduto(produtoData);

        // Buscar estoque por depósito
        const { data: depositoData, error: depositoError } = await supabase
          .from('bling_estoque_depositos')
          .select('*')
          .eq('produto_id', parseInt(produtoId))
          .order('deposito_nome');

        if (depositoError) throw depositoError;
        setDepositos(depositoData || []);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produto');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [produtoId, supabase]);

  if (loading) {
    return (
      <div style={{ padding: '24px', color: '#666' }}>
        Carregando...
      </div>
    );
  }

  if (error || !produto) {
    return (
      <div>
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {error || 'Produto não encontrado'}
        </div>
        <Link href="/produtos" style={{
          color: '#0066cc',
          textDecoration: 'none'
        }}>
          ← Voltar para produtos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/produtos" style={{
        color: '#0066cc',
        textDecoration: 'none',
        fontSize: '14px',
        marginBottom: '16px',
        display: 'inline-block'
      }}>
        ← Voltar para produtos
      </Link>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
          <h1 style={{ marginTop: 0, marginBottom: 0 }}>{produto.nome}</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              href={`/produtos/${produtoId}/edit`}
              style={{
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Editar Produto
            </Link>
            <Link
              href={`/produtos/${produtoId}/estoque`}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Editar Estoque
            </Link>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px',
          marginBottom: '24px'
        }}>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '600' }}>
              Código
            </p>
            <p style={{ margin: 0, fontSize: '16px', fontFamily: 'monospace' }}>
              {produto.codigo}
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '600' }}>
              Preço
            </p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
              R$ {produto.preco?.toFixed(2) || '0.00'}
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '600' }}>
              Saldo Total
            </p>
            <p style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 'bold',
              color: produto.saldo_fisico_total > 0 ? '#22c55e' : '#ef4444'
            }}>
              {produto.saldo_fisico_total} un.
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '600' }}>
              Situação
            </p>
            <p style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 'bold',
              color: produto.situacao === 'Ativo' ? '#3b82f6' : '#9ca3af'
            }}>
              {produto.situacao}
            </p>
          </div>
        </div>
      </div>

      {/* Estoque por Depósito */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Estoque por Depósito</h2>

        {depositos.length === 0 ? (
          <p style={{ color: '#666', fontSize: '14px' }}>
            Nenhum depósito encontrado para este produto.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Depósito</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Saldo Físico</th>
                </tr>
              </thead>
              <tbody>
                {depositos.map((dep) => (
                  <tr key={dep.deposito_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {dep.deposito_nome}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: dep.saldo_fisico > 0 ? '#d1fae5' : '#fee',
                        color: dep.saldo_fisico > 0 ? '#065f46' : '#c00',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {dep.saldo_fisico}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
