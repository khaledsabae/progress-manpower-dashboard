import { NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';

export async function GET() {
  try {
    const svc = new GoogleSheetsService();
    const catalog = await svc.buildCatalog(3);
    return NextResponse.json({ success: true, ...catalog, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to build sheets catalog',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
