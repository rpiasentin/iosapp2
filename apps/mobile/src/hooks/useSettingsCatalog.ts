import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  SettingsCatalogItem,
  createApiClient,
} from '@inverter/api-client';

export type SettingsCatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SettingsCatalogState {
  readonly status: SettingsCatalogStatus;
  readonly items: ReadonlyArray<SettingsCatalogItem>;
  readonly error: string | null;
  readonly refreshing: boolean;
  readonly refresh: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error fetching settings catalog';
}

export function useSettingsCatalog(baseUrl: string): SettingsCatalogState {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const [status, setStatus] = useState<SettingsCatalogStatus>('idle');
  const [items, setItems] = useState<SettingsCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchCatalog = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!mountedRef.current) {
        return;
      }
      if (mode === 'initial') {
        setStatus('loading');
      } else {
        setRefreshing(true);
      }
      try {
        const response = await api.getSettingsCatalog({ timeoutMs: 4000 });
        if (!mountedRef.current) {
          return;
        }
        const nextItems = response.items ? [...response.items] : [];
        setItems(nextItems);
        setError(null);
        setStatus('ready');
      } catch (err) {
        if (!mountedRef.current) {
          return;
        }
        setError(getErrorMessage(err));
        if (mode === 'initial') {
          setStatus('error');
        }
      } finally {
        if (!mountedRef.current) {
          return;
        }
        if (mode === 'refresh') {
          setRefreshing(false);
        }
      }
    },
    [api],
  );

  useEffect(() => {
    fetchCatalog('initial');
  }, [fetchCatalog]);

  const refresh = useCallback(() => {
    fetchCatalog('refresh');
  }, [fetchCatalog]);

  return {
    status,
    items,
    error,
    refreshing,
    refresh,
  };
}
