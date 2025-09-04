'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { DataState, DashboardData, DataFetchError } from '@/types/dashboard';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchWithTimeout, isTimeoutError, CLIENT_FETCH_TIMEOUT_MS, combineSignals } from '@/lib/http/timeout';
import type { MonthlyIndexResponse, MonthlySnapshotsResponse, YearMonth } from '@/types/monthly';

// Types
type DataType = 'progress' | 'manpower' | 'aiInsights' | 'risk';

interface DataCache {
  [key: string]: {
    data: DashboardData;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
  };
}

interface DataStateContextType {
  getData: (type: DataType, forceRefresh?: boolean, signal?: AbortSignal) => Promise<DashboardData | null>;
  refreshData: (type?: DataType) => Promise<void>;
  getDataState: (type: DataType) => DataState<any>;
  isRefreshing: (type: DataType) => boolean;
  // Monthly APIs
  getMonthlyIndex: (options?: { order?: 'asc' | 'desc'; limit?: number; from?: YearMonth; to?: YearMonth; signal?: AbortSignal }) => Promise<MonthlyIndexResponse>;
  getMonthlySnapshot: (yearMonth: YearMonth, options?: { signal?: AbortSignal }) => Promise<MonthlySnapshotsResponse>;
}

interface DataProviderProps {
  children: React.ReactNode;
  initialData?: Partial<Record<DataType, DashboardData>>;
}

// Initial state for each data type
const initialDataState = (): DataState<any> => ({
  status: 'idle',
});

// Create the context with a default value
const DataContext = createContext<DataStateContextType | undefined>(undefined);

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Action types
type Action =
  | { type: 'FETCH_STARTED'; payload: { dataType: DataType } }
  | { type: 'FETCH_SUCCESS'; payload: { dataType: DataType; data: DashboardData } }
  | { type: 'FETCH_ERROR'; payload: { dataType: DataType; error: DataFetchError } };

// Reducer function to manage state
function dataReducer(state: Record<DataType, DataState<any>>, action: Action) {
  const { dataType } = action.payload;
  
  switch (action.type) {
    case 'FETCH_STARTED':
      return {
        ...state,
        [dataType]: { status: 'loading', timestamp: new Date().toISOString() },
      };
      
    case 'FETCH_SUCCESS':
      return {
        ...state,
        [dataType]: { 
          status: 'success', 
          data: action.payload.data,
          timestamp: new Date().toISOString() 
        },
      };
      
    case 'FETCH_ERROR':
      return {
        ...state,
        [dataType]: { 
          status: 'error', 
          error: action.payload.error,
          timestamp: new Date().toISOString() 
        },
      };
      
    default:
      return state;
  }
}

