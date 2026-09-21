'use client';

import { useEffect, useState } from 'react';
import React from 'react';
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

interface Atributos {
  cor?: string;
  tamanho?: string;
}

interface ProdutoComAtributos extends Produto {
  atributos: Atributos;
  ehVariacao: boolean;
}

interface GrupoProduto {
  nomeBase: string;
  pai?: ProdutoComAtributos;
  variacoes: ProdutoComAtributos[];
  estoqueTotal: number;
  expandido: boolean;
}

// Extrair nome base e atributos do nome do produto
function extrairAtributos(nome: string): { nomeBase: string; atributos: Atributos } {
  const atributos: Atributos = {};
  let nomeBase = nome;

  // Encontrar o índice do primeiro atributo (COR:, TAM:, TAMANHO:, etc)
  // Suporta: COR:, Cor:, COR,: (com vírgula), TAM:, Tam:, TAMANHO:, Tamanho:
  const primeiroAtributo = nome.search(/(?:COR[,:]{1,2}|Cor[,:]{1,2}|TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})/i);

  if (primeiroAtributo !== -1) {
    // Tudo antes do primeiro atributo é o nome base
    nomeBase = nome.substring(0, primeiroAtributo).trim();
  }

  // Extrair COR (suporta COR: e COR,: com vírgula)
  const matchCor = nome.match(/(?:COR[,:]{1,2}|Cor[,:]{1,2})\s*([^;]+)/i);
  if (matchCor) {
    atributos.cor = matchCor[1].trim();
  }

  // Extrair TAM ou TAMANHO
  const matchTam = nome.match(/(?:TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})\s*([^;]+)/i);
  if (matchTam) {
    atributos.tamanho = matchTam[1].trim();
  }

  return { nomeBase, atributos };
}

