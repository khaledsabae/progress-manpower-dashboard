// src/hooks/useRiskData.ts
import { useState, useEffect, useCallback } from 'react';
// نستورد النوع الأساسي RiskRegisterItem من مكانه الأصلي في services
import { getRiskRegisterData, type RiskRegisterItem, SHEET_NAMES } from '@/services/google-sheets';

interface UseRiskDataReturn {
  data: RiskRegisterItem[]; // هنا بنستخدم النوع المستورد
  loading: boolean;
  error: Error | null;
  refreshData: () => void;
}

const RISK_REGISTER_SHEET_NAME = SHEET_NAMES.RISK_REGISTER;

export function useRiskData(): UseRiskDataReturn {
  const [data, setData] = useState<RiskRegisterItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRiskRegisterData(RISK_REGISTER_SHEET_NAME);
      setData(result);
    } catch (err: any) {
      console.error("[useRiskData] Failed to fetch risk data:", err);
      setError(err instanceof Error ? err : new Error(String(err.message || 'An unknown error occurred while fetching risk data')));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []); // RISK_REGISTER_SHEET_NAME is constant, so empty dependency array is fine

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refreshData: fetchData };
}