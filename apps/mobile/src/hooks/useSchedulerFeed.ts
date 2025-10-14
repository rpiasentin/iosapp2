import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  SchedulerEventsResponse,
  SchedulerStatusResponse,
  createApiClient,
} from '@inverter/api-client';

export interface SchedulerFeedData {
  readonly status: SchedulerStatusResponse;
  readonly events: SchedulerEventsResponse;
  readonly fetchedAt: Date;
}

export type SchedulerFeedStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SchedulerFeedState {
  readonly status: SchedulerFeedStatus;
  readonly data: SchedulerFeedData | null;
  readonly error: string | null;
  readonly refreshing: boolean;
  readonly refresh: () => void;
}

type FetchMode = 'initial' | 'refresh' | 'auto';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error fetching scheduler data';
}

export function useSchedulerFeed(baseUrl: string): SchedulerFeedState {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const [status, setStatus] = useState<SchedulerFeedStatus>('idle');
  const [data, setData] = useState<SchedulerFeedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(
    async (mode: FetchMode) => {
      if (!mountedRef.current) {
        return;
      }
      if (mode === 'initial') {
        setStatus('loading');
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }
      try {
        const [statusResponse, eventsResponse] = await Promise.all([
          api.getSchedulerStatus({ timeoutMs: 4000 }),
          api.getSchedulerEvents(50, { timeoutMs: 4000 }),
        ]);
        if (!mountedRef.current) {
          return;
        }
        setData({
          status: statusResponse,
          events: eventsResponse,
          fetchedAt: new Date(),
        });
        setError(null);
        setStatus('ready');
      } catch (err) {
        if (!mountedRef.current) {
          return;
        }
        const message = getErrorMessage(err);
        setError(message);
        if (!data) {
          setStatus('error');
        }
      } finally {
        if (!mountedRef.current) {
          return;
        }
        if (mode === 'refresh') {
          setRefreshing(false);
        }
        if (mode === 'initial' && data) {
          setStatus('ready');
        }
      }
    },
    [api, data],
  );

  useEffect(() => {
    fetchData('initial');
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchData('auto');
    }, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData('refresh');
  }, [fetchData]);

  return {
    status,
    data,
    error,
    refreshing,
    refresh,
  };
}