// Agrupar produtos por nome base
function agruparProdutos(produtos: Produto[]): GrupoProduto[] {
  const grupos: Map<string, GrupoProduto> = new Map();

  produtos.forEach((prod) => {
    const { nomeBase, atributos } = extrairAtributos(prod.nome);
    const ehVariacao = prod.nome !== nomeBase;

    if (!grupos.has(nomeBase)) {
      grupos.set(nomeBase, {
        nomeBase,
        variacoes: [],
        estoqueTotal: 0,
        expandido: false,
      });
    }

    const grupo = grupos.get(nomeBase)!;
    const produtoComAtributos: ProdutoComAtributos = {
      ...prod,
      atributos,
      ehVariacao,
    };

    if (ehVariacao) {
      grupo.variacoes.push(produtoComAtributos);
    } else {
      grupo.pai = produtoComAtributos;
    }

    grupo.estoqueTotal += prod.saldo_fisico_total;
  });

  return Array.from(grupos.values());
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [grupos, setGrupos] = useState<GrupoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState<string>('');
  const [corFilter, setCorFilter] = useState<string>('');
  const [tamanhoFilter, setTamanhoFilter] = useState<string>('');
  const [apenasComEstoque, setApenasComEstoque] = useState(false);
  const [cores, setCores] = useState<string[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
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

        const produtosCom = (data || []) as ProdutoComAtributos[];

        // Extrair atributos e agrupar
        const produtosComAtributos = produtosCom.map(prod => {
          const { nomeBase, atributos } = extrairAtributos(prod.nome);
          return {
            ...prod,
            atributos,
            ehVariacao: prod.nome !== nomeBase,
          };
        });

        // Extrair cores e tamanhos únicos
        const coresUnicas = Array.from(new Set(
          produtosComAtributos
            .filter(p => p.atributos.cor)
            .map(p => p.atributos.cor!)
        )).sort();

        const tamanhoUnicos = Array.from(new Set(
          produtosComAtributos
            .filter(p => p.atributos.tamanho)
            .map(p => p.atributos.tamanho!)
        )).sort();

        setCores(coresUnicas);
        setTamanhos(tamanhoUnicos);

        // Agrupar TODOS os produtos primeiro
        const gruposAgrupados = agruparProdutos(produtosComAtributos);

        // Depois filtrar os grupos inteiros
        let gruposFiltrados = gruposAgrupados;

        // Se houver filtro de cor ou tamanho, mostrar grupo se qualquer variação combina
        if (corFilter || tamanhoFilter) {
          gruposFiltrados = gruposFiltrados.map(grupo => {
            // Filtrar as variações do grupo
            let variacoesFiltradas = grupo.variacoes;

            if (corFilter) {
              variacoesFiltradas = variacoesFiltradas.filter(
                v => v.atributos.cor === corFilter
              );
            }

            if (tamanhoFilter) {
              variacoesFiltradas = variacoesFiltradas.filter(
                v => v.atributos.tamanho === tamanhoFilter
              );
            }

            return { ...grupo, variacoes: variacoesFiltradas };
          });
        }

        // Filtro "apenas com estoque"
        if (apenasComEstoque) {
          gruposFiltrados = gruposFiltrados.map(grupo => ({
            ...grupo,
            variacoes: grupo.variacoes.filter(v => v.saldo_fisico_total > 0)
          }));
        }

        // Remover grupos sem variações (ficaram vazios após filtro)
        gruposFiltrados = gruposFiltrados.filter(grupo => grupo.variacoes.length > 0);

        setProdutos(produtosComAtributos);
        setGrupos(gruposFiltrados);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produtos');
      } finally {
        setLoading(false);
      }
    }

    fetchProdutos();
  }, [search, situacaoFilter, corFilter, tamanhoFilter, apenasComEstoque, supabase]);

  function toggleGrupo(index: number) {
    setGrupos(grupos.map((g, i) =>
      i === index ? { ...g, expandido: !g.expandido } : g
    ));
  }

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

  async function handleDeletar(id: number) {
    if (!window.confirm('Tem certeza que deseja deletar este produto?')) {
      return;
    }

    try {
      const response = await fetch(`/api/bling/produtos/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar');
      }

      // Recarregar produtos
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Erro ao deletar produto');
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
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
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

          <select
            value={corFilter}
            onChange={(e) => setCorFilter(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Todas as cores</option>
            {cores.map(cor => (
              <option key={cor} value={cor}>{cor}</option>
            ))}
          </select>

          <select
            value={tamanhoFilter}
            onChange={(e) => setTamanhoFilter(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Todos os tamanhos</option>
            {tamanhos.map(tam => (
              <option key={tam} value={tam}>{tam}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={apenasComEstoque}
              onChange={(e) => setApenasComEstoque(e.target.checked)}
            />
            Apenas com estoque
          </label>

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
      ) : grupos.length === 0 ? (
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
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', width: '40px' }}></th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Produto</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Cor</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Tamanho</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>Preço</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Estoque</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Situação</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo, grupoIdx) => (
                <React.Fragment key={grupo.nomeBase}>
                  {/* Linha do Produto Principal */}
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', cursor: 'pointer' }} onClick={() => toggleGrupo(grupoIdx)}>
                      {grupo.variacoes.length > 0 ? (
                        <span style={{ fontSize: '16px' }}>{grupo.expandido ? '▼' : '▶'}</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                      {grupo.nomeBase} {grupo.pai && `(${grupo.pai.codigo})`}
                    </td>
                    <td></td>
                    <td></td>
                    <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                      R$ {grupo.pai?.preco?.toFixed(2) || '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: grupo.estoqueTotal > 0 ? '#d1fae5' : '#fee',
                        color: grupo.estoqueTotal > 0 ? '#065f46' : '#c00',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {grupo.estoqueTotal}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: grupo.pai?.situacao === 'Ativo' ? '#dbeafe' : '#e5e7eb',
                        color: grupo.pai?.situacao === 'Ativo' ? '#0c4a6e' : '#374151',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {grupo.pai?.situacao || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {grupo.pai && (
                        <>
                          <Link href={`/produtos/${grupo.pai.id}`} style={{
                            color: '#0066cc',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            Ver
                          </Link>
                          <span style={{ color: '#d1d5db' }}>•</span>
                          <Link href={`/produtos/grupo/${grupo.pai.codigo}`} style={{
                            color: '#8b5cf6',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            Editar
                          </Link>
                          <span style={{ color: '#d1d5db' }}>•</span>
                          <button
                            onClick={() => handleDeletar(grupo.pai!.id)}
                            style={{
                              color: '#dc2626',
                              background: 'none',
                              border: 'none',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Deletar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {/* Variações */}
                  {grupo.expandido && grupo.variacoes.map((variacao) => (
                    <tr key={variacao.id} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px' }}></td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                        ├─ Var. {variacao.codigo}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {variacao.atributos.cor || '—'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {variacao.atributos.tamanho || '—'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px' }}>
                        R$ {variacao.preco?.toFixed(2) || '0.00'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                        <span style={{
                          padding: '3px 6px',
                          backgroundColor: variacao.saldo_fisico_total > 0 ? '#d1fae5' : '#fee',
                          color: variacao.saldo_fisico_total > 0 ? '#065f46' : '#c00',
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>
                          {variacao.saldo_fisico_total}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                        <span style={{
                          padding: '3px 6px',
                          backgroundColor: variacao.situacao === 'Ativo' ? '#dbeafe' : '#e5e7eb',
                          color: variacao.situacao === 'Ativo' ? '#0c4a6e' : '#374151',
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>
                          {variacao.situacao}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <Link href={`/produtos/${variacao.id}`} style={{
                          color: '#0066cc',
                          textDecoration: 'none',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          Ver
                        </Link>
                        <span style={{ color: '#d1d5db' }}>•</span>
                        <Link href={`/produtos/grupo/${grupo.pai?.codigo}`} style={{
                          color: '#8b5cf6',
                          textDecoration: 'none',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          Editar
                        </Link>
                        <span style={{ color: '#d1d5db' }}>•</span>
                        <button
                          onClick={() => handleDeletar(variacao.id)}
                          style={{
                            color: '#dc2626',
                            background: 'none',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Deletar
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
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
