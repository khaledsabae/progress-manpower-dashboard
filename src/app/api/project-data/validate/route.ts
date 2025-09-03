import { NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';

export async function GET() {
  try {
    const svc = new GoogleSheetsService();
    const sheetNames = await svc.listSheets();

    // Try fetching each sheet's first few rows
    const samples: Array<{ name: string; rows: number; headers: string[] }> = [];
    for (const name of sheetNames) {
      try {
        const data = await svc.getSheetData(name);
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        samples.push({ name, rows: data.length, headers });
      } catch (e) {
        samples.push({ name, rows: -1, headers: [] });
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '',
      sheets: sheetNames,
      samples,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        hints: [
          'Check GOOGLE_CREDENTIALS_BASE64 is valid Base64 of service account JSON',
          'Ensure the sheet is shared with the service account email',
          'Verify NEXT_PUBLIC_GOOGLE_SHEET_ID is correct',
        ],
      },
      { status: 500 }
    );
  }
}
