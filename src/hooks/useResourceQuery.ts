import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl, getAuthHeaders } from '../lib/apiConfig';

export interface QueryOptions<T> {
  staleTime?: number; // ms antes de considerar datos obsoletos
  enabled?: boolean;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (err: Error) => void;
}

export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<T | undefined>;
  mutate: (newData: T | ((prev: T | undefined) => T), revalidate?: boolean) => void;
}

// Caché global en memoria compartida entre componentes (patrón TanStack Query)
const queryCache = new Map<string, { data: any; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Hook tipo TanStack Query / HTTP Client por recurso conectado al backend PostgreSQL:
 * Realiza peticiones HTTP GET específicas por recurso a la API REST Express con cache en memoria y revalidación.
 */
export function useResourceQuery<T>(
  queryKey: string,
  fetchUrl: string,
  options: QueryOptions<T> = {}
): QueryResult<T> {
  const { staleTime = 30000, enabled = true, initialData, onSuccess, onError } = options;

  const [data, setData] = useState<T | undefined>(() => {
    const cached = queryCache.get(queryKey);
    if (cached) return cached.data;
    return initialData;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = queryCache.get(queryKey);
    return !cached && enabled;
  });

  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return;

    // Deduplicación de peticiones concurrentes en vuelo
    if (inFlightRequests.has(queryKey)) {
      try {
        const result = await inFlightRequests.get(queryKey);
        if (isMountedRef.current) {
          setData(result);
          setIsLoading(false);
        }
        return result;
      } catch (e: any) {
        if (isMountedRef.current) {
          setError(e);
          setIsLoading(false);
        }
        return undefined;
      }
    }

    const promise = (async () => {
      const url = getApiUrl(fetchUrl);
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Error al obtener recurso [${queryKey}]`);
      }

      const json = await res.json();
      const extractedData = json.data !== undefined ? json.data : json;
      return extractedData as T;
    })();

    inFlightRequests.set(queryKey, promise);

    try {
      const result = await promise;
      queryCache.set(queryKey, { data: result, timestamp: Date.now() });

      if (isMountedRef.current) {
        setData(result);
        setError(null);
        setIsLoading(false);
        if (onSuccess) onSuccess(result);
      }
      return result;
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err);
        setIsLoading(false);
        if (onError) onError(err);
      }
      return undefined;
    } finally {
      inFlightRequests.delete(queryKey);
    }
  }, [enabled, fetchUrl, queryKey, onSuccess, onError]);

  useEffect(() => {
    isMountedRef.current = true;

    const cached = queryCache.get(queryKey);
    const isStale = !cached || (Date.now() - cached.timestamp > staleTime);

    if (enabled && isStale) {
      setIsLoading(true);
      fetchData();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [queryKey, enabled, staleTime, fetchData]);

  const mutate = useCallback((newData: T | ((prev: T | undefined) => T), revalidate = false) => {
    setData(prev => {
      const resolved = typeof newData === 'function' ? (newData as any)(prev) : newData;
      queryCache.set(queryKey, { data: resolved, timestamp: Date.now() });
      return resolved;
    });

    if (revalidate) {
      fetchData();
    }
  }, [queryKey, fetchData]);

  return {
    data,
    isLoading,
    isError: error !== null,
    error,
    refetch: fetchData,
    mutate
  };
}

/**
 * CLIENTES TIPADOS POR RECURSO DE NEGOCIO (TanStack Query Pattern):
 */
export function useProductsQuery() {
  return useResourceQuery<any[]>('products', '/api/products');
}

export function useInvoicesQuery(params?: { startDate?: string; endDate?: string; status?: string }) {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return useResourceQuery<any[]>(`invoices-${query}`, `/api/invoices${query}`);
}

export function useCustomersQuery() {
  return useResourceQuery<any[]>('customers', '/api/customers');
}

export function useSriQueueQuery(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return useResourceQuery<any[]>(`sriQueue-${query}`, `/api/sri/cola${query}`, { staleTime: 10000 });
}

export function useSriQueueStatsQuery() {
  return useResourceQuery<any>('sriQueueStats', '/api/sri/cola/stats', { staleTime: 10000 });
}
