import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DataProvider, useMonthlyIndex } from '@/context/DataContext';

// Mock the next-intl provider with minimal required messages
const mockMessages = {
  common: {
    loading: 'Loading...',
    error: 'Error: {error}'
  }
};

// Mock the useTranslations hook
vi.mock('next-intl', async () => {
  const actual = await vi.importActual('next-intl');
  return {
    ...actual,
    useTranslations: () => (key: string) => {
      const [ns, k] = key.split('.');
      return mockMessages[ns as keyof typeof mockMessages]?.[k as keyof (typeof mockMessages)[keyof typeof mockMessages]] || key;
    },
  };
});

describe('DataContext monthly hooks', () => {
  const mockResponse = {
    months: ['2025-10', '2025-09', '2025-08'],
    latestMonth: '2025-10',
    metaByMonth: {
      '2025-10': { sheetId: 2, sheetTitle: '2025-10', yearMonth: '2025-10', year: 2025, month: 10, index: 11 },
      '2025-09': { sheetId: 1, sheetTitle: '2025-09', yearMonth: '2025-09', year: 2025, month: 9, index: 10 },
      '2025-08': { sheetId: 3, sheetTitle: '2025-08', yearMonth: '2025-08', year: 2025, month: 8, index: 9 },
    }
  };

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('useMonthlyIndex fetches and renders months', async () => {
    function TestComponent() {
      const { data, isLoading, error } = useMonthlyIndex({ order: 'desc', limit: 3 });

      if (isLoading) return <div>Loading...</div>;
      if (error) return <div>Error: {error.message}</div>;

      return (
        <div data-testid="months">
          {data?.months?.join(',') || ''}
        </div>
      );
    }

    render(
      <DataProvider>
        <TestComponent />
      </DataProvider>
    );

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // After loading, should show the months
    await waitFor(() => {
      const monthsElement = screen.getByTestId('months');
      expect(monthsElement).toHaveTextContent('2025-10,2025-09,2025-08');
    });
  });
});
