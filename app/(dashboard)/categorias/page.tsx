'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';

interface Categoria {
  id: number;
  descricao: string;
  categoria_pai_id: number | null;
}

interface CategoriaComFilhas extends Categoria {
  filhas: CategoriaComFilhas[];
}

function montarArvore(categorias: Categoria[]): CategoriaComFilhas[] {
  const mapa = new Map<number, CategoriaComFilhas>();
  categorias.forEach((c) => mapa.set(c.id, { ...c, filhas: [] }));

  const raizes: CategoriaComFilhas[] = [];

  mapa.forEach((c) => {
    if (c.categoria_pai_id && mapa.has(c.categoria_pai_id)) {
      mapa.get(c.categoria_pai_id)!.filhas.push(c);
    } else {
      raizes.push(c);
    }
  });

  return raizes.sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// Retorna os ids da categoria e de todos os seus descendentes (para impedir
// que uma categoria seja movida para dentro de sua própria subárvore)
function idsDaSubarvore(id: number, categorias: Categoria[]): Set<number> {
  const filhosPorPai = new Map<number, number[]>();
  categorias.forEach((c) => {
    if (c.categoria_pai_id) {
      filhosPorPai.set(c.categoria_pai_id, [...(filhosPorPai.get(c.categoria_pai_id) || []), c.id]);
    }
  });

  const ids = new Set<number>([id]);
  const fila = [id];
  while (fila.length > 0) {
    const atual = fila.pop()!;
    for (const filhoId of filhosPorPai.get(atual) || []) {
      if (!ids.has(filhoId)) {
        ids.add(filhoId);
        fila.push(filhoId);
      }
    }
  }
  return ids;
}

function SeletorCategoriaPai({
  value,
  onChange,
  categorias,
  excluirIds,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  categorias: Categoria[];
  excluirIds: Set<number>;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      style={{
        padding: '6px 8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '13px',
      }}
    >
      <option value="">Nenhuma (categoria raiz)</option>
      {categorias
        .filter((c) => !excluirIds.has(c.id))
        .sort((a, b) => a.descricao.localeCompare(b.descricao))
        .map((c) => (
          <option key={c.id} value={c.id}>{c.descricao}</option>
        ))}
    </select>
  );
}

function LinhaCategoria({
  categoria,
  nivel,
  categorias,
  onSalvar,
  salvando,
}: {
  categoria: CategoriaComFilhas;
  nivel: number;
  categorias: Categoria[];
  onSalvar: (id: number, descricao: string, categoriaPaiId: number | null) => Promise<void>;
  salvando: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(categoria.descricao);
  const [categoriaPaiId, setCategoriaPaiId] = useState<number | null>(categoria.categoria_pai_id);

  async function handleSalvar() {
    if (!descricao.trim()) return;
    await onSalvar(categoria.id, descricao.trim(), categoriaPaiId);
    setEditando(false);
  }

  function handleCancelar() {
    setDescricao(categoria.descricao);
    setCategoriaPaiId(categoria.categoria_pai_id);
    setEditando(false);
  }

  return (
    <>
      <div
        style={{
          padding: '10px 12px',
          paddingLeft: `${12 + nivel * 24}px`,
          borderBottom: '1px solid #e5e7eb',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {nivel > 0 && <span style={{ color: '#9ca3af' }}>├─</span>}

        {editando ? (
          <>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={salvando}
              style={{
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
                flex: 1,
                maxWidth: '260px',
              }}
            />
            <SeletorCategoriaPai
              value={categoriaPaiId}
              onChange={setCategoriaPaiId}
              categorias={categorias}
              excluirIds={idsDaSubarvore(categoria.id, categorias)}
            />
            <button
              onClick={handleSalvar}
              disabled={salvando}
              style={{
                padding: '5px 10px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: salvando ? 'not-allowed' : 'pointer',
              }}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={handleCancelar}
              disabled={salvando}
              style={{
                padding: '5px 10px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: nivel === 0 ? 600 : 400 }}>{categoria.descricao}</span>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>#{categoria.id}</span>
            <button
              onClick={() => setEditando(true)}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                backgroundColor: 'transparent',
                color: '#8b5cf6',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Editar
            </button>
          </>
        )}
      </div>
      {categoria.filhas
        .sort((a, b) => a.descricao.localeCompare(b.descricao))
        .map((filha) => (
          <LinhaCategoria
            key={filha.id}
            categoria={filha}
            nivel={nivel + 1}
            categorias={categorias}
            onSalvar={onSalvar}
            salvando={salvando}
          />
        ))}
    </>
  );
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoriaPaiId, setNovaCategoriaPaiId] = useState<number | null>(null);
  const supabase = createSupabaseClientBrowser();

  async function carregarCategorias() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bling_categorias')
        .select('id, descricao, categoria_pai_id')
        .order('descricao');

      if (fetchError) throw fetchError;

      setCategorias(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSincronizar() {
    try {
      setSincronizando(true);
      setError(null);

      const response = await fetch('/api/bling/categorias/sync');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar categorias');
      }

      await carregarCategorias();
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar categorias');
    } finally {
      setSincronizando(false);
    }
  }

  async function handleCriar() {
    if (!novaDescricao.trim()) return;

    try {
      setSalvando(true);
      setError(null);

      const response = await fetch('/api/bling/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: novaDescricao.trim(),
          categoriaPaiId: novaCategoriaPaiId,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar categoria');
      }

      setNovaDescricao('');
      setNovaCategoriaPaiId(null);
      setMostrarForm(false);
      await carregarCategorias();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar categoria');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao(id: number, descricao: string, categoriaPaiId: number | null) {
    try {
      setSalvando(true);
      setError(null);

      const response = await fetch(`/api/bling/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao, categoriaPaiId }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar categoria');
      }

      await carregarCategorias();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar categoria');
    } finally {
      setSalvando(false);
    }
  }

  const arvore = montarArvore(categorias);

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: '4px' }}>Categorias</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            {categorias.length} categoria(s) importada(s) do Bling
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {mostrarForm ? 'Cancelar' : '+ Nova Categoria'}
          </button>

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
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Categorias'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Nome da categoria *
            </label>
            <input
              type="text"
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              disabled={salvando}
              placeholder="Ex: Vestidos"
              style={{
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '220px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Categoria pai (opcional)
            </label>
            <SeletorCategoriaPai
              value={novaCategoriaPaiId}
              onChange={setNovaCategoriaPaiId}
              categorias={categorias}
              excluirIds={new Set()}
            />
          </div>

          <button
            onClick={handleCriar}
            disabled={salvando || !novaDescricao.trim()}
            style={{
              padding: '9px 18px',
              backgroundColor: salvando || !novaDescricao.trim() ? '#ccc' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: salvando || !novaDescricao.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {salvando ? 'Criando...' : 'Criar'}
          </button>
        </div>
      )}

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
          Carregando categorias...
        </div>
      ) : categorias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
          Nenhuma categoria encontrada. Clique em &quot;Sincronizar Categorias&quot; para importar do Bling.
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}>
          {arvore.map((categoria) => (
            <LinhaCategoria
              key={categoria.id}
              categoria={categoria}
              nivel={0}
              categorias={categorias}
              onSalvar={handleSalvarEdicao}
              salvando={salvando}
            />
          ))}
        </div>
      )}
    </div>
  );
}
