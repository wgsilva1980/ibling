'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';
import Link from 'next/link';

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  preco: number;
  situacao: string;
  raw?: any;
}

interface Categoria {
  id: number;
  descricao: string;
}

interface Atributos {
  cor?: string;
  tamanho?: string;
}

function extrairAtributos(nome: string): { nomeBase: string; atributos: Atributos } {
  const atributos: Atributos = {};
  let nomeBase = nome;

  const primeiroAtributo = nome.search(/(?:COR[,:]{1,2}|Cor[,:]{1,2}|TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})/i);

  if (primeiroAtributo !== -1) {
    nomeBase = nome.substring(0, primeiroAtributo).trim();
  }

  const matchCor = nome.match(/(?:COR[,:]{1,2}|Cor[,:]{1,2})\s*([^;]+)/i);
  if (matchCor) {
    atributos.cor = matchCor[1].trim();
  }

  const matchTam = nome.match(/(?:TAM[,:]{1,2}|Tam[,:]{1,2}|TAMANHO[,:]{1,2}|Tamanho[,:]{1,2})\s*([^;]+)/i);
  if (matchTam) {
    atributos.tamanho = matchTam[1].trim();
  }

  return { nomeBase, atributos };
}

export default function EditProdutoPage() {
  const router = useRouter();
  const params = useParams();
  const produtoId = params.id as string;
  const supabase = createSupabaseClientBrowser();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [produtosRelacionados, setProdutosRelacionados] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nomeBase, setNomeBase] = useState('');
  const [atributos, setAtributos] = useState<Atributos>({});
  const [ehVariacao, setEhVariacao] = useState(false);
  const [atualizarTodos, setAtualizarTodos] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [produtoPaiId, setProdutoPaiId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    nomeBase: '',
    cor: '',
    tamanho: '',
    preco: '',
    situacao: 'Ativo',
  });

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
    async function loadProduto() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('bling_produtos')
          .select('*')
          .eq('id', produtoId)
          .single();

        if (fetchError) throw fetchError;

        setProduto(data);

        // Extrair atributos e detectar se é variação
        const { nomeBase: base, atributos: attr } = extrairAtributos(data.nome);
        const isVariacao = data.nome !== base;

        setNomeBase(base);
        setAtributos(attr);
        setEhVariacao(isVariacao);
        setCategoriaId(data.raw?.categoria?.id || null);
        setProdutoPaiId(data.raw?.idProdutoPai || data.raw?.variacao?.produtoPai?.id || null);

        setFormData({
          nome: data.nome || '',
          nomeBase: base || '',
          cor: attr.cor || '',
          tamanho: attr.tamanho || '',
          preco: data.preco?.toString() || '',
          situacao: data.situacao || 'Ativo',
        });

        // Carregar produtos relacionados (mesmo grupo)
        if (isVariacao) {
          const { data: relacionados, error: relacionadosError } = await supabase
            .from('bling_produtos')
            .select('*')
            .ilike('nome', `${base}%`);

          if (!relacionadosError) {
            setProdutosRelacionados(relacionados || []);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produto');
      } finally {
        setLoading(false);
      }
    }

    loadProduto();
  }, [produtoId, supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.nomeBase.trim()) {
      setError('Nome do produto é obrigatório');
      return;
    }

    if (!formData.preco || parseFloat(formData.preco) <= 0) {
      setError('Preço deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      let avisoDetectado: string | undefined;

      // Reconstruir nome com atributos se for variação
      let nomeFinal = formData.nomeBase;
      if (ehVariacao) {
        const atributos = [];
        if (formData.cor) atributos.push(`COR:${formData.cor}`);
        if (formData.tamanho) atributos.push(`TAM:${formData.tamanho}`);
        if (atributos.length > 0) {
          nomeFinal = `${formData.nomeBase} ${atributos.join(';')}`;
        }
      }

      // Se for variação e estiver marcado para atualizar todas, avisar
      if (ehVariacao && atualizarTodos && produtosRelacionados.length > 0) {
        const confirm = window.confirm(
          `Isso atualizará o preço de ${produtosRelacionados.length} produto(s) relacionado(s). Continuar?`
        );
        if (!confirm) {
          setSaving(false);
          return;
        }

        // Atualizar preço de todos os produtos do grupo. produtoPaiId/nomeVariacao
        // são reenviados sempre - se omitidos, o Bling desvincula a variação do pai.
        const todasAsAtualizacoes = produtosRelacionados.map(p => {
          const { atributos: attrP } = extrairAtributos(p.nome);
          const nomeVariacaoP = p.raw?.variacao?.nome
            || [attrP.cor && `COR:${attrP.cor}`, attrP.tamanho && `TAM:${attrP.tamanho}`].filter(Boolean).join(';') || undefined;
          // Só é variação (e só recebe produtoPaiId) se tiver um nome de
          // atributos - o próprio produto pai, presente nesta lista, não tem.
          const paiIdP = nomeVariacaoP
            ? (p.raw?.idProdutoPai || p.raw?.variacao?.produtoPai?.id || produtoPaiId)
            : undefined;

          return fetch(`/api/bling/produtos/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: p.nome,
              preco: parseFloat(formData.preco),
              situacao: p.situacao,
              categoriaId,
              produtoPaiId: paiIdP,
              nomeVariacao: nomeVariacaoP,
            }),
          });
        });

        const resultados = await Promise.all(todasAsAtualizacoes);
        const todosOk = resultados.every(r => r.ok);

        if (!todosOk) {
          throw new Error('Erro ao atualizar alguns produtos');
        }

        // O Bling pode aceitar o PUT (200) mas ignorar silenciosamente a
        // remoção de categoria - a rota sinaliza isso em "aviso".
        const corpos = await Promise.all(resultados.map(r => r.json()));
        avisoDetectado = corpos.find(c => c?.aviso)?.aviso;
      } else {
        // Atualizar apenas este produto. produtoPaiId/nomeVariacao só fazem
        // sentido quando este produto é uma variação.
        const atributosNomeAtual = [
          formData.cor && `COR:${formData.cor}`,
          formData.tamanho && `TAM:${formData.tamanho}`,
        ].filter(Boolean).join(';');

        const response = await fetch(`/api/bling/produtos/${produtoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nomeFinal,
            preco: parseFloat(formData.preco),
            situacao: formData.situacao,
            categoriaId,
            produtoPaiId: ehVariacao ? produtoPaiId : undefined,
            nomeVariacao: ehVariacao ? (atributosNomeAtual || undefined) : undefined,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao salvar produto');
        }

        avisoDetectado = result?.aviso;
      }

      if (avisoDetectado) {
        setError(avisoDetectado);
      } else {
        setSuccess(true);
      }
      setTimeout(() => {
        router.push(`/produtos/${params.id}`);
      }, avisoDetectado ? 3500 : 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Carregando produto...
      </div>
    );
  }

  if (!produto) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#c00', marginBottom: '16px' }}>
          Produto não encontrado
        </div>
        <Link href="/produtos" style={{ color: '#0066cc' }}>
          ← Voltar para produtos
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '8px' }}>
        Editar Produto: {produto.codigo}
      </h2>

      {ehVariacao && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '13px',
          border: '1px solid #fcd34d'
        }}>
          <strong>⚠️ Isso é uma variação:</strong> {nomeBase}
          {atributos.cor && ` • Cor: ${atributos.cor}`}
          {atributos.tamanho && ` • Tamanho: ${atributos.tamanho}`}
        </div>
      )}

      {produtosRelacionados.length > 1 && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f0f9ff',
          color: '#0c4a6e',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '13px',
          border: '1px solid #bfdbfe'
        }}>
          <strong>📦 Produtos relacionados ({produtosRelacionados.length}):</strong>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {produtosRelacionados.map(p => (
              <span key={p.id} style={{
                padding: '4px 8px',
                backgroundColor: '#e0f2fe',
                borderRadius: '3px',
                fontSize: '12px',
              }}>
                {p.codigo}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#efe',
            color: '#060',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          Produto salvo com sucesso! Redirecionando...
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Nome Base */}
        <div>
          <label
            htmlFor="nomeBase"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Nome do Produto *
          </label>
          <input
            id="nomeBase"
            type="text"
            value={formData.nomeBase}
            onChange={(e) => setFormData({ ...formData, nomeBase: e.target.value })}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Categoria */}
        <div>
          <label
            htmlFor="categoria"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Categoria
          </label>
          <select
            id="categoria"
            value={categoriaId ?? ''}
            onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : null)}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.descricao}</option>
            ))}
          </select>
        </div>

        {/* Cor e Tamanho - Mostrar apenas se for variação */}
        {ehVariacao && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label
                htmlFor="cor"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Cor
              </label>
              <input
                id="cor"
                type="text"
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                disabled={saving}
                placeholder="Ex: Azul Claro"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="tamanho"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Tamanho
              </label>
              <input
                id="tamanho"
                type="text"
                value={formData.tamanho}
                onChange={(e) => setFormData({ ...formData, tamanho: e.target.value })}
                disabled={saving}
                placeholder="Ex: P, M, G, ÚNICO"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* Opção de atualizar todas as variações */}
        {ehVariacao && produtosRelacionados.length > 1 && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #e0e0e0'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={atualizarTodos}
                onChange={(e) => setAtualizarTodos(e.target.checked)}
                disabled={saving}
              />
              <span>Atualizar preço de <strong>todas as variações</strong> do grupo</span>
            </label>
            {atualizarTodos && (
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                O preço será atualizado para {produtosRelacionados.length} produto(s) relacionado(s)
              </p>
            )}
          </div>
        )}

        {/* Preço */}
        <div>
          <label
            htmlFor="preco"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Preço (R$) * {atualizarTodos && ehVariacao && <span style={{ fontSize: '12px', color: '#666' }}>(será aplicado a todas as variações)</span>}
          </label>
          <input
            id="preco"
            type="number"
            step="0.01"
            value={formData.preco}
            onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Situação */}
        <div>
          <label
            htmlFor="situacao"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Situação *
          </label>
          <select
            id="situacao"
            value={formData.situacao}
            onChange={(e) => setFormData({ ...formData, situacao: e.target.value })}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          >
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: saving ? '#ccc' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>

          <Link
            href={`/produtos/${params.id}`}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
