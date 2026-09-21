'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';
import Link from 'next/link';

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  preco: number;
  situacao: string;
}

export default function EditProdutoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createSupabaseClientBrowser();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    preco: '',
    situacao: 'Ativo',
  });

  useEffect(() => {
    async function loadProduto() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('bling_produtos')
          .select('*')
          .eq('id', params.id)
          .single();

        if (fetchError) throw fetchError;

        setProduto(data);
        setFormData({
          nome: data.nome || '',
          preco: data.preco?.toString() || '',
          situacao: data.situacao || 'Ativo',
        });
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produto');
      } finally {
        setLoading(false);
      }
    }

    loadProduto();
  }, [params.id, supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
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

      const response = await fetch(`/api/bling/produtos/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          preco: parseFloat(formData.preco),
          situacao: formData.situacao,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar produto');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/produtos/${params.id}`);
      }, 1500);
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
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px' }}>
        Editar Produto: {produto.codigo}
      </h2>

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
        {/* Nome */}
        <div>
          <label
            htmlFor="nome"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Nome *
          </label>
          <input
            id="nome"
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
            Preço (R$) *
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
