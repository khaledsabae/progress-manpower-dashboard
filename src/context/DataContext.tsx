'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { DataState, DashboardData, DataFetchError } from '@/types/dashboard';
import { ErrorState } from '@/components/ui/ErrorState';

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
  getData: (type: DataType, forceRefresh?: boolean) => Promise<DashboardData | null>;
  refreshData: (type?: DataType) => Promise<void>;
  getDataState: (type: DataType) => DataState<any>;
  isRefreshing: (type: DataType) => boolean;
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
  const fetchData = useCallback(async (type: DataType): Promise<DashboardData> => {
    const cacheKey = `${type}`;
    const cached = cache.current[cacheKey];
    
    // Return cached data if it's still valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    
    try {
      // Check if there's already a request in flight
      if (cacheKey in inFlightRequests.current) {
        return inFlightRequests.current[cacheKey];
      }
      
      // Create a new request with special handling per type
      const request = (async () => {
        // Helper to fetch consolidated project data once when needed
        const fetchProjectData = async () => {
          const resp = await fetch('/api/project-data');
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
          const resp = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectData }),
          });
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
          const response = await fetch(`/api/${type}`);
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
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      throw error;
    }
  }, []);

  // Get data with caching and loading states
  const getData = useCallback(async (type: DataType, forceRefresh = false): Promise<DashboardData | null> => {
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
      
      const data = await fetchData(type);
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
      if (!errorObj.retryable || state[type].status === 'idle') {
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
