// src/hooks/useHistoricalData.ts
import { useState, useEffect } from 'react';
import { getHistoricalProgressData, SHEET_NAMES, type HistoricalProgressRow } from '@/services/google-sheets';
import { useToast } from '@/hooks/use-toast';

export function useHistoricalData() {
    const [data, setData] = useState<HistoricalProgressRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchDataInternal = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getHistoricalProgressData(SHEET_NAMES.HISTORY);
                if (!Array.isArray(result)) {
                    console.warn(`Received non-array data for ${SHEET_NAMES.HISTORY}:`, result);
                    setData([]);
                    throw new Error(`Invalid data format for ${SHEET_NAMES.HISTORY}.`);
                }
                setData(result);
            } catch (err) {
                console.error(`Error fetching ${SHEET_NAMES.HISTORY}:`, err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
                setData([]);
                toast({ variant: "destructive", title: `Error Loading ${SHEET_NAMES.HISTORY}`, description: errorMessage });
            } finally {
                setLoading(false);
            }
        };
        fetchDataInternal();
    }, [toast]);

    return { historicalData: data, historicalLoading: loading, historicalError: error };
}