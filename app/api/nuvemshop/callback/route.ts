import { storeTokens } from '@/lib/nuvemshop/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json(
      { error: `Authorization failed: ${error}` },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Authorization code not provided' },
      { status: 400 }
    );
  }

  try {
    await storeTokens(code);

    return NextResponse.redirect(
      new URL('/auth/authorized', req.nextUrl.origin)
    );
  } catch (error: any) {
    console.error('Nuvemshop callback error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process authorization' },
      { status: 500 }
    );
  }
}
