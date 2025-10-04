import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertsResponse,
  ApiError,
  createApiClient,
  HealthResponse,
  InverterSample,
  PvHistoryResponse,
  SchedulerEventsResponse,
  SchedulerStatusResponse,
} from '@inverter/api-client';

export interface DashboardData {
  readonly health: HealthResponse;
  readonly runtime: InverterSample;
  readonly energy: InverterSample;
  readonly battery: InverterSample;
  readonly pvHistory: PvHistoryResponse;
  readonly alerts: AlertsResponse;
  readonly schedulerStatus: SchedulerStatusResponse;
  readonly schedulerEvents: SchedulerEventsResponse;
  readonly fetchedAt: Date;
}

export type DashboardStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DashboardState {
  readonly status: DashboardStatus;
  readonly data: DashboardData | null;
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
  return 'Unexpected error fetching inverter data';
}

export function useDashboardData(baseUrl: string): DashboardState {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<DashboardStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAll = useCallback(
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
        const [health, runtime, energy, battery, pvHistory, alerts, schedulerStatus, schedulerEvents] = await Promise.all([
          api.getHealth({ timeoutMs: 4000 }),
          api.getRuntime({ timeoutMs: 4000 }),
          api.getEnergy({ timeoutMs: 4000 }),
          api.getBattery({ timeoutMs: 4000 }),
          api.getPvHistory(60, { timeoutMs: 4000 }),
          api.getAlerts({ timeoutMs: 4000 }),
          api.getSchedulerStatus({ timeoutMs: 4000 }),
          api.getSchedulerEvents(25, { timeoutMs: 4000 }),
        ]);

        if (!mountedRef.current) {
          return;
        }

        setData({
          health,
          runtime,
          energy,
          battery,
          pvHistory,
          alerts,
          schedulerStatus,
          schedulerEvents,
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
    fetchAll('initial');
  }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchAll('auto');
    }, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const refresh = useCallback(() => {
    fetchAll('refresh');
  }, [fetchAll]);

  return {
    status,
    data,
    error,
    refreshing,
    refresh,
  };
}
