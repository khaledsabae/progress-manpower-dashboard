// src/app/api/grandeur/route.ts

import { type NextRequest, NextResponse } from 'next/server';
import { parseSlashCommand, executeGrandeurCommand, formatResultForChat } from '@/services/grandeur';

export async function POST(req: NextRequest) {
  try {
    const { command, args = [], locale = 'en' } = await req.json();

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const parsed = { command: command.toLowerCase(), args };
    const result = await executeGrandeurCommand({
      command: parsed.command,
      args: parsed.args,
      locale
    });

    const reply = formatResultForChat(result, locale);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[API /api/grandeur] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Grandeur API',
    commands: ['/status', '/help', '/version']
  });
}