export function DataProvider({ children, initialData }: DataProviderProps) {
  const t = useTranslations();
  const cache = useRef<DataCache>({});
  const inFlightRequests = useRef<Record<string, Promise<any>>>({});
  const abortControllerMap = useRef<Map<DataType, AbortController>>(new Map());
  // Monthly caches and controllers
  const monthlyIndexCache = useRef<{ data: MonthlyIndexResponse; timestamp: number; ttl: number } | null>(null);
  const monthlyIndexInFlight = useRef<Promise<MonthlyIndexResponse> | null>(null);
  const monthlyIndexAbort = useRef<AbortController | null>(null);
  const monthlySnapshotCache = useRef<Record<YearMonth, { data: MonthlySnapshotsResponse; timestamp: number; ttl: number }>>({});
  const monthlySnapshotInFlight = useRef<Record<YearMonth, Promise<MonthlySnapshotsResponse>>>({});
  const monthlySnapshotAbortMap = useRef<Map<YearMonth, AbortController>>(new Map());
  
  // Initialize state with initial data if provided
  const [state, dispatch] = useReducer(dataReducer, {
    progress: initialData?.progress ? { 
      status: 'success', 
      data: initialData.progress,
      timestamp: new Date().toISOString() 
    } : initialDataState(),
    manpower: initialData?.manpower ? { 
      status: 'success', 
      data: initialData.manpower,
      timestamp: new Date().toISOString() 
    } : initialDataState(),
    aiInsights: initialData?.aiInsights ? { 
      status: 'success', 
      data: initialData.aiInsights,
      timestamp: new Date().toISOString() 
    } : initialDataState(),
    risk: initialDataState(),
  });

  // Fetch data from API
  const fetchData = useCallback(async (type: DataType, signal?: AbortSignal): Promise<DashboardData> => {
    const cacheKey = `${type}`;
    const cached = cache.current[cacheKey];
    
    // Return cached data if it's still valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    
    try {
      // Abort any existing request for this type
      if (abortControllerMap.current.has(type)) {
        abortControllerMap.current.get(type)!.abort();
      }
      const controller = new AbortController();
      abortControllerMap.current.set(type, controller);
      const combinedSignal = signal ? combineSignals([signal, controller.signal]) : controller.signal;
      
      const start = Date.now();
      
      // Check if there's already a request in flight
      if (cacheKey in inFlightRequests.current) {
        return inFlightRequests.current[cacheKey];
      }
      
      // Create a new request with special handling per type
      const request = (async () => {
        // Helper to fetch consolidated project data once when needed
        const fetchProjectData = async () => {
          const resp = await fetchWithTimeout('/api/project-data', { signal: combinedSignal }, CLIENT_FETCH_TIMEOUT_MS);
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw {
              message: err.message || 'Failed to fetch project data',
              status: resp.status,
              code: err.code,
              timestamp: new Date().toISOString(),
              retryable: resp.status !== 404,
            };
          }
          const json = await resp.json();
          return json?.data ?? json;
        };

        let result: any;

        if (type === 'manpower') {
          const projectData = await fetchProjectData();
          result = projectData?.manpower ?? [];
        } else if (type === 'progress') {
          const projectData = await fetchProjectData();
          // Use mechanicalPlan as the basis for progress if available
          result = projectData?.mechanicalPlan ?? [];
        } else if (type === 'aiInsights') {
          const projectData = await fetchProjectData();
          const resp = await fetchWithTimeout('/api/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectData }),
            signal: combinedSignal,
          }, CLIENT_FETCH_TIMEOUT_MS);
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok || json?.success === false) {
            throw {
              message: json?.message || json?.error || 'Failed to generate AI insights',
              status: resp.status,
              code: json?.code,
              timestamp: new Date().toISOString(),
              retryable: resp.status !== 404 && resp.status !== 400,
            };
          }
          result = json?.data ?? json;
        } else {
          // Fallback: attempt generic GET
          const response = await fetchWithTimeout(`/api/${type}`, { signal: combinedSignal }, CLIENT_FETCH_TIMEOUT_MS);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw {
              message: errorData.message || 'Failed to fetch data',
              status: response.status,
              code: errorData.code,
              timestamp: new Date().toISOString(),
              retryable: response.status !== 404,
            };
          }
          result = await response.json();
        }

        // Cache the successful response
        cache.current[cacheKey] = {
          data: result,
          timestamp: Date.now(),
          ttl: CACHE_TTL,
        };
        
        return result;
      })();
      
      // Store the request to prevent duplicate fetches
      inFlightRequests.current[cacheKey] = request;
      
      // Clean up the in-flight request when done
      try {
        return await request;
      } finally {
        delete inFlightRequests.current[cacheKey];
        const duration = Date.now() - start;
        console.log(`[fetchData] ${type} completed in ${duration}ms`);
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        toast.error('Request timed out. Please try again.', { id: `${type}-timeout` });
      } else {
        console.error(`Error fetching ${type}:`, error);
      }
      throw error;
    }
  }, []);

  // --- Module 5: Monthly fetchers with caching, abort, and timeouts ---
  const getMonthlyIndex = useCallback(async (options?: { order?: 'asc' | 'desc'; limit?: number; from?: YearMonth; to?: YearMonth; signal?: AbortSignal }): Promise<MonthlyIndexResponse> => {
    const order = options?.order ?? 'desc';
    const limit = options?.limit ?? 12;
    const from = options?.from;
    const to = options?.to;

    // Serve from cache if fresh and params match common defaults
    const cacheEntry = monthlyIndexCache.current;
    if (!from && !to && order === 'desc' && limit === 12 && cacheEntry && Date.now() - cacheEntry.timestamp < cacheEntry.ttl) {
      return cacheEntry.data;
    }

    // Abort previous
    if (monthlyIndexAbort.current) monthlyIndexAbort.current.abort();
    const controller = new AbortController();
    monthlyIndexAbort.current = controller;
    const combinedSignal = options?.signal ? combineSignals([options.signal, controller.signal]) : controller.signal;

    if (monthlyIndexInFlight.current) {
      try { return await monthlyIndexInFlight.current; } finally { monthlyIndexInFlight.current = null; }
    }

    const qs = new URLSearchParams();
    if (order) qs.set('order', order);
    if (limit) qs.set('limit', String(limit));
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);

    const promise = (async () => {
      const resp = await fetchWithTimeout(`/api/monthly?${qs.toString()}`, { signal: combinedSignal }, CLIENT_FETCH_TIMEOUT_MS);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const message = (json as any)?.error || 'Failed to fetch monthly index';
        throw Object.assign(new Error(message), { status: resp.status, code: (json as any)?.code, retryable: resp.status !== 404 });
      }
      const data = json as MonthlyIndexResponse;
      // Cache default common case
      if (!from && !to && order === 'desc' && limit === 12) {
        monthlyIndexCache.current = { data, timestamp: Date.now(), ttl: CACHE_TTL };
      }
      return data;
    })();

    monthlyIndexInFlight.current = promise;
    try { return await promise; } finally { monthlyIndexInFlight.current = null; }
  }, []);

  const getMonthlySnapshot = useCallback(async (yearMonth: YearMonth, options?: { signal?: AbortSignal }): Promise<MonthlySnapshotsResponse> => {
    // Serve from cache if still valid
    const cached = monthlySnapshotCache.current[yearMonth];
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Abort previous for this YM
    if (monthlySnapshotAbortMap.current.has(yearMonth)) {
      monthlySnapshotAbortMap.current.get(yearMonth)!.abort();
    }
    const controller = new AbortController();
    monthlySnapshotAbortMap.current.set(yearMonth, controller);
    const combinedSignal = options?.signal ? combineSignals([options.signal, controller.signal]) : controller.signal;

    // De-dupe in-flight
    if (monthlySnapshotInFlight.current[yearMonth]) {
      try { return await monthlySnapshotInFlight.current[yearMonth]; } finally { delete monthlySnapshotInFlight.current[yearMonth]; }
    }

    const promise = (async () => {
      const resp = await fetchWithTimeout(`/api/monthly/${yearMonth}`, { signal: combinedSignal }, CLIENT_FETCH_TIMEOUT_MS);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const message = (json as any)?.error || 'Failed to fetch monthly snapshot';
        throw Object.assign(new Error(message), { status: resp.status, code: (json as any)?.code, retryable: resp.status !== 404 && resp.status !== 400 });
      }
      const data = json as MonthlySnapshotsResponse;
      monthlySnapshotCache.current[yearMonth] = { data, timestamp: Date.now(), ttl: CACHE_TTL };
      return data;
    })();

    monthlySnapshotInFlight.current[yearMonth] = promise;
    try { return await promise; } finally { delete monthlySnapshotInFlight.current[yearMonth]; }
  }, []);

  // Get data with caching and loading states
  const getData = useCallback(async (type: DataType, forceRefresh = false, signal?: AbortSignal): Promise<DashboardData | null> => {
    const cacheKey = `${type}`;
    
    try {
      // Don't fetch if we already have the data and not forcing refresh
      if (!forceRefresh && state[type].status === 'success' && !isStale(state[type])) {
        return state[type].data;
      }
      
      // Don't fetch if already loading
      if (state[type].status === 'loading') {
        return null;
      }
      
      dispatch({ type: 'FETCH_STARTED', payload: { dataType: type } });
      
      const data = await fetchData(type, signal);
      dispatch({ 
        type: 'FETCH_SUCCESS', 
        payload: { dataType: type, data } 
      });
      
      return data;
    } catch (error) {
      const errorObj: DataFetchError = {
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        status: (error as any)?.status,
        code: (error as any)?.code,
        timestamp: new Date().toISOString(),
        retryable: (error as any)?.retryable ?? true,
      };
      
      dispatch({ 
        type: 'FETCH_ERROR', 
        payload: { dataType: type, error: errorObj } 
      });
      
      // Show toast for non-retryable errors or first-time errors
      if (isTimeoutError(error)) {
        // Already toasted in fetchData
      } else if (!errorObj.retryable || state[type].status === 'idle') {
        toast.error(
          errorObj.message || t('errorOccurred'),
          { id: `${type}-error` }
        );
      }
      
      return null;
    }
  }, [fetchData, state, t]);

  // Check if data is stale
  const isStale = (dataState: DataState<any>): boolean => {
    if (dataState.status !== 'success' || !dataState.timestamp) return true;
    const age = Date.now() - new Date(dataState.timestamp).getTime();
    return age > CACHE_TTL;
  };

  // Refresh data
  const refreshData = useCallback(async (type?: DataType) => {
    const typesToRefresh = type ? [type] : (Object.keys(state) as DataType[]);
    
    await Promise.all(
      typesToRefresh.map(t => 
        getData(t, true).catch(error => {
          console.error(`Error refreshing ${t}:`, error);
          return null;
        })
      )
    );
  }, [getData, state]);

  // Get the current state for a data type
  const getDataState = useCallback((type: DataType): DataState<any> => {
    return state[type] || initialDataState();
  }, [state]);

  // Check if data is currently being refreshed
  const isRefreshing = useCallback((type: DataType): boolean => {
    return state[type]?.status === 'loading' || false;
  }, [state]);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      const types: DataType[] = ['progress', 'manpower', 'aiInsights'];
      
      // Only load data that hasn't been loaded yet
      const typesToLoad = types.filter(
        type => state[type].status === 'idle' || isStale(state[type])
      );
      
      if (typesToLoad.length > 0) {
        await Promise.all(typesToLoad.map(type => getData(type)));
      }
    };
    
    loadInitialData();
  }, [getData, state]);

  // Auto-refresh data when it becomes stale
  useEffect(() => {
    const checkStaleData = () => {
      Object.entries(state).forEach(([type, dataState]) => {
        if (dataState.status === 'success' && isStale(dataState)) {
          getData(type as DataType);
        }
      });
    };
    
    const interval = setInterval(checkStaleData, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [state, getData]);

  const value = {
    getData,
    refreshData,
    getDataState,
    isRefreshing,
    getMonthlyIndex,
    getMonthlySnapshot,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// Custom hook to use the data context
export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

// Hook for using specific data type
export function useDataType<T extends DashboardData>(type: DataType, options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options;
  const { getData, getDataState, refreshData, isRefreshing } = useData();
  const state = getDataState(type);
  
  useEffect(() => {
    if (autoFetch && state.status === 'idle') {
      getData(type);
    }
  }, [type, getData, state.status, autoFetch]);
  
  return {
    data: state.status === 'success' ? (state.data as T) : null,
    isLoading: state.status === 'loading',
    error: state.status === 'error' ? state.error : null,
    refresh: () => refreshData(type),
    isRefreshing: isRefreshing(type),
  };
}

// --- Module 5 hooks ---
export function useMonthlyIndex(options: { order?: 'asc' | 'desc'; limit?: number; from?: YearMonth; to?: YearMonth; autoFetch?: boolean } = {}) {
  const { order, limit, from, to, autoFetch = true } = options;
  const { getMonthlyIndex } = useData();
  const [data, setData] = useState<MonthlyIndexResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getMonthlyIndex({ order, limit, from, to, signal: controller.signal });
        setData(res);
      } catch (err) {
        if (!isTimeoutError(err)) console.error('useMonthlyIndex error:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [order, limit, from, to, autoFetch, getMonthlyIndex]);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    try {
      setIsLoading(true);
      const res = await getMonthlyIndex({ order, limit, from, to, signal: controller.signal });
      setData(res);
      return res;
    } finally {
      controller.abort();
      setIsLoading(false);
    }
  }, [order, limit, from, to, getMonthlyIndex]);

  return { data, isLoading, error, refresh };
}

export function useMonthlySnapshot(yearMonth: YearMonth, options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options;
  const { getMonthlySnapshot } = useData();
  const [data, setData] = useState<MonthlySnapshotsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!autoFetch || !yearMonth) return;
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getMonthlySnapshot(yearMonth, { signal: controller.signal });
        setData(res);
      } catch (err) {
        if (!isTimeoutError(err)) console.error('useMonthlySnapshot error:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [yearMonth, autoFetch, getMonthlySnapshot]);

  const refresh = useCallback(async () => {
    if (!yearMonth) return null as any;
    const controller = new AbortController();
    try {
      setIsLoading(true);
      const res = await getMonthlySnapshot(yearMonth, { signal: controller.signal });
      setData(res);
      return res;
    } finally {
      controller.abort();
      setIsLoading(false);
    }
  }, [yearMonth, getMonthlySnapshot]);

  return { data, isLoading, error, refresh };
}
