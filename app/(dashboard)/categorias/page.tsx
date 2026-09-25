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

function LinhaCategoria({ categoria, nivel }: { categoria: CategoriaComFilhas; nivel: number }) {
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
        <span style={{ fontWeight: nivel === 0 ? 600 : 400 }}>{categoria.descricao}</span>
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>#{categoria.id}</span>
      </div>
      {categoria.filhas
        .sort((a, b) => a.descricao.localeCompare(b.descricao))
        .map((filha) => (
          <LinhaCategoria key={filha.id} categoria={filha} nivel={nivel + 1} />
        ))}
    </>
  );
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            <LinhaCategoria key={categoria.id} categoria={categoria} nivel={0} />
          ))}
        </div>
      )}
    </div>
  );
}
