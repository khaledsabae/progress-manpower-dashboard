// src/hooks/useMechanicalPlanData.ts
import { useState, useEffect, useCallback } from 'react'; // ضيف useCallback
import { getMechanicalPlanData, SHEET_NAMES, type MechanicalPlanRow } from '@/services/google-sheets';
import { useToast } from '@/hooks/use-toast';

export function useMechanicalPlanData() {
    const [data, setData] = useState<MechanicalPlanRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // استخدم useCallback هنا عشان الدالة متتغيرش مع كل render إلا لو toast اتغيرت
    const fetchDataInternal = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getMechanicalPlanData(SHEET_NAMES.PLAN);
            if (!Array.isArray(result)) {
                console.warn(`Received non-array data for ${SHEET_NAMES.PLAN}:`, result);
                setData([]);
                throw new Error(`Invalid data format for ${SHEET_NAMES.PLAN}.`);
            }
            setData(result);
        } catch (err) {
            console.error(`Error fetching ${SHEET_NAMES.PLAN}:`, err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            setData([]);
            toast({ variant: "destructive", title: `Error Loading ${SHEET_NAMES.PLAN}`, description: errorMessage });
        } finally {
            setLoading(false);
        }
    }, [toast]); // خلي toast كـ dependency

    useEffect(() => {
        fetchDataInternal();
    }, [fetchDataInternal]); // خلي fetchDataInternal هي الـ dependency

    // رجع الدالة fetchDataInternal عشان نقدر نستدعيها من بره
    return { mechanicalPlanData: data, mechanicalPlanLoading: loading, mechanicalPlanError: error, refetchMechanicalPlanData: fetchDataInternal };
}