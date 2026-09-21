'use client';

import { useEffect, useState } from 'react';
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

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState<string>('');
  const supabase = createSupabaseClientBrowser();

  useEffect(() => {
    async function fetchProdutos() {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('bling_produtos')
          .select('id, codigo, nome, preco, situacao, saldo_fisico_total')
          .order('nome');

        // Aplicar filtros
        if (search) {
          query = query.or(
            `nome.ilike.%${search}%,codigo.ilike.%${search}%`
          );
        }

        if (situacaoFilter) {
          // Normalizar filtro: "Ativo" pode estar salvo como "A" ou "Ativo"
          if (situacaoFilter === 'Ativo') {
            query = query.or(`situacao.ilike.Ativo,situacao.eq.A`);
          } else {
            query = query.ilike('situacao', situacaoFilter);
          }
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setProdutos(data || []);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produtos');
      } finally {
        setLoading(false);
      }
    }

    fetchProdutos();
  }, [search, situacaoFilter, supabase]);

  async function handleSyncInicial() {
    try {
      setLoading(true);
      const response = await fetch('/api/bling/sync-inicial');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar');
      }

      // Recarregar produtos
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Produtos</h2>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />

          <select
            value={situacaoFilter}
            onChange={(e) => setSituacaoFilter(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Todas as situações</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>

          <button
            onClick={handleSyncInicial}
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#ccc' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
          Carregando produtos...
        </div>
      ) : produtos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
          Nenhum produto encontrado. Clique em "Sincronizar" para importar produtos do Bling.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Código</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Nome</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>Preço</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Estoque</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Situação</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto) => (
                <tr
                  key={produto.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>
                    {produto.codigo}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    {produto.nome}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                    R$ {produto.preco?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: produto.saldo_fisico_total > 0 ? '#d1fae5' : '#fee',
                      color: produto.saldo_fisico_total > 0 ? '#065f46' : '#c00',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {produto.saldo_fisico_total}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: produto.situacao === 'Ativo' ? '#dbeafe' : '#e5e7eb',
                      color: produto.situacao === 'Ativo' ? '#0c4a6e' : '#374151',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {produto.situacao}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <Link href={`/produtos/${produto.id}`} style={{
                      color: '#0066cc',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
        Total: {produtos.length} produto(s)
      </div>
    </div>
  );
}
