import Link from 'next/link';

export default function AuthorizedPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '400px',
        padding: '32px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ marginTop: 0, color: '#22c55e' }}>✓ Autorização Sucesso!</h1>

        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          Seu aplicativo foi autorizado com sucesso. Os tokens foram armazenados com segurança.
        </p>

        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          Agora você pode fazer a <strong>sincronização inicial de produtos</strong>.
        </p>

        <div style={{
          padding: '16px',
          backgroundColor: '#f0fdf4',
          borderRadius: '4px',
          borderLeft: '4px solid #22c55e',
          textAlign: 'left',
          fontSize: '12px',
          color: '#166534'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Próximos passos:</p>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Acesse <code>/api/bling/sync-inicial</code> em uma nova aba</li>
            <li>Aguarde a sincronização concluir (pode levar alguns minutos)</li>
            <li>Verifique os produtos no painel</li>
          </ol>
        </div>

        <Link href="/produtos" style={{
          padding: '12px',
          backgroundColor: '#0066cc',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          textAlign: 'center',
          display: 'inline-block'
        }}>
          Ir para Dashboard
        </Link>
      </div>
    </div>
  );
}
