'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';
import Link from 'next/link';

interface Deposito {
  deposito_id: number;
  deposito_nome: string;
  saldo_fisico: number;
  saldo_virtual: number;
}

interface Produto {
  id: number;
  codigo: string;
  nome: string;
}

export default function EditEstoquePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createSupabaseClientBrowser();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<Record<number, { fisico: number; virtual: number }>>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Carregar produto
        const { data: prodData, error: prodError } = await supabase
          .from('bling_produtos')
          .select('id, codigo, nome')
          .eq('id', params.id)
          .single();

        if (prodError) throw prodError;
        setProduto(prodData);

        // Carregar estoque por depósito
        const { data: estData, error: estError } = await supabase
          .from('bling_estoque_depositos')
          .select('*')
          .eq('produto_id', params.id);

        if (estError) throw estError;

        setDepositos(estData || []);

        // Inicializar form
        const initialForm: Record<number, { fisico: number; virtual: number }> = {};
        (estData || []).forEach((dep) => {
          initialForm[dep.deposito_id] = {
            fisico: dep.saldo_fisico,
            virtual: dep.saldo_virtual,
          };
        });
        setFormData(initialForm);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar estoque');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const depositsToUpdate = depositos.map((dep) => ({
        depositoId: dep.deposito_id,
        saldoFisico: parseInt(formData[dep.deposito_id]?.fisico?.toString() || '0'),
        saldoVirtual: parseInt(formData[dep.deposito_id]?.virtual?.toString() || '0'),
      }));

      const response = await fetch(`/api/bling/estoque/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositos: depositsToUpdate }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar estoque');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/produtos/${params.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar estoque');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Carregando estoque...
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
      <h2 style={{ marginTop: 0, marginBottom: '24px' }}>
        Editar Estoque: {produto.codigo}
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
          Estoque salvo com sucesso! Redirecionando...
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {depositos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>
            Nenhum depósito encontrado para este produto
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                borderRadius: '4px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>
                    Depósito
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
                    Saldo Físico
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
                    Saldo Virtual
                  </th>
                </tr>
              </thead>
              <tbody>
                {depositos.map((dep) => (
                  <tr key={dep.deposito_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {dep.deposito_nome}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={formData[dep.deposito_id]?.fisico ?? dep.saldo_fisico}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [dep.deposito_id]: {
                              ...formData[dep.deposito_id],
                              fisico: parseInt(e.target.value || '0'),
                            },
                          })
                        }
                        disabled={saving}
                        style={{
                          width: '80px',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          textAlign: 'center',
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={formData[dep.deposito_id]?.virtual ?? dep.saldo_virtual}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [dep.deposito_id]: {
                              ...formData[dep.deposito_id],
                              virtual: parseInt(e.target.value || '0'),
                            },
                          })
                        }
                        disabled={saving}
                        style={{
                          width: '80px',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          textAlign: 'center',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            type="submit"
            disabled={saving || depositos.length === 0}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: saving || depositos.length === 0 ? '#ccc' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: saving || depositos.length === 0 ? 'not-allowed' : 'pointer',
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
