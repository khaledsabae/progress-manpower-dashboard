import { useCallback, useRef, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { DataState, DataFetchError, DashboardData, ProgressData, ManpowerData, AIInsights, RiskData } from '@/types/dashboard';
import { toast } from 'react-hot-toast';

export type DataType = 'progress' | 'manpower' | 'aiInsights' | 'risk';

type DataTypeMap = {
  progress: ProgressData;
  manpower: ManpowerData;
  aiInsights: AIInsights;
  risk: RiskData;
};

type ExtractData<T extends DataType> = T extends keyof DataTypeMap ? DataTypeMap[T] : never;

interface UseDataFetcherOptions<T extends DataType = DataType> {
  /**
   * The data type to fetch
   */
  type: T;
  
  /**
   * Whether to automatically fetch data when the component mounts
   * @default true
   */
  autoFetch?: boolean;
  
  /**
   * Callback when data is successfully fetched
   */
  onSuccess?: (data: ExtractData<T>) => void;
  
  /**
   * Callback when an error occurs
   */
  onError?: (error: DataFetchError) => void;
  
  /**
   * Whether to show error toasts
   * @default true
   */
  showErrorToast?: boolean;
  
  /**
   * Whether to show success toasts
   * @default false
   */
  showSuccessToast?: boolean;
  
  /**
   * Custom error message for toasts
   */
  errorMessage?: string;
  
  /**
   * Custom success message for toasts
   */
  successMessage?: string;
}

interface UseDataFetcherResult<T extends DataType = DataType> {
  /**
   * Current data state
   */
  state: DataState<ExtractData<T>>;
  
  /**
   * The current data, or null if not loaded or error
   */
  data: ExtractData<T> | null;
  
  /**
   * The current error, or null if no error
   */
  error: DataFetchError | null;
  
  /**
   * Whether the data is currently loading
   */
  isLoading: boolean;
  
  /**
   * Whether the data is currently being refreshed
   */
  isRefreshing: boolean;
  
  /**
   * Whether this is the initial load
   */
  isInitialLoading: boolean;
  
  /**
   * Refetch the data
   */
  refetch: (options?: { silent?: boolean }) => Promise<ExtractData<T> | null>;
  
  /**
   * Update the data manually (useful for optimistic updates)
   */
  setData: (data: ExtractData<T> | null) => void;
}

/**
 * A hook to fetch and manage data with loading and error states
 */
// Type for the data fetcher function
type DataFetcher = <T extends DataType>(
  options: UseDataFetcherOptions<T>
) => UseDataFetcherResult<T>;

// Define the main hook with proper TypeScript generics
export function useDataFetcher<T extends DataType>({
  type,
  autoFetch = true,
  onSuccess,
  onError,
  showErrorToast = true,
  showSuccessToast = false,
  errorMessage,
  successMessage,
}: UseDataFetcherOptions<T>): UseDataFetcherResult<T> {
  const { getData, getDataState, isRefreshing: isRefreshingContext, refreshData } = useData();
  const state = getDataState(type) as DataState<ExtractData<T>>;
  const isMounted = useRef(true);
  const isInitialMount = useRef(true);
  const lastFetchTime = useRef<number>(0);
  const isRefreshingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  
  // Track if this is the initial mount
  const isInitialLoading = state.status === 'idle' || 
                         (state.status === 'loading' && isInitialMount.current);
  
  const fetchData = useCallback(async (options: { silent?: boolean } = {}): Promise<ExtractData<T> | null> => {
    const { silent = false } = options;
    
    // Prevent duplicate requests within 2 seconds
    const now = Date.now();
    if (now - lastFetchTime.current < 2000) {
      return null;
    }
    
    lastFetchTime.current = now;
    isRefreshingRef.current = true;
    
    try {
      const response = await getData(type, true);
      const data = response as ExtractData<T> | null;
      
      if (!isMounted.current) return null;
      
      hasFetchedRef.current = true;
      
      if (data) {
        if (showSuccessToast && successMessage) {
          toast.success(successMessage);
        }
        
        onSuccess?.(data);
      }
      
      return data ?? null;
    } catch (error) {
      if (!isMounted.current) return null;
      
      const errorObj: DataFetchError = {
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        status: (error as any)?.status,
        code: (error as any)?.code,
        timestamp: new Date().toISOString(),
        retryable: (error as any)?.retryable ?? true,
      };
      
      if (showErrorToast && !silent) {
        toast.error(errorMessage || errorObj.message || 'Failed to fetch data');
      }
      
      onError?.(errorObj);
      
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [
    type, 
    getData, 
    onSuccess, 
    onError, 
    showErrorToast, 
    showSuccessToast, 
    errorMessage, 
    successMessage
  ]);

  // Handle component unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Handle auto-fetch on mount
  useEffect(() => {
    if (autoFetch && (state.status === 'idle' || state.status === 'error')) {
      fetchData();
    }
    
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [autoFetch, state.status, fetchData]);
  
  // Handle manual refresh
  const refetch = useCallback(async (options: { silent?: boolean } = {}): Promise<ExtractData<T> | null> => {
    return fetchData({ silent: options.silent });
  }, [fetchData]);
  
  // Update data manually
  const setData = useCallback(async (data: ExtractData<T> | null) => {
    // This would need to be implemented in the DataContext
    console.warn('setData is not yet implemented in DataContext');
  }, []);
  
  return {
    state,
    data: state.status === 'success' ? state.data as ExtractData<T> | null : null,
    error: state.status === 'error' ? state.error : null,
    isLoading: state.status === 'loading',
    isRefreshing: isRefreshingRef.current,
    isInitialLoading: state.status === 'loading' && !hasFetchedRef.current,
    refetch,
    setData,
  };
}

/**
 * Hook to fetch progress data
 */
export function useProgressData(options: Omit<UseDataFetcherOptions<'progress'>, 'type'> = {}) {
  return useDataFetcher({
    type: 'progress',
    errorMessage: 'Failed to load progress data',
    ...options
  });
}

/**
 * Hook to fetch manpower data
 */
export function useManpowerData(options: Omit<UseDataFetcherOptions<'manpower'>, 'type'> = {}) {
  return useDataFetcher({
    type: 'manpower',
    errorMessage: 'Failed to load team data',
    ...options
  });
}

/**
 * Hook to fetch AI insights
 */
export function useAIInsights(options: Omit<UseDataFetcherOptions<'aiInsights'>, 'type'> = {}) {
  return useDataFetcher({
    type: 'aiInsights',
    ...options
  });
}

/**
 * Hook to fetch risk data
 */
export function useRiskData(options: Omit<UseDataFetcherOptions<'risk'>, 'type'> = {}) {
  return useDataFetcher({
    type: 'risk',
    ...options
  });
}
