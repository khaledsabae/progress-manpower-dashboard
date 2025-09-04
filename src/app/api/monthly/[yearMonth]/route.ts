// src/app/api/monthly/[yearMonth]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { withTimeout, TimeoutError, isTimeoutError, SHEETS_TIMEOUT_MS } from '@/lib/http/timeout';
import type { MonthlySnapshotsResponse, YearMonth, MechanicalPlanRow, MonthlySnapshot } from '@/types/monthly';

interface Params {
  yearMonth: string;
}

export async function GET(request: NextRequest, { params }: { params: Params }): Promise<NextResponse<MonthlySnapshotsResponse | { error: string }>> {
  const startTime = Date.now();
  const abortController = new AbortController();

  try {
    const { yearMonth } = params;

    // Validate yearMonth
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({ error: 'Invalid yearMonth: must be YYYY-MM' }, { status: 400 });
    }

    const result = await withTimeout(async (): Promise<MonthlySnapshotsResponse> => {
      const service = new GoogleSheetsService();
      const monthlyTabs = await service.listMonthlyTabs();

      // Find the tab for this yearMonth
      const tab = monthlyTabs.find(t => t.yearMonth === yearMonth);
      if (!tab) {
        throw new Error(`Month ${yearMonth} not found`);
      }

      // Fetch and clean data
      const rawData = await service.getSheetData(tab.sheetTitle);
      const cleanedData = service.cleanMechanicalPlanData(rawData) as MechanicalPlanRow[];

      // Compute summary
      const totalRows = cleanedData.length;
      let totalProgress = 0;
      let validProgressCount = 0;
      let totalManpower = 0;
      let validManpowerCount = 0;
      for (const row of cleanedData) {
        if (row['CurrentProgressPct'] !== null && row['CurrentProgressPct'] !== undefined) {
          totalProgress += row['CurrentProgressPct']!;
          validProgressCount++;
        }
        if (row.ManpowerTotal !== null && row.ManpowerTotal !== undefined) {
          totalManpower += row.ManpowerTotal!;
          validManpowerCount++;
        }
      }
      const avgProgressPct = validProgressCount > 0 ? totalProgress / validProgressCount : null;

      const snapshot: MonthlySnapshot = {
        month: yearMonth,
        rows: cleanedData,
        summary: {
          totalRows,
          avgProgressPct,
          totalManpower: validManpowerCount > 0 ? totalManpower : null,
        },
      };

      return { month: yearMonth, snapshot };
    }, SHEETS_TIMEOUT_MS, `GET /api/monthly/${yearMonth}`, abortController.signal);

    const duration = Date.now() - startTime;
    const response = NextResponse.json(result);
    response.headers.set('x-duration-ms', duration.toString());
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    if (error instanceof Error && error.message.includes('not found')) {
      const response = NextResponse.json({ error: 'Month not found' }, { status: 404 });
      response.headers.set('x-duration-ms', duration.toString());
      return response;
    }
    if (isTimeoutError(error)) {
      console.error(`Timeout in /api/monthly/${params.yearMonth}:`, error);
      const response = NextResponse.json({ error: 'Request timed out' }, { status: 504 });
      response.headers.set('x-duration-ms', duration.toString());
      return response;
    }
    console.error(`Error in /api/monthly/${params.yearMonth}:`, error);
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-duration-ms', duration.toString());
      return response;
  }
}
