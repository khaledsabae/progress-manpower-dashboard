import { describe, it, expect } from 'vitest';
import { GoogleSheetsService } from '@/lib/googleSheets';

// Create a bare instance without running the constructor (avoids env/auth requirements)
function createService(): GoogleSheetsService {
  return Object.create(GoogleSheetsService.prototype) as GoogleSheetsService;
}

describe('GoogleSheetsService utilities', () => {
  it('normalizeYearMonth handles canonical and variants', () => {
    const svc = createService() as any;
    expect(svc.normalizeYearMonth('2025-09')).toBe('2025-09');
    expect(svc.normalizeYearMonth('2025-9')).toBe('2025-09');
    expect(svc.normalizeYearMonth('2025/09')).toBe('2025-09');
    expect(svc.normalizeYearMonth('202509')).toBe('2025-09');
    expect(svc.normalizeYearMonth('Sep 2025')).toBe('2025-09');
    expect(svc.normalizeYearMonth('September 2025')).toBe('2025-09');
    expect(svc.normalizeYearMonth('')).toBeNull();
    expect(svc.normalizeYearMonth(null)).toBeNull();
    expect(svc.normalizeYearMonth('2025-13')).toBeNull();
  });

  it('extractYearMonthFromTitle finds the best candidate in titles', () => {
    const svc = createService() as any;
    expect(svc.extractYearMonthFromTitle('Mechanical Plan (2025-9)')).toBe('2025-09');
    expect(svc.extractYearMonthFromTitle('Report September 2025 - v2')).toBe('2025-09');
    expect(svc.extractYearMonthFromTitle('2024/12 Snapshot')).toBe('2024-12');
    expect(svc.extractYearMonthFromTitle('No date here')).toBeNull();
  });

  it('listMonthlyTabs deduplicates and sorts (mocked metadata)', async () => {
    const svc = createService() as any;
    // monkey-patch methods used internally
    svc.extractYearMonthFromTitle = (title: string) => (svc as any).normalizeYearMonth(title);
    svc.listSheetsWithMeta = async () => ([
      { sheetId: 1, index: 3, title: '2025-09' },
      { sheetId: 2, index: 2, title: '2025-09' }, // duplicate, lower index
      { sheetId: 3, index: 1, title: '2025-08' },
      { sheetId: 4, index: 4, title: '2025-10' },
    ]);

    const tabs = await svc.listMonthlyTabs();
    expect(tabs.map((t: any) => t.yearMonth)).toEqual(['2025-08', '2025-09', '2025-10']);
    // For 2025-09, should keep sheetId 1 (higher index or exact title rule)
    const sept = tabs.find((t: any) => t.yearMonth === '2025-09');
    expect(sept.sheetId).toBe(1);
  });
});
