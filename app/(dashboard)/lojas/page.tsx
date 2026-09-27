'use client';

import { useEffect, useState } from 'react';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';

interface CanalVenda {
  id: number;
  descricao: string;
  tipo: string;
  situacao: number;
}

interface VinculoProduto {
  id: number;
  produto_id: number;
  canal_venda_id: number;
  codigo: string;
  preco: number;
  preco_promocional: number;
}

interface Produto {
  id: number;
  codigo: string;
  nome: string;
}

export default function LojasPage() {
  const [canais, setCanais] = useState<CanalVenda[]>([]);
  const [vinculos, setVinculos] = useState<VinculoProduto[]>([]);
  const [produtosMap, setProdutosMap] = useState<Map<number, Produto>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canalFiltro, setCanalFiltro] = useState<number | ''>('');
  const [buscaProduto, setBuscaProduto] = useState('');
  const [sugestoesProduto, setSugestoesProduto] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [sincronizandoProduto, setSincronizandoProduto] = useState(false);
  const supabase = createSupabaseClientBrowser();

  async function carregarDados() {
    try {
      setLoading(true);
      setError(null);

      const [{ data: canaisData, error: canaisError }, { data: vinculosData, error: vinculosError }] =
        await Promise.all([
          supabase.from('bling_canais_venda').select('id, descricao, tipo, situacao').order('descricao'),
          supabase.from('bling_produtos_lojas').select('id, produto_id, canal_venda_id, codigo, preco, preco_promocional'),
        ]);

      if (canaisError) throw canaisError;
      if (vinculosError) throw vinculosError;

      setCanais(canaisData || []);
      setVinculos(vinculosData || []);

      const idsProdutos = Array.from(new Set((vinculosData || []).map((v) => v.produto_id)));
      if (idsProdutos.length > 0) {
        const { data: produtosData, error: produtosError } = await supabase
          .from('bling_produtos')
          .select('id, codigo, nome')
          .in('id', idsProdutos);

        if (produtosError) throw produtosError;

        const mapa = new Map<number, Produto>();
        (produtosData || []).forEach((p: any) => mapa.set(p.id, p));
        setProdutosMap(mapa);
      } else {
        setProdutosMap(new Map());
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function buscarSugestoes() {
      if (produtoSelecionado || buscaProduto.trim().length < 2) {
        setSugestoesProduto([]);
        return;
      }

      const { data } = await supabase
        .from('bling_produtos')
        .select('id, codigo, nome')
        .or(`nome.ilike.%${buscaProduto}%,codigo.ilike.%${buscaProduto}%`)
        .order('nome')
        .limit(10);

      setSugestoesProduto(data || []);
    }

    buscarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaProduto, produtoSelecionado]);

  function handleSelecionarProduto(produto: Produto) {
    setProdutoSelecionado(produto);
    setBuscaProduto('');
    setSugestoesProduto([]);
  }

  function handleLimparProdutoSelecionado() {
    setProdutoSelecionado(null);
  }

  async function handleSincronizarProduto() {
    if (!produtoSelecionado) return;

    try {
      setSincronizandoProduto(true);
      setError(null);

      const response = await fetch(`/api/bling/lojas/sync?produtoId=${produtoSelecionado.id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar produto');
      }

      await carregarDados();
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar produto');
    } finally {
      setSincronizandoProduto(false);
    }
  }

  async function handleSincronizar() {
    try {
      setSincronizando(true);
      setError(null);

      const response = await fetch('/api/bling/lojas/sync');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar');
      }

      await carregarDados();
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar');
    } finally {
      setSincronizando(false);
    }
  }

  const canaisMap = new Map(canais.map((c) => [c.id, c]));
  const vinculosFiltrados = canalFiltro
    ? vinculos.filter((v) => v.canal_venda_id === canalFiltro)
    : vinculos;

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: '4px' }}>Canais de Venda</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            Produtos vinculados a canais de venda conectados no Bling (Nuvemshop, marketplaces, etc)
          </p>
        </div>

        <button
          onClick={handleSincronizar}
          disabled={sincronizando}
          style={{
            padding: '10px 20px',
            backgroundColor: sincronizando ? '#ccc' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: sincronizando ? 'not-allowed' : 'pointer',
          }}
        >
          {sincronizando ? 'Sincronizando...' : 'Sincronizar tudo'}
        </button>
      </div>

      {/* Sincronizar um produto específico */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
          Sincronizar um produto específico
        </div>

        {produtoSelecionado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '6px 12px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              borderRadius: '4px',
              fontSize: '14px',
            }}>
              {produtoSelecionado.nome} ({produtoSelecionado.codigo})
            </span>
            <button
              onClick={handleSincronizarProduto}
              disabled={sincronizandoProduto}
              style={{
                padding: '8px 16px',
                backgroundColor: sincronizandoProduto ? '#ccc' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: sincronizandoProduto ? 'not-allowed' : 'pointer',
              }}
            >
              {sincronizandoProduto ? 'Sincronizando...' : 'Sincronizar este produto'}
            </button>
            <button
              onClick={handleLimparProdutoSelecionado}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Trocar produto
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="Buscar produto por nome ou código..."
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />

            {sugestoesProduto.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginTop: '4px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                zIndex: 10,
                maxHeight: '240px',
                overflowY: 'auto',
              }}>
                {sugestoesProduto.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelecionarProduto(p)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {p.nome} <span style={{ color: '#999' }}>({p.codigo})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
          Carregando...
        </div>
      ) : canais.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
          Nenhum canal de venda encontrado. Clique em &quot;Sincronizar&quot; para importar do Bling.
        </div>
      ) : (
        <>
          {/* Cards de canais */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {canais.map((c) => {
              const totalVinculado = vinculos.filter((v) => v.canal_venda_id === c.id).length;
              return (
                <div
                  key={c.id}
                  onClick={() => setCanalFiltro(canalFiltro === c.id ? '' : c.id)}
                  style={{
                    padding: '16px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    minWidth: '180px',
                    cursor: 'pointer',
                    border: canalFiltro === c.id ? '2px solid #3b82f6' : '2px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{c.descricao}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{c.tipo}</div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: c.situacao === 1 ? '#dcfce7' : '#f3f4f6',
                      color: c.situacao === 1 ? '#166534' : '#666',
                    }}>
                      {c.situacao === 1 ? 'Habilitado' : 'Desabilitado'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                    {totalVinculado} produto(s) vinculado(s)
                  </div>
                </div>
              );
            })}
          </div>

          {vinculosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
              Nenhum produto vinculado {canalFiltro ? 'a este canal' : 'a canais de venda ainda'}.
            </div>
          ) : (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '4px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Produto</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Canal</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Código no canal</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>Preço</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>Preço promocional</th>
                  </tr>
                </thead>
                <tbody>
                  {vinculosFiltrados.map((v) => {
                    const produto = produtosMap.get(v.produto_id);
                    const canal = canaisMap.get(v.canal_venda_id);
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {produto ? `${produto.nome} (${produto.codigo})` : `Produto #${v.produto_id}`}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {canal?.descricao || `Canal #${v.canal_venda_id}`}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>
                          {v.codigo || '—'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right' }}>
                          {v.preco ? `R$ ${Number(v.preco).toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right' }}>
                          {v.preco_promocional ? `R$ ${Number(v.preco_promocional).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: '12px', fontSize: '13px', color: '#999' }}>
            Total: {vinculosFiltrados.length} vínculo(s)
          </p>
        </>
      )}
    </div>
  );
}
