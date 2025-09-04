import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { GET } from '@/app/api/monthly/route';

// Helper to create a NextRequest with URL and method
const createTestRequest = (url: string, method: string = 'GET'): NextRequest => {
  const urlObj = new URL(url, 'http://localhost');
  return new NextRequest(urlObj, { method });
};

// Mock the GoogleSheetsService
const mockTabs = [
  { sheetId: 1, index: 10, title: '2025-09', sheetTitle: '2025-09', yearMonth: '2025-09', year: 2025, month: 9 },
  { sheetId: 2, index: 11, title: '2025-10', sheetTitle: '2025-10', yearMonth: '2025-10', year: 2025, month: 10 },
  { sheetId: 3, index: 9, title: '2025-08', sheetTitle: '2025-08', yearMonth: '2025-08', year: 2025, month: 8 },
];

const mockListMonthlyTabs = vi.fn().mockResolvedValue(mockTabs);

vi.mock('@/lib/googleSheets', () => ({
  GoogleSheetsService: vi.fn().mockImplementation(() => ({
    listMonthlyTabs: mockListMonthlyTabs
  }))
}));

describe('/api/monthly', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    mockListMonthlyTabs.mockResolvedValue(mockTabs);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns filtered, sorted and limited months', async () => {
    const req = createTestRequest('http://localhost/api/monthly?order=desc&limit=2');
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    
    // Verify service method was called
    expect(mockListMonthlyTabs).toHaveBeenCalledTimes(1);
    
    // Verify response structure
    expect(body).toMatchObject({
      months: ['2025-10', '2025-09'],
      latestMonth: '2025-10',
      metaByMonth: {
        '2025-10': expect.objectContaining({
          yearMonth: '2025-10',
          sheetTitle: '2025-10',
          year: 2025,
          month: 10
        }),
        '2025-09': expect.objectContaining({
          yearMonth: '2025-09',
          sheetTitle: '2025-09',
          year: 2025,
          month: 9
        })
      }
    });
  });

  it('validates bad params', async () => {
    const req = createTestRequest('http://localhost/api/monthly?order=down');
    const res = await GET(req);
    
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid order');
    
    // Verify service method was not called with invalid params
    expect(mockListMonthlyTabs).not.toHaveBeenCalled();
  });
});
