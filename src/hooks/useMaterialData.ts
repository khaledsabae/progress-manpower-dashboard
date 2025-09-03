// src/hooks/useMaterialData.ts
import { useState, useEffect } from 'react';
import { getMaterialStatusData, SHEET_NAMES, type MaterialStatusRow } from '@/services/google-sheets';
import { useToast } from '@/hooks/use-toast';

export function useMaterialData() {
    const [data, setData] = useState<MaterialStatusRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchDataInternal = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getMaterialStatusData(SHEET_NAMES.MATERIAL);
                if (!Array.isArray(result)) {
                    console.warn(`Received non-array data for ${SHEET_NAMES.MATERIAL}:`, result);
                    setData([]);
                    throw new Error(`Invalid data format for ${SHEET_NAMES.MATERIAL}.`);
                }
                setData(result);
            } catch (err) {
                console.error(`Error fetching ${SHEET_NAMES.MATERIAL}:`, err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
                setData([]);
                toast({ variant: "destructive", title: `Error Loading ${SHEET_NAMES.MATERIAL}`, description: errorMessage });
            } finally {
                setLoading(false);
            }
        };
        fetchDataInternal();
    }, [toast]);

    return { materialData: data, materialLoading: loading, materialError: error };
}