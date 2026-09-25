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
  raw?: any;
}

// Suporta dois formatos:
// 1. Produtos criados pela própria app: atributos embutidos no nome ("NOME COR:x;TAM:y")
// 2. Produtos sincronizados direto do Bling: nome idêntico ao pai, atributos em raw.variacao.nome
function extrairAtributos(nome: string, raw?: any) {
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
  const [categorias, setCategorias] = useState<{ id: number; descricao: string }[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [categoriaIdOriginal, setCategoriaIdOriginal] = useState<number | null>(null);
  const [paiInfo, setPaiInfo] = useState<{ nome: string; preco: number; situacao: string } | null>(null);

  useEffect(() => {
    async function loadCategorias() {
      const { data } = await supabase
        .from('bling_categorias')
        .select('id, descricao')
        .order('descricao');
      setCategorias(data || []);
    }
    loadCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        // Verificar se é uma variação; se for, redirecionar para o produto pai.
        // idProdutoPai vem tanto do endpoint de lista quanto do de detalhe do Bling;
        // raw.variacao.produtoPai.id é um fallback só disponível no endpoint de detalhe.
        const idPaiDireto = (produtoEncontrado.raw?.idProdutoPai || produtoEncontrado.raw?.variacao?.produtoPai?.id) as number | undefined;
        const idPaiDiretoValido = idPaiDireto && idPaiDireto !== 0 ? idPaiDireto : undefined;
        const { nomeBase: baseEncontrado, cor, tamanho } = extrairAtributos(produtoEncontrado.nome, produtoEncontrado.raw);

        let produtoPrincipal = produtoEncontrado;
        if (idPaiDiretoValido) {
          const { data: paiDireto } = await supabase
            .from('bling_produtos')
            .select('*')
            .eq('id', idPaiDiretoValido)
            .single();

          if (paiDireto) {
            router.replace(`/produtos/grupo/${paiDireto.codigo}`);
            return;
          }
        } else if (cor || tamanho) {
          // Fallback para produtos criados pela própria app (atributos embutidos no nome)
          const { data: produtosPai } = await supabase
            .from('bling_produtos')
            .select('*')
            .ilike('nome', `${baseEncontrado}%`);

          const pai = (produtosPai || []).find(p => {
            const { cor: c, tamanho: t } = extrairAtributos(p.nome, p.raw);
            return !c && !t;
          });

          if (pai) {
            router.replace(`/produtos/grupo/${pai.codigo}`);
            return;
          }
        }

        setProdutoPaiId(produtoPrincipal.id);
        const { nomeBase: base } = extrairAtributos(produtoPrincipal.nome, produtoPrincipal.raw);
        setNomeBase(base);
        const categoriaAtual = produtoPrincipal.raw?.categoria?.id || null;
        setCategoriaId(categoriaAtual);
        setCategoriaIdOriginal(categoriaAtual);
        setPaiInfo({
          nome: produtoPrincipal.nome,
          preco: produtoPrincipal.preco,
          situacao: produtoPrincipal.situacao,
        });

        // Buscar todos os produtos do grupo: por nome (fluxo antigo) OU por produtoPai.id (fluxo Bling)
        const { data: grupoPorNome, error: erroGrupo } = await supabase
          .from('bling_produtos')
          .select('*')
          .ilike('nome', `${base}%`)
          .neq('situacao', 'Excluído')
          .order('codigo');

        if (erroGrupo) throw erroGrupo;

        const { data: todosComMesmoNome } = await supabase
          .from('bling_produtos')
          .select('*')
          .eq('nome', produtoPrincipal.nome)
          .neq('situacao', 'Excluído')
          .order('codigo');

        const grupoMap = new Map<number, any>();
        (grupoPorNome || []).forEach(p => grupoMap.set(p.id, p));
        (todosComMesmoNome || [])
          .filter(p => {
            const idPai = p.raw?.idProdutoPai || p.raw?.variacao?.produtoPai?.id;
            return idPai === produtoPrincipal.id;
          })
          .forEach(p => grupoMap.set(p.id, p));
        const grupoData = Array.from(grupoMap.values());

        // Extrair atributos de cada produto (excluindo o produto pai)
        const produtosComAtributos: ProdutoEditavel[] = (grupoData || [])
          .filter(p => p.id !== produtoPrincipal.id)
          .map(p => {
            const { cor, tamanho, nomeBase: nb } = extrairAtributos(p.nome, p.raw);
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

    const categoriaMudou = categoriaId !== categoriaIdOriginal;

    // Se a categoria mudou, ela precisa ser propagada para TODAS as
    // variações existentes, não só as que o usuário editou manualmente
    const produtosParaAtualizar = categoriaMudou
      ? produtos.map(p => (p.id !== 0 && !p.editando ? { ...p, editando: true } : p))
      : produtos;

    const produtosComMudancas = produtosParaAtualizar.filter(p => p.editando);

    if (produtosComMudancas.length === 0 && !categoriaMudou) {
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

      async function atualizarProduto(p: ProdutoEditavel) {
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
              categoriaId,
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
            categoriaId,
          }),
        });
        return { ok: res.ok, status: res.status, data: await res.json() };
      }

      // As atualizações são feitas em sequência (não em paralelo) para não
      // estourar o rate limit do Bling - cada PUT do produto pai já dispara
      // uma chamada extra internamente (busca as variações antes de salvar).
      const resultados: { ok: boolean; status: number; data: any }[] = [];
      for (const p of produtosComMudancas) {
        resultados.push(await atualizarProduto(p));
      }

      // Se a categoria do grupo mudou, atualizar também o produto pai
      // (ele não está na lista "produtos", que só contém as variações)
      if (categoriaId !== categoriaIdOriginal && produtoPaiId && paiInfo) {
        const res = await fetch(`/api/bling/produtos/${produtoPaiId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: paiInfo.nome,
            preco: paiInfo.preco,
            situacao: paiInfo.situacao,
            categoriaId,
          }),
        });
        resultados.push({ ok: res.ok, status: res.status, data: await res.json() });
      }

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

  const semMudancas = produtos.every(p => !p.editando) && categoriaId === categoriaIdOriginal;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/produtos" style={{ color: '#0066cc', fontSize: '14px', marginBottom: '16px', display: 'inline-block' }}>
          ← Voltar para produtos
        </Link>

        <h2 style={{ marginTop: '8px', marginBottom: '8px' }}>
          Editar Grupo: {nomeBase}
        </h2>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 12px 0' }}>
          {produtos.length} produto(s) no grupo
        </p>

        <div>
          <label
            htmlFor="categoriaGrupo"
            style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}
          >
            Categoria (aplicada a todas as variações e ao produto principal)
          </label>
          <select
            id="categoriaGrupo"
            value={categoriaId ?? ''}
            onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : null)}
            disabled={saving}
            style={{
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              minWidth: '240px',
            }}
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.descricao}</option>
            ))}
          </select>
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
          disabled={saving || semMudancas}
          style={{
            padding: '12px 24px',
            backgroundColor: saving || semMudancas ? '#ccc' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: saving || semMudancas ? 'not-allowed' : 'pointer',
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
