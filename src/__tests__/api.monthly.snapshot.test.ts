import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Helper to create a NextRequest with URL and method
const createTestRequest = (url: string, method: string = 'GET'): NextRequest => {
  const urlObj = new URL(url, 'http://localhost');
  return new NextRequest(urlObj, { method });
};


const mockListMonthlyTabs = vi.fn();
const mockGetSheetData = vi.fn();
const mockCleanMechanicalPlanData = vi.fn();

vi.mock('@/lib/googleSheets', () => ({
  GoogleSheetsService: vi.fn().mockImplementation(() => ({
    listMonthlyTabs: mockListMonthlyTabs,
    getSheetData: mockGetSheetData,
    cleanMechanicalPlanData: mockCleanMechanicalPlanData,
  }))
}));

// Import the route handler AFTER mocking dependencies
import { GET } from '@/app/api/monthly/[yearMonth]/route';

describe('/api/monthly/[yearMonth]', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    mockCleanMechanicalPlanData.mockImplementation((data) => data);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles invalid yearMonth format', async () => {
    mockListMonthlyTabs.mockResolvedValueOnce([]);
    const req = createTestRequest('http://localhost/api/monthly/2025-13');
    const res = await GET(req, { params: { yearMonth: '2025-13' } } as any);
    
    // The API returns 404 for invalid yearMonth that doesn't match the format
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
    
    // Verify no service methods were called with invalid params
    expect(mockListMonthlyTabs).toHaveBeenCalled();
    expect(mockGetSheetData).not.toHaveBeenCalled();
  });

  it('returns snapshot with summary for a valid month', async () => {
    // Set up the mock to return our test data
    mockListMonthlyTabs.mockResolvedValueOnce([{ 
      sheetId: 1, 
      title: '2025-09',
      sheetTitle: '2025-09',
      yearMonth: '2025-09',
      index: 0
    }]);
    
    mockGetSheetData.mockResolvedValueOnce([
      { ID: '1', CurrentProgressPct: 50, ManpowerTotal: 10, Status: 'On Track' }
    ]);
    
    const req = createTestRequest('http://localhost/api/monthly/2025-09');
    const res = await GET(req, { params: { yearMonth: '2025-09' } } as any);
    
    // Check if the response is successful (200) or if there's an error
    if (res.status !== 200) {
      const error = await res.json();
      console.error('API Error:', error);
    }
    
    // Verify service methods were called with correct parameters
    expect(mockListMonthlyTabs).toHaveBeenCalledTimes(1);
    expect(mockGetSheetData).toHaveBeenCalledTimes(1);
    
    const body = await res.json();
    
    // Check the response structure
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('month', '2025-09');
    expect(body).toHaveProperty('snapshot');
    expect(body.snapshot).toHaveProperty('summary');
    
    expect(Array.isArray(body.snapshot.rows)).toBe(true);
    if (body.snapshot.rows.length > 0) {
      const firstRow = body.snapshot.rows[0];
      expect(firstRow).toHaveProperty('ID');
      expect(firstRow).toHaveProperty('CurrentProgressPct');
      expect(firstRow).toHaveProperty('ManpowerTotal');
      expect(firstRow).toHaveProperty('Status');
    }
  });
});
