'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseClientBrowser } from '@/lib/supabase/client';
import Link from 'next/link';

interface Foto {
  id?: string;
  url: string;
  nome?: string;
  principal?: boolean;
}

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  raw: any;
}

export default function FotosPage() {
  const params = useParams();
  const produtoId = params.id as string;
  const supabase = createSupabaseClientBrowser();

  const [produto, setProduto] = useState<Produto | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletando, setDeletando] = useState<string | null>(null);
  const [uploadando, setUploadando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Buscar produto
        const { data: produtoData, error: produtoError } = await supabase
          .from('bling_produtos')
          .select('id, codigo, nome, raw')
          .eq('id', parseInt(produtoId))
          .single();

        if (produtoError) throw produtoError;
        setProduto(produtoData);

        // Extrair fotos do campo raw (imagens do Bling)
        // Tentar múltiplas estruturas possíveis
        const imagensArray = produtoData?.raw?.imagens || produtoData?.raw?.fotos || [];

        if (Array.isArray(imagensArray) && imagensArray.length > 0) {
          const fotosFormatadas = imagensArray.map((img: any, idx: number) => ({
            id: img.id || `img-${idx}`,
            url: img.link || img.url || img.src || '',
            nome: img.nome || img.name || `Foto ${idx + 1}`,
            principal: img.principal || img.isPrincipal || false,
          })).filter((f: Foto) => f.url);

          console.log('Fotos extraídas:', fotosFormatadas);
          setFotos(fotosFormatadas);
        } else {
          console.log('Nenhuma imagem encontrada:', { imagens: produtoData?.raw?.imagens, fotos: produtoData?.raw?.fotos });
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar fotos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [produtoId, supabase]);

  async function handleRemoverFoto(fotoId: string) {
    if (!confirm('Remover essa foto?')) return;

    try {
      setDeletando(fotoId);
      setError(null);

      const response = await fetch(`/api/bling/fotos/${produtoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao remover foto');
      }

      setFotos(fotos.filter(f => f.id !== fotoId));
    } catch (err: any) {
      setError(err.message || 'Erro ao remover foto');
    } finally {
      setDeletando(null);
    }
  }

  async function handleSincronizarFotos() {
    try {
      setSincronizando(true);
      setError(null);

      const response = await fetch(`/api/bling/fotos/${produtoId}/sync`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar');
      }

      // Recarregar fotos
      const { data: produtoData } = await supabase
        .from('bling_produtos')
        .select('raw')
        .eq('id', parseInt(produtoId))
        .single();

      const imagensArray = produtoData?.raw?.imagens || produtoData?.raw?.fotos || [];

      if (Array.isArray(imagensArray) && imagensArray.length > 0) {
        const fotosFormatadas = imagensArray.map((img: any, idx: number) => ({
          id: img.id || `img-${idx}`,
          url: img.link || img.url || img.src || '',
          nome: img.nome || img.name || `Foto ${idx + 1}`,
          principal: img.principal || img.isPrincipal || false,
        })).filter((f: Foto) => f.url);

        setFotos(fotosFormatadas);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar fotos');
    } finally {
      setSincronizando(false);
    }
  }

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadando(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', files[0]);

      const response = await fetch(`/api/bling/fotos/${produtoId}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload');
      }

      // Recarregar fotos
      const { data: produtoData } = await supabase
        .from('bling_produtos')
        .select('raw')
        .eq('id', parseInt(produtoId))
        .single();

      const imagensArray = produtoData?.raw?.imagens || produtoData?.raw?.fotos || [];

      if (Array.isArray(imagensArray) && imagensArray.length > 0) {
        const fotosFormatadas = imagensArray.map((img: any, idx: number) => ({
          id: img.id || `img-${idx}`,
          url: img.link || img.url || img.src || '',
          nome: img.nome || img.name || `Foto ${idx + 1}`,
          principal: img.principal || img.isPrincipal || false,
        })).filter((f: Foto) => f.url);

        setFotos(fotosFormatadas);
      }

      // Limpar input
      e.target.value = '';
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload');
    } finally {
      setUploadando(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Carregando fotos...
      </div>
    );
  }

  if (error && !produto) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#c00', marginBottom: '16px' }}>
          {error || 'Produto não encontrado'}
        </div>
        <Link href="/produtos" style={{ color: '#0066cc' }}>
          ← Voltar para produtos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/produtos/${produtoId}`} style={{
        color: '#0066cc',
        textDecoration: 'none',
        fontSize: '14px',
        marginBottom: '16px',
        display: 'inline-block'
      }}>
        ← Voltar para {produto?.codigo}
      </Link>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ marginTop: 0, marginBottom: 0 }}>
            Galeria: {produto?.codigo}
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSincronizarFotos}
              disabled={sincronizando}
              style={{
                padding: '10px 16px',
                backgroundColor: '#06b6d4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: sincronizando ? 'not-allowed' : 'pointer',
                opacity: sincronizando ? 0.6 : 1,
              }}
            >
              {sincronizando ? '⏳ Sincronizando...' : '🔄 Sincronizar do Bling'}
            </button>
            <label style={{
              padding: '10px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: uploadando ? 'not-allowed' : 'pointer',
              opacity: uploadando ? 0.6 : 1,
            }}>
              {uploadando ? '⏳ Upload...' : '📸 Upload Foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadFoto}
                disabled={uploadando}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

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

        {fotos.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: '#999',
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📷</p>
            <p>Nenhuma foto encontrada para este produto.</p>
            <p style={{ fontSize: '14px', color: '#bbb' }}>Clique no botão "Upload Foto" para adicionar.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            {fotos.map((foto) => (
              <div
                key={foto.id}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#f3f4f6',
                  aspectRatio: '1',
                  border: foto.principal ? '3px solid #10b981' : '1px solid #e5e7eb',
                }}
              >
                <img
                  src={foto.url}
                  alt={foto.nome}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" textAnchor="middle" dy=".3em" fill="%23999"%3E❌%3C/text%3E%3C/svg%3E';
                  }}
                />

                {foto.principal && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}>
                    ⭐ Principal
                  </div>
                )}

                <button
                  onClick={() => handleRemoverFoto(foto.id || '')}
                  disabled={deletando === foto.id}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: deletando === foto.id ? 'not-allowed' : 'pointer',
                    opacity: deletando === foto.id ? 0.6 : 1,
                  }}
                >
                  {deletando === foto.id ? '⏳' : '🗑️ Remover'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
