// src/app/api/monthly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { withTimeout, TimeoutError, isTimeoutError, SHEETS_TIMEOUT_MS } from '@/lib/http/timeout';
import type { MonthlyIndexResponse, YearMonth, MonthlyTabMeta } from '@/types/monthly';

export async function GET(request: NextRequest): Promise<NextResponse<MonthlyIndexResponse | { error: string }>> {
  const startTime = Date.now();
  const abortController = new AbortController();

  try {
    const url = new URL(request.url);
    const order = url.searchParams.get('order') || 'desc'; // 'asc' or 'desc'
    const limitStr = url.searchParams.get('limit') || '12';
    const from = url.searchParams.get('from') as YearMonth | null; // YYYY-MM
    const to = url.searchParams.get('to') as YearMonth | null; // YYYY-MM

    // Validate params
    const limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit: must be 1-100' }, { status: 400 });
    }
    if (order !== 'asc' && order !== 'desc') {
      return NextResponse.json({ error: 'Invalid order: must be "asc" or "desc"' }, { status: 400 });
    }
    if (from && !/^\d{4}-\d{2}$/.test(from)) {
      return NextResponse.json({ error: 'Invalid from: must be YYYY-MM' }, { status: 400 });
    }
    if (to && !/^\d{4}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid to: must be YYYY-MM' }, { status: 400 });
    }

    const result = await withTimeout(async (): Promise<MonthlyIndexResponse> => {
      const service = new GoogleSheetsService();
      const monthlyTabs = await service.listMonthlyTabs();

      // Filter by from/to
      let filtered = monthlyTabs;
      if (from) filtered = filtered.filter(t => t.yearMonth >= from);
      if (to) filtered = filtered.filter(t => t.yearMonth <= to);

      // Sort
      filtered.sort((a, b) => order === 'asc'
        ? (a.yearMonth < b.yearMonth ? -1 : a.yearMonth > b.yearMonth ? 1 : 0)
        : (a.yearMonth > b.yearMonth ? -1 : a.yearMonth < b.yearMonth ? 1 : 0)
      );

      // Limit
      filtered = filtered.slice(0, limit);

      const months = filtered.map(t => t.yearMonth);
      const metaByMonth: Record<YearMonth, MonthlyTabMeta> = {};
      for (const tab of filtered) {
        metaByMonth[tab.yearMonth] = {
          sheetId: tab.sheetId,
          sheetTitle: tab.sheetTitle,
          yearMonth: tab.yearMonth,
          year: tab.year,
          month: tab.month,
          index: tab.index,
        };
      }
      const latestMonth = filtered.length > 0 ? filtered[0].yearMonth : undefined; // first after sort

      return { months, metaByMonth, latestMonth };
    }, SHEETS_TIMEOUT_MS, 'GET /api/monthly', abortController.signal);

    const duration = Date.now() - startTime;
    const response = NextResponse.json(result);
    response.headers.set('x-duration-ms', duration.toString());
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    if (isTimeoutError(error)) {
      console.error('Timeout in /api/monthly:', error);
      const response = NextResponse.json({ error: 'Request timed out' }, { status: 504 });
      response.headers.set('x-duration-ms', duration.toString());
      return response;
    }
    console.error('Error in /api/monthly:', error);
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-duration-ms', duration.toString());
    return response;
  }
}
