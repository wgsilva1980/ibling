import { storeTokens } from '@/lib/bling/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Verificar se houve erro na autorização
  if (error) {
    return NextResponse.json(
      { error: `Authorization failed: ${error}` },
      { status: 400 }
    );
  }

  // Verificar se o código foi fornecido
  if (!code) {
    return NextResponse.json(
      { error: 'Authorization code not provided' },
      { status: 400 }
    );
  }

  try {
    // Armazenar tokens no banco de dados
    await storeTokens(code);

    // Redirecionar para página de sucesso ou dashboard
    return NextResponse.redirect(
      new URL('/auth/authorized', req.nextUrl.origin)
    );
  } catch (error: any) {
    console.error('Callback error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process authorization' },
      { status: 500 }
    );
  }
}
