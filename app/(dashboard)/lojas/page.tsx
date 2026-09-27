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
  atualizado_em: string;
}

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  atualizado_em: string;
}

interface ProdutoCompleto {
  id: number;
  codigo: string;
  nome: string;
  raw?: any;
}

// Acha o id do produto pai (o próprio id quando ele já é o pai ou um produto
// sem variações) - mesmo fallback usado no backend, entre os dois formatos
// em que essa relação pode vir salva no raw (lista vs. detalhe do Bling).
function idPaiDe(produto: ProdutoCompleto): number {
  return produto.raw?.idProdutoPai || produto.raw?.variacao?.produtoPai?.id || produto.id;
}

export default function LojasPage() {
  const [canais, setCanais] = useState<CanalVenda[]>([]);
  const [vinculos, setVinculos] = useState<VinculoProduto[]>([]);
  const [produtosMap, setProdutosMap] = useState<Map<number, Produto>>(new Map());
  const [todosProdutos, setTodosProdutos] = useState<ProdutoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canalFiltro, setCanalFiltro] = useState<number | ''>('');
  const [sincronizandoLinha, setSincronizandoLinha] = useState<number | null>(null);
  const [apenasPendentes, setApenasPendentes] = useState(false);

  // Grid de seleção múltipla para sincronizar vários produtos de uma vez
  const [buscaGrid, setBuscaGrid] = useState('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [sincronizandoSelecionados, setSincronizandoSelecionados] = useState(false);
  const [progressoSelecionados, setProgressoSelecionados] = useState<{ atual: number; total: number } | null>(null);

  const supabase = createSupabaseClientBrowser();

  async function carregarDados() {
    try {
      setLoading(true);
      setError(null);

      const [
        { data: canaisData, error: canaisError },
        { data: vinculosData, error: vinculosError },
        { data: todosProdutosData, error: todosProdutosError },
      ] = await Promise.all([
        supabase.from('bling_canais_venda').select('id, descricao, tipo, situacao').order('descricao'),
        supabase.from('bling_produtos_lojas').select('id, produto_id, canal_venda_id, codigo, preco, preco_promocional, atualizado_em'),
        supabase.from('bling_produtos').select('id, codigo, nome, raw').neq('situacao', 'Excluído').order('nome'),
      ]);

      if (canaisError) throw canaisError;
      if (vinculosError) throw vinculosError;
      if (todosProdutosError) throw todosProdutosError;

      setCanais(canaisData || []);
      setVinculos(vinculosData || []);
      setTodosProdutos(todosProdutosData || []);

      const idsProdutos = Array.from(new Set((vinculosData || []).map((v) => v.produto_id)));
      if (idsProdutos.length > 0) {
        const { data: produtosData, error: produtosError } = await supabase
          .from('bling_produtos')
          .select('id, codigo, nome, atualizado_em')
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

  function toggleSelecionado(id: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }

  async function handleSincronizarSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;

    try {
      setSincronizandoSelecionados(true);
      setError(null);

      for (let i = 0; i < ids.length; i++) {
        setProgressoSelecionados({ atual: i + 1, total: ids.length });

        const response = await fetch(`/api/bling/lojas/sync?produtoId=${ids[i]}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Erro ao sincronizar produto ${ids[i]}`);
        }
      }

      setSelecionados(new Set());
      await carregarDados();
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar produtos selecionados');
    } finally {
      setSincronizandoSelecionados(false);
      setProgressoSelecionados(null);
    }
  }

  async function handleSincronizarLinha(produtoId: number) {
    try {
      setSincronizandoLinha(produtoId);
      setError(null);

      const response = await fetch(`/api/bling/lojas/sync?produtoId=${produtoId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar produto');
      }

      await carregarDados();
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar produto');
    } finally {
      setSincronizandoLinha(null);
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

  // Um vínculo fica "pendente" quando o produto foi alterado (no app ou via
  // webhook do Bling) depois da última vez que esse vínculo específico foi
  // sincronizado - não precisa chamar o Bling pra descobrir isso, é só
  // comparar os dois timestamps que já temos localmente.
  function estaPendente(v: VinculoProduto): boolean {
    const produto = produtosMap.get(v.produto_id);
    if (!produto) return false;
    return new Date(produto.atualizado_em).getTime() > new Date(v.atualizado_em).getTime();
  }

  const vinculosFiltrados = vinculos
    .filter((v) => (canalFiltro ? v.canal_venda_id === canalFiltro : true))
    .filter((v) => (apenasPendentes ? estaPendente(v) : true));

  const totalPendentes = vinculos.filter(estaPendente).length;

  // Só produtos pais (ou sem variação) aparecem no grid - selecionar um já
  // leva o grupo inteiro (variações) junto, resolvido no backend.
  const idsVinculados = new Set(vinculos.map((v) => v.produto_id));
  const produtosPais = todosProdutos.filter((p) => idPaiDe(p) === p.id);

  function grupoTemVinculo(paiId: number): boolean {
    return todosProdutos.some((p) => idPaiDe(p) === paiId && idsVinculados.has(p.id));
  }

  const buscaGridLower = buscaGrid.trim().toLowerCase();
  const paisFiltrados = produtosPais.filter(
    (p) =>
      buscaGridLower.length === 0 ||
      p.nome.toLowerCase().includes(buscaGridLower) ||
      p.codigo.toLowerCase().includes(buscaGridLower)
  );

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

      {/* Grid de seleção múltipla para sincronizar vários produtos */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
          Sincronizar produtos selecionados
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
          Selecione um ou mais produtos (a sincronização parte sempre do produto pai e leva todas as variações junto).
        </p>

        <input
          type="text"
          placeholder="Filtrar por nome ou código..."
          value={buscaGrid}
          onChange={(e) => setBuscaGrid(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box',
            marginBottom: '12px',
          }}
        />

        <div style={{
          maxHeight: '260px',
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
        }}>
          {paisFiltrados.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Nenhum produto encontrado.
            </div>
          ) : (
            paisFiltrados.map((p) => {
              const temVinculo = grupoTemVinculo(p.id);
              return (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '13px',
                    cursor: 'pointer',
                    backgroundColor: selecionados.has(p.id) ? '#eff6ff' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.id)}
                    onChange={() => toggleSelecionado(p.id)}
                  />
                  <span style={{ flex: 1 }}>{p.nome} ({p.codigo})</span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: temVinculo ? '#dcfce7' : '#fee2e2',
                    color: temVinculo ? '#166534' : '#991b1b',
                  }}>
                    {temVinculo ? 'Já vinculado' : 'Nunca vinculado'}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <button
            onClick={handleSincronizarSelecionados}
            disabled={selecionados.size === 0 || sincronizandoSelecionados}
            style={{
              padding: '8px 16px',
              backgroundColor: selecionados.size === 0 || sincronizandoSelecionados ? '#ccc' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: selecionados.size === 0 || sincronizandoSelecionados ? 'not-allowed' : 'pointer',
            }}
          >
            {sincronizandoSelecionados
              ? `Sincronizando ${progressoSelecionados?.atual ?? 0}/${progressoSelecionados?.total ?? selecionados.size}...`
              : `Sincronizar ${selecionados.size} selecionado(s)`}
          </button>

          {selecionados.size > 0 && !sincronizandoSelecionados && (
            <button
              onClick={() => setSelecionados(new Set())}
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
              Limpar seleção
            </button>
          )}
        </div>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {totalPendentes > 0 && (
              <span style={{
                padding: '4px 10px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '600',
              }}>
                {totalPendentes} produto(s) pendente(s) de sincronização
              </span>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={apenasPendentes}
                onChange={(e) => setApenasPendentes(e.target.checked)}
              />
              Mostrar só pendentes
            </label>
          </div>

          {vinculosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
              {apenasPendentes
                ? 'Nenhum produto pendente de sincronização.'
                : `Nenhum produto vinculado ${canalFiltro ? 'a este canal' : 'a canais de venda ainda'}.`}
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
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Situação</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {vinculosFiltrados.map((v) => {
                    const produto = produtosMap.get(v.produto_id);
                    const canal = canaisMap.get(v.canal_venda_id);
                    const pendente = estaPendente(v);
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: pendente ? '#fffbeb' : 'transparent' }}>
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
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: pendente ? '#fde68a' : '#dcfce7',
                            color: pendente ? '#92400e' : '#166534',
                          }}>
                            {pendente ? 'Pendente' : 'Sincronizado'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {pendente && (
                            <button
                              onClick={() => handleSincronizarLinha(v.produto_id)}
                              disabled={sincronizandoLinha === v.produto_id}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: sincronizandoLinha === v.produto_id ? '#ccc' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: sincronizandoLinha === v.produto_id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {sincronizandoLinha === v.produto_id ? 'Sincronizando...' : 'Sincronizar'}
                            </button>
                          )}
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
