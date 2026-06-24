import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { executeQueryWithRls } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing session token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let userId = '';

    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET || '') as any;
      userId = decoded.sub;
    } catch (err) {
      return NextResponse.json({ error: 'Unauthorized: Session has expired or is invalid' }, { status: 401 });
    }

    const { sql, params, method } = await req.json();

    if (!sql) {
      return NextResponse.json({ error: 'Bad Request: Missing SQL string' }, { status: 400 });
    }

    const result = await executeQueryWithRls(userId, sql, params || [], method || 'all');
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Proxy routing error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
