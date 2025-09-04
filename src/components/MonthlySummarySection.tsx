"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useMonthlyIndex, useMonthlySnapshot } from '@/context/DataContext';
import type { YearMonth } from '@/types/monthly';

function formatMonth(ym: YearMonth) {
  // ym is YYYY-MM
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return date.toLocaleString(undefined, { year: 'numeric', month: 'long' });
}

export function MonthlySummarySection() {
  const { data: indexData, isLoading: indexLoading, error: indexError } = useMonthlyIndex({ order: 'desc', limit: 12 });

  // Determine selected month: latest by default when index loads
  const latestMonth = indexData?.latestMonth || (indexData?.months?.length ? indexData.months[0] : undefined);
  const [selectedMonth, setSelectedMonth] = useState<YearMonth | undefined>(undefined);

  useEffect(() => {
    if (!selectedMonth && latestMonth) {
      setSelectedMonth(latestMonth);
    }
  }, [latestMonth, selectedMonth]);

  const { data: snapshotData, isLoading: snapLoading, error: snapError, refresh } = useMonthlySnapshot(selectedMonth || ('' as YearMonth), { autoFetch: Boolean(selectedMonth) });

  const summary = snapshotData?.snapshot?.summary;

  return (
    <Card>
      <div className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-xl font-semibold">Monthly Summary</h2>

          <div className="flex items-center gap-2">
            <label htmlFor="month-select" className="text-sm text-gray-600">Month</label>
            <select
              id="month-select"
              className="px-3 py-2 border rounded-md bg-white dark:bg-neutral-900"
              disabled={indexLoading || !indexData?.months?.length}
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value as YearMonth)}
            >
              {indexData?.months?.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* States */}
        {indexLoading && (
          <div className="text-gray-500">Loading months…</div>
        )}
        {indexError && (
          <div className="text-red-600">Failed to load months.</div>
        )}

        {!indexLoading && !indexError && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Selected Month</div>
              <div className="text-lg font-medium">{selectedMonth ? formatMonth(selectedMonth) : '-'}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Total Rows</div>
              <div className="text-lg font-medium">
                {snapLoading ? '…' : summary?.totalRows ?? '-'}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Avg Progress %</div>
              <div className="text-lg font-medium">
                {snapLoading ? '…' : (summary?.avgProgressPct != null ? `${summary.avgProgressPct.toFixed(1)}%` : '-')}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Total Manpower</div>
              <div className="text-lg font-medium">
                {snapLoading ? '…' : (summary?.totalManpower != null ? summary.totalManpower : '-')}
              </div>
            </div>
          </div>
        )}

        {snapError && (
          <div className="text-red-600">Failed to load snapshot.</div>
        )}
      </div>
    </Card>
  );
}
