// src/hooks/useManpowerData.ts
import { useState, useEffect } from 'react';
import { getManpowerSheetData, SHEET_NAMES, type ManpowerSheetRow } from '@/services/google-sheets';
import { useToast } from '@/hooks/use-toast';

export function useManpowerData() {
    const [data, setData] = useState<ManpowerSheetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchDataInternal = async () => {
            setLoading(true);
            setError(null); // Reset error before fetching
            try {
                const result = await getManpowerSheetData(SHEET_NAMES.MANPOWER);
                if (!Array.isArray(result)) {
                    console.warn(`Received non-array data for ${SHEET_NAMES.MANPOWER}:`, result);
                    setData([]); // Set to empty array if format is invalid
                    throw new Error(`Invalid data format for ${SHEET_NAMES.MANPOWER}.`);
                }
                setData(result);
            } catch (err) {
                console.error(`Error fetching ${SHEET_NAMES.MANPOWER}:`, err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
                setData([]); // Clear data on error
                toast({ variant: "destructive", title: `Error Loading ${SHEET_NAMES.MANPOWER}`, description: errorMessage });
            } finally {
                setLoading(false);
            }
        };
        fetchDataInternal();
    }, [toast]); // toast is a dependency for error notifications

    return { manpowerData: data, manpowerLoading: loading, manpowerError: error };
}