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

function extrairAtributos(nome: string) {
  let nomeBase = nome;
  let cor = '';
  let tamanho = '';

  const primeiroAtributo = nome.search(/(?:COR[,:]{1,2}|Cor[,:]{1,2}|TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})/i);

  if (primeiroAtributo !== -1) {
    nomeBase = nome.substring(0, primeiroAtributo).trim();
  }

  const matchCor = nome.match(/(?:COR[,:]{1,2}|Cor[,:]{1,2})\s*([^;]+)/i);
  if (matchCor) {
    cor = matchCor[1].trim();
  }

  const matchTam = nome.match(/(?:TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})\s*([^;]+)/i);
  if (matchTam) {
    tamanho = matchTam[1].trim();
  }

  return { nomeBase, cor, tamanho };
}

interface ProdutoEditavel extends Produto {
  cor: string;
  tamanho: string;
  nomeBase: string;
  editando: boolean;
}

export default function EditarGrupoPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = params.codigo as string;
  const supabase = createSupabaseClientBrowser();

  const [nomeBase, setNomeBase] = useState('');
  const [produtos, setProdutos] = useState<ProdutoEditavel[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [adicionandoVariacao, setAdicionandoVariacao] = useState(false);
  const [produtoPaiId, setProdutoPaiId] = useState<number | null>(null);

  useEffect(() => {
    async function loadGrupo() {
      try {
        setLoading(true);
        setError(null);

        // Buscar o produto principal pelo código
        const { data: produtoEncontrado, error: erroP } = await supabase
          .from('bling_produtos')
          .select('*')
          .eq('codigo', codigo)
          .single();

        if (erroP || !produtoEncontrado) {
          throw new Error('Produto não encontrado');
        }

        // Verificar se é uma variação; se for, redirecionar para o produto pai
        const { nomeBase: baseEncontrado, cor, tamanho } = extrairAtributos(produtoEncontrado.nome);

        // Se tem atributos (cor ou tamanho), é uma variação - encontrar o produto pai
        let produtoPrincipal = produtoEncontrado;
        if (cor || tamanho) {
          const { data: produtosPai } = await supabase
            .from('bling_produtos')
            .select('*')
            .ilike('nome', `${baseEncontrado}%`);

          const pai = (produtosPai || []).find(p => {
            const { cor: c, tamanho: t } = extrairAtributos(p.nome);
            return !c && !t;
          });

          if (pai) {
            router.replace(`/produtos/grupo/${pai.codigo}`);
            return;
          }
        }

        setProdutoPaiId(produtoPrincipal.id);
        const { nomeBase: base } = extrairAtributos(produtoPrincipal.nome);
        setNomeBase(base);

        // Buscar todos os produtos do grupo
        const { data: grupoData, error: erroGrupo } = await supabase
          .from('bling_produtos')
          .select('*')
          .ilike('nome', `${base}%`)
          .order('codigo');

        if (erroGrupo) throw erroGrupo;

        // Extrair atributos de cada produto (excluindo o produto pai)
        const produtosComAtributos: ProdutoEditavel[] = (grupoData || [])
          .filter(p => p.id !== produtoPrincipal.id)
          .map(p => {
            const { cor, tamanho, nomeBase: nb } = extrairAtributos(p.nome);
            return {
              ...p,
              cor,
              tamanho,
              nomeBase: nb,
              editando: false,
            };
          });

        // Extrair cores e tamanhos únicos
        const coresUnicas = Array.from(new Set(
          produtosComAtributos.filter(p => p.cor).map(p => p.cor)
        )).sort();

        const tamanhoUnicos = Array.from(new Set(
          produtosComAtributos.filter(p => p.tamanho).map(p => p.tamanho)
        )).sort();

        setCores(coresUnicas);
        setTamanhos(tamanhoUnicos);
        setProdutos(produtosComAtributos);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar grupo');
      } finally {
        setLoading(false);
      }
    }

    loadGrupo();
  }, [codigo, supabase]);

  function handleChange(index: number, field: string, value: string | number) {
    const novosProdutos = [...produtos];
    novosProdutos[index] = {
      ...novosProdutos[index],
      [field]: value,
      editando: true,
    };
    setProdutos(novosProdutos);
  }

  function adicionarVariacao() {
    const novaVariacao: ProdutoEditavel = {
      id: 0, // Será gerado no backend
      codigo: '',
      nome: nomeBase,
      preco: produtos[0]?.preco || 0,
      situacao: 'Ativo',
      saldo_fisico_total: 0,
      cor: '',
      tamanho: '',
      nomeBase,
      editando: true,
    };
    setProdutos([...produtos, novaVariacao]);
    setAdicionandoVariacao(true);
  }

  async function handleSalvar() {
    console.log(`[FRONTEND] handleSalvar iniciado`);
    console.log(`[FRONTEND] produtoPaiId atual: ${produtoPaiId}`);
    console.log(`[FRONTEND] produtoPaiId tipo: ${typeof produtoPaiId}`);

    const produtosComMudancas = produtos.filter(p => p.editando);

    if (produtosComMudancas.length === 0) {
      setError('Nenhuma mudança para salvar');
      return;
    }

    // Validar novas variações
    const novasVariacoes = produtosComMudancas.filter(p => p.id === 0);
    for (const variacao of novasVariacoes) {
      if (!variacao.cor && !variacao.tamanho) {
        setError('Novas variações precisam de Cor ou Tamanho');
        setSaving(false);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Atualizar/criar cada produto
      const todasAsAtualizacoes = produtosComMudancas.map(async (p) => {
        let nome = p.nomeBase;
        if (p.cor || p.tamanho) {
          const atributos = [];
          if (p.cor) atributos.push(`COR:${p.cor}`);
          if (p.tamanho) atributos.push(`TAM:${p.tamanho}`);
          nome = `${p.nomeBase} ${atributos.join(';')}`;
        }

        // Se é novo (id = 0), enviar como nova criação
        if (p.id === 0) {
          const res = await fetch(`/api/bling/produtos/criar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codigo: p.codigo,
              nome,
              preco: p.preco,
              situacao: p.situacao,
              produtoPaiId,
            }),
          });
          return { ok: res.ok, status: res.status, data: await res.json() };
        }

        // Caso contrário, atualizar existente
        const res = await fetch(`/api/bling/produtos/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome,
            preco: p.preco,
            situacao: p.situacao,
          }),
        });
        return { ok: res.ok, status: res.status, data: await res.json() };
      });

      const resultados = await Promise.all(todasAsAtualizacoes);
      const todosOk = resultados.every(r => r.ok);

      if (!todosOk) {
        const erros: string[] = [];
        for (let i = 0; i < resultados.length; i++) {
          if (!resultados[i].ok) {
            const erro = resultados[i].data?.error || 'Erro desconhecido';
            erros.push(`Produto ${i + 1}: ${erro}`);
          }
        }
        throw new Error(`Erro ao salvar produtos: ${erros.join('; ')}`);
      }

      setSuccess(true);
      // Recarregar dados
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar produtos');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Carregando grupo...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/produtos" style={{ color: '#0066cc', fontSize: '14px', marginBottom: '16px', display: 'inline-block' }}>
          ← Voltar para produtos
        </Link>

        <h2 style={{ marginTop: '8px', marginBottom: '8px' }}>
          Editar Grupo: {nomeBase}
        </h2>
        <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
          {produtos.length} produto(s) no grupo
        </p>
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

      {success && (
        <div style={{
          padding: '12px',
          backgroundColor: '#efe',
          color: '#060',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          Produtos salvos com sucesso! Redirecionando...
        </div>
      )}

      {/* Tabela de edição */}
      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          minWidth: '900px',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', minWidth: '80px' }}>Código</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Cor</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Tamanho</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>Preço (R$)</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Estoque</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((produto, idx) => (
              <tr
                key={produto.id}
                style={{
                  backgroundColor: produto.editando ? '#fffbeb' : '#ffffff',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>
                  {produto.id === 0 ? (
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Auto</span>
                  ) : (
                    produto.codigo
                  )}
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={produto.cor}
                    onChange={(e) => handleChange(idx, 'cor', e.target.value)}
                    disabled={saving}
                    placeholder="Digite ou selecione"
                    list={`cores-list-${idx}`}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <datalist id={`cores-list-${idx}`}>
                    {cores.map(cor => (
                      <option key={cor} value={cor} />
                    ))}
                  </datalist>
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={produto.tamanho}
                    onChange={(e) => handleChange(idx, 'tamanho', e.target.value)}
                    disabled={saving}
                    placeholder="Digite ou selecione"
                    list={`tamanhos-list-${idx}`}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <datalist id={`tamanhos-list-${idx}`}>
                    {tamanhos.map(tam => (
                      <option key={tam} value={tam} />
                    ))}
                  </datalist>
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    value={produto.preco}
                    onChange={(e) => handleChange(idx, 'preco', e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      textAlign: 'right',
                    }}
                  />
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                  {produto.saldo_fisico_total}
                </td>
                <td style={{ padding: '8px' }}>
                  <select
                    value={produto.situacao}
                    onChange={(e) => handleChange(idx, 'situacao', e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Botão de nova variação */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={adicionarVariacao}
          disabled={saving}
          style={{
            padding: '10px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          + Nova Variação
        </button>
      </div>

      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleSalvar}
          disabled={saving || produtos.every(p => !p.editando)}
          style={{
            padding: '12px 24px',
            backgroundColor: saving || produtos.every(p => !p.editando) ? '#ccc' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: saving || produtos.every(p => !p.editando) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>

        <Link
          href="/produtos"
          style={{
            padding: '12px 24px',
            backgroundColor: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Cancelar
        </Link>
      </div>
    </div>
  );
}
