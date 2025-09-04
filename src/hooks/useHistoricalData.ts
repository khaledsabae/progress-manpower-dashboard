// src/hooks/useHistoricalData.ts
import { useState, useEffect } from 'react';
import { getHistoricalProgressData, SHEET_NAMES, type HistoricalProgressRow } from '@/services/google-sheets';
import { useToast } from '@/hooks/use-toast';

// Helper function to remove duplicate timestamps from historical data
function deduplicateHistoricalData(data: HistoricalProgressRow[]): HistoricalProgressRow[] {
    const seen = new Set<string>();
    return data.filter(item => {
        const key = item.snapshotTimestamp ? item.snapshotTimestamp.toString() : item.snapshotDateString || '';
        if (seen.has(key)) {
            console.warn(`[Data Deduplication] Removing duplicate entry with key: ${key}`);
            return false;
        }
        seen.add(key);
        return true;
    });
}

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

                // Deduplicate data to prevent duplicate key errors
                const deduplicatedData = deduplicateHistoricalData(result);
                if (deduplicatedData.length !== result.length) {
                    console.log(`[Data Processing] Removed ${result.length - deduplicatedData.length} duplicate entries`);
                }

                setData(deduplicatedData);
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